import axios from 'axios'

const URL_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'
const ID_LABORATORIO = import.meta.env.VITE_TENANT_ID ?? '1'

export const api = axios.create({
  baseURL: URL_BASE,
  headers: {
    'Content-Type': 'application/json',
    'x-tenant-id': ID_LABORATORIO,
  },
})

type CuerpoDeError = { error?: string | { tipo?: string; mensaje?: string } }

export function mensajeDeError(error: unknown): string {
  if (axios.isAxiosError<CuerpoDeError>(error)) {
    if (error.response === undefined) return 'No se pudo conectar con el servidor.'

    const detalle = error.response.data?.error
    if (typeof detalle === 'string') return detalle
    if (detalle !== undefined && typeof detalle.mensaje === 'string') return detalle.mensaje
  }
  return 'No se pudo completar la operación.'
}
