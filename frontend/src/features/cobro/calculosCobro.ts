import type { Concepto } from './datosCobro'

export type MontosCaptura = {
  efectivo: number
  tarjeta: number
  transferencia: number
}

export type Totales = {
  subtotal: number
  descuento: number
  impuestos: number
  total: number
  pagadoAntes: number
  porCobrar: number
  efectivoAplicado: number
  cambio: number
  pagadoAhora: number
  saldo: number
  excedeConTarjeta: boolean
}

// Convierte lo que escribe el usuario ("1,250.50", "$300") a centavos.
export function aCentavos(texto: string): number {
  const limpio = texto.replace(/[$,\s]/g, '')
  if (limpio === '') return 0
  const numero = Number(limpio)
  if (Number.isNaN(numero) || numero < 0) return 0
  return Math.round(numero * 100)
}

export function formatoDinero(centavos: number): string {
  const pesos = centavos / 100
  return '$' + pesos.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function calcularTotales(
  conceptos: Concepto[],
  porcentajeDescuento: number,
  tasaImpuesto: number,
  captura: MontosCaptura,
  pagadoAntes: number,
): Totales {
  let subtotal = 0
  for (const concepto of conceptos) subtotal += concepto.precio

  const descuento = Math.round((subtotal * porcentajeDescuento) / 100)
  const impuestos = Math.round(((subtotal - descuento) * tasaImpuesto) / 100)
  const total = subtotal - descuento + impuestos

  const porCobrar = Math.max(total - pagadoAntes, 0)

  // Tarjeta y transferencia se cobran exactas: no pueden pasar del saldo.
  const sinEfectivo = captura.tarjeta + captura.transferencia
  const excedeConTarjeta = sinEfectivo > porCobrar

  // El efectivo cubre lo que falte; lo que sobre es el cambio.
  const faltaEnEfectivo = Math.max(porCobrar - sinEfectivo, 0)
  const efectivoAplicado = Math.min(captura.efectivo, faltaEnEfectivo)
  const cambio = captura.efectivo - efectivoAplicado

  const pagadoAhora = Math.min(sinEfectivo, porCobrar) + efectivoAplicado
  const saldo = porCobrar - pagadoAhora

  return {
    subtotal,
    descuento,
    impuestos,
    total,
    pagadoAntes,
    porCobrar,
    efectivoAplicado,
    cambio,
    pagadoAhora,
    saldo,
    excedeConTarjeta,
  }
}

const PATRON_RFC = /^([A-ZÑ&]{3,4})(\d{6})([A-Z\d]{3})$/

export function rfcValido(rfc: string): boolean {
  return PATRON_RFC.test(rfc.trim().toUpperCase())
}

export function fechaHora(fecha: string | Date): string {
  return new Date(fecha).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
