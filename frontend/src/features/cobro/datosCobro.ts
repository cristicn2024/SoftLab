// Tipos y constantes de la HU 5.3 · Total y estado de pago.
// Los importes se manejan en centavos (enteros) para evitar errores de redondeo.
// Los datos vienen del backend (ver cobroApi.ts).

export type Concepto = {
  clave: string
  nombre: string
  precio: number
}

export type MetodoPago = 'Efectivo' | 'Tarjeta' | 'Transferencia'

export type Pago = {
  id: number
  metodo: MetodoPago
  monto: number
  referencia: string
  fecha: string
  usuario: string
  cancelado: boolean
}

export type Descuento = {
  porcentaje: number
  motivo: string
  autorizo: string
}

export type DatosFactura = {
  rfc: string
  razonSocial: string
  codigoPostal: string
  usoCfdi: string
}

export type MovimientoBitacora = {
  fecha: string
  usuario: string
  accion: string
  detalle: string
}

export type OrdenPorCobrar = {
  id: number
  folio: string
  paciente: string
  expediente: string
  edad: number
  sexo: string
  medico: string
  sucursal: string
  conceptos: Concepto[]
  resultadosEntregados: boolean
}

// Todo lo que la pantalla necesita de una orden, ya convertido a centavos.
export type CobroOrden = {
  orden: OrdenPorCobrar
  descuento: Descuento
  factura: DatosFactura | null
  total: number
  pagado: number
  pagos: Pago[]
  bitacora: MovimientoBitacora[]
}

// Los servicios de análisis clínicos están exentos de IVA, por eso la tasa es 0.
// Debe coincidir con TAX_RATE del backend (payment.controller.ts).
export const TASA_IMPUESTO = 0

export const PORCENTAJES_DESCUENTO = [0, 5, 10, 15, 20]

export const ROLES_CON_PERMISO_ESPECIAL = ['Administradora', 'Administrador']
