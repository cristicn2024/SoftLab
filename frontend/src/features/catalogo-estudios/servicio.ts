import { api } from '../../compartido/api'
import { SESION } from '../../compartido/sesion'
import type { EstudioCatalogo, LaboratorioExterno, ListaExternos } from './tipos'

const ENCABEZADOS = {
  'x-user-name': encodeURIComponent(SESION.usuario),
  'x-user-role': encodeURIComponent(SESION.rol),
}

export async function obtenerEstudio(id: number): Promise<EstudioCatalogo | null> {
  const respuesta = await api.get<{ studies: EstudioCatalogo[] }>('/catalogo', { headers: ENCABEZADOS })
  for (const estudio of respuesta.data.studies) {
    if (estudio.id === id) return estudio
  }
  return null
}

export async function obtenerLaboratorios(): Promise<LaboratorioExterno[]> {
  const respuesta = await api.get<LaboratorioExterno[]>('/externos/laboratorios', { headers: ENCABEZADOS })
  return respuesta.data
}

export async function guardarEstudio(id: number, cuerpo: Record<string, unknown>): Promise<void> {
  await api.put(`/catalogo/studies/${id}`, cuerpo, { headers: ENCABEZADOS })
}

export async function obtenerExternos(q: string, laboratorio: string, estatus: string): Promise<ListaExternos> {
  const respuesta = await api.get<ListaExternos>('/externos/estudios', {
    headers: ENCABEZADOS,
    params: { q, laboratorio, estatus },
  })
  return respuesta.data
}
