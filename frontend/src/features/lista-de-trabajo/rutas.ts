export const RUTA_LISTA = '/resultados/lista-de-trabajo'

export function rutaDeCaptura(idOrden: number): string {
  return `${RUTA_LISTA}/${idOrden}`
}
