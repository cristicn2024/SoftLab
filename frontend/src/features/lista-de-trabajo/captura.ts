import { interpretResult } from '../results/interpretation.ts'
import type { Flag, RangeRule } from '../results/interpretation.ts'
import type { EntradaResultado, OrdenDeLista, ParametroPendiente } from './tipos.ts'

export type ValorPreparado = { ok: true; valor: string } | { ok: false; mensaje: string }

export type EntradasArmadas = { ok: true; entradas: EntradaResultado[] } | { ok: false; mensaje: string }

const NUMERICO = /^-?\d+(\.\d+)?$/

export function claveDe(parametro: ParametroPendiente): string {
  return `${parametro.orderItemId}:${parametro.parameterId}`
}

export function prepararValor(texto: string, regla: RangeRule | null): ValorPreparado {
  const limpio = texto.trim()
  if (limpio === '') return { ok: false, mensaje: 'Escribe un resultado.' }
  if (regla === null || regla.expected) return { ok: true, valor: limpio }

  const numerico = limpio.replace(',', '.')
  if (!NUMERICO.test(numerico)) return { ok: false, mensaje: 'Este estudio lleva un valor numérico.' }
  return { ok: true, valor: numerico }
}

export function banderaEnVivo(texto: string, regla: RangeRule | null): Flag | null {
  if (texto.trim() === '') return null
  const preparado = prepararValor(texto, regla)
  if (!preparado.ok) return null
  return interpretResult(preparado.valor, regla)
}

export function hayParametrosSinRango(pendientes: ParametroPendiente[]): boolean {
  for (const parametro of pendientes) {
    if (parametro.rule === null) return true
  }
  return false
}

export function armarEntradas(pendientes: ParametroPendiente[], valores: Record<string, string>): EntradasArmadas {
  const entradas: EntradaResultado[] = []

  for (const parametro of pendientes) {
    const texto = valores[claveDe(parametro)] ?? ''
    if (texto.trim() === '') continue

    const preparado = prepararValor(texto, parametro.rule)
    if (!preparado.ok) {
      return { ok: false, mensaje: `${parametro.parameterName}: ${preparado.mensaje}` }
    }

    const bandera = interpretResult(preparado.valor, parametro.rule)
    if (bandera === 'HH' || bandera === 'LL') {
      return {
        ok: false,
        mensaje: `${parametro.parameterName}: valor crítico (${bandera}). Falta registrar a quién se notificó antes de guardarlo (HU 6.2).`,
      }
    }

    entradas.push({ orderItemId: parametro.orderItemId, parameterId: parametro.parameterId, value: preparado.valor })
  }

  if (entradas.length === 0) return { ok: false, mensaje: 'Escribe al menos un resultado.' }
  return { ok: true, entradas }
}

export function estadoDeMuestra(orden: OrdenDeLista): string {
  if (orden.capturedCount > 0) return 'En análisis'
  return 'Recibido'
}

export function nombresDeEstudios(orden: OrdenDeLista): string[] {
  const nombres: string[] = []
  for (const parametro of orden.pending) {
    if (!nombres.includes(parametro.testName)) nombres.push(parametro.testName)
  }
  return nombres
}

export function siguienteOrden(antes: OrdenDeLista[], despues: OrdenDeLista[], idActual: number): number | null {
  let posicion = -1
  for (let indice = 0; indice < antes.length; indice++) {
    if (antes[indice].orderId === idActual) posicion = indice
  }

  const candidatos: number[] = []
  for (let indice = posicion + 1; indice < antes.length; indice++) {
    candidatos.push(antes[indice].orderId)
  }
  for (let indice = 0; indice < posicion; indice++) {
    candidatos.push(antes[indice].orderId)
  }

  for (const id of candidatos) {
    for (const orden of despues) {
      if (orden.orderId === id) return id
    }
  }
  return null
}
