import { isAxiosError } from 'axios'
import { SESION } from '../../compartido/sesion'
import { api } from '../../services/api'
import { aCentavos, fechaHora } from './calculosCobro'
import type { CobroOrden, MetodoPago } from './datosCobro'
import type { EnvioCobro } from './FormularioCobro'

// Llamadas al backend de la HU 5.3 (backend/src/modules/cobro/cobro.controller.ts).

type MetodoApi = 'cash' | 'card' | 'transfer'

type CobroApi = {
  id: number
  folio: string
  patient: { name: string; record: string; age: number; gender: string }
  doctorName: string | null
  branch: { id: number; name: string }
  items: { code: string; name: string; price: string }[]
  discount: { percent: number; reason: string | null; authorizedBy: string | null }
  invoice: { rfc: string; name: string | null; zip: string | null; use: string | null } | null
  total: string
  paid: string
  resultsDelivered: boolean
  payments: {
    id: number
    method: MetodoApi
    amount: string
    reference: string | null
    createdBy: string
    createdAt: string
    cancelled: boolean
  }[]
  logs: { userName: string; action: string; detail: string; createdAt: string }[]
}

const METODO: Record<MetodoApi, MetodoPago> = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia' }

// Mientras no haya inicio de sesión, el usuario se manda en encabezados.
// Se codifican porque los encabezados no aceptan bien acentos.
function encabezadosUsuario() {
  return {
    'x-user-name': encodeURIComponent(SESION.usuario),
    'x-user-role': encodeURIComponent(SESION.rol),
  }
}

function aPantalla(datos: CobroApi): CobroOrden {
  let factura = null
  if (datos.invoice !== null) {
    factura = {
      rfc: datos.invoice.rfc,
      razonSocial: datos.invoice.name ?? '',
      codigoPostal: datos.invoice.zip ?? '',
      usoCfdi: datos.invoice.use ?? '',
    }
  }

  return {
    orden: {
      id: datos.id,
      folio: datos.folio,
      paciente: datos.patient.name,
      expediente: datos.patient.record,
      edad: datos.patient.age,
      sexo: datos.patient.gender,
      medico: datos.doctorName ?? 'Particular',
      sucursal: datos.branch.name,
      conceptos: datos.items.map((item) => ({ clave: item.code, nombre: item.name, precio: aCentavos(item.price) })),
      resultadosEntregados: datos.resultsDelivered,
    },
    descuento: {
      porcentaje: datos.discount.percent,
      motivo: datos.discount.reason ?? '',
      autorizo: datos.discount.authorizedBy ?? '',
    },
    factura,
    total: aCentavos(datos.total),
    pagado: aCentavos(datos.paid),
    pagos: datos.payments.map((pago) => ({
      id: pago.id,
      metodo: METODO[pago.method],
      monto: aCentavos(pago.amount),
      referencia: pago.reference ?? '',
      fecha: fechaHora(pago.createdAt),
      usuario: pago.createdBy,
      cancelado: pago.cancelled,
    })),
    bitacora: datos.logs.map((log) => ({
      fecha: fechaHora(log.createdAt),
      usuario: log.userName,
      accion: log.action,
      detalle: log.detail,
    })),
  }
}

// Convierte el error del backend ({ error: '...' } o { error: { mensaje: '...' } }) en un mensaje para la pantalla.
export function mensajeDeError(error: unknown): string {
  if (isAxiosError(error)) {
    const respuesta = error.response?.data as { error?: string | { mensaje?: string } } | undefined
    const detalle = respuesta?.error
    if (typeof detalle === 'string' && detalle !== '') return detalle
    if (detalle !== undefined && typeof detalle === 'object' && typeof detalle.mensaje === 'string') return detalle.mensaje
    if (error.response === undefined) return 'No se pudo conectar con el servidor. Revisa que el backend esté corriendo.'
  }
  return 'Ocurrió un error inesperado.'
}

function aPesos(centavos: number): number {
  return centavos / 100
}

export async function obtenerCobro(ordenId: number): Promise<CobroOrden> {
  const respuesta = await api.get<CobroApi>(`/orders/${ordenId}/billing`)
  return aPantalla(respuesta.data)
}

export async function registrarPagos(ordenId: number, envio: EnvioCobro, dejarPendiente: boolean): Promise<CobroOrden> {
  const pagos: { method: MetodoApi; amount: number; reference?: string }[] = []
  if (envio.totales.efectivoAplicado > 0) pagos.push({ method: 'cash', amount: aPesos(envio.totales.efectivoAplicado) })
  if (envio.captura.tarjeta > 0) pagos.push({ method: 'card', amount: aPesos(envio.captura.tarjeta), reference: envio.referenciaTarjeta })
  if (envio.captura.transferencia > 0) {
    pagos.push({ method: 'transfer', amount: aPesos(envio.captura.transferencia), reference: envio.referenciaTransferencia })
  }

  let factura = null
  if (envio.factura !== null) {
    factura = {
      rfc: envio.factura.rfc,
      name: envio.factura.razonSocial,
      zip: envio.factura.codigoPostal,
      use: envio.factura.usoCfdi,
    }
  }

  const respuesta = await api.post<CobroApi>(
    `/orders/${ordenId}/payments`,
    {
      payments: pagos,
      cashReceived: aPesos(envio.captura.efectivo),
      discount: { percent: envio.descuento.porcentaje, reason: envio.descuento.motivo },
      invoice: factura,
      leavePending: dejarPendiente,
    },
    { headers: encabezadosUsuario() },
  )
  return aPantalla(respuesta.data)
}

export async function cancelarPago(pagoId: number, motivo: string): Promise<CobroOrden> {
  const respuesta = await api.post<CobroApi>(`/payments/${pagoId}/cancel`, { reason: motivo }, { headers: encabezadosUsuario() })
  return aPantalla(respuesta.data)
}
