import axios from 'axios'

const URL_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'

export const api = axios.create({
  baseURL: URL_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.response.use(response => response, error => {
  if (error.response?.status === 401 && !error.config?.url?.startsWith('/auth/')) {
    window.dispatchEvent(new Event('softlab:sesion-expirada'))
  }
  return Promise.reject(error)
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
