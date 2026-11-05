import { api } from '../../compartido/api'
import type { EntradaResultado, ListaDeTrabajo, OrdenDeLista } from './tipos'

export async function obtenerLista(): Promise<ListaDeTrabajo> {
  const respuesta = await api.get<ListaDeTrabajo>('/worklist')
  return respuesta.data
}

export async function obtenerOrden(idOrden: number): Promise<OrdenDeLista> {
  const respuesta = await api.get<OrdenDeLista>(`/worklist/orders/${idOrden}`)
  return respuesta.data
}

export async function guardarResultados(idOrden: number, resultados: EntradaResultado[]): Promise<void> {
  await api.post(`/worklist/orders/${idOrden}/results`, { results: resultados })
}
