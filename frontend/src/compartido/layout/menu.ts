export type SubElementoMenu = {
  etiqueta: string
  ruta?: string
}

export type ElementoMenu = {
  etiqueta: string
  prefijo: string
  ruta?: string
  subelementos: SubElementoMenu[]
}

export const MENU: ElementoMenu[] = [
  { etiqueta: 'Recepción', prefijo: '/ordenes', subelementos: [] },
  { etiqueta: 'Catálogo', prefijo: '/catalogo', subelementos: [] },
  { etiqueta: 'Toma de muestras', prefijo: '/toma-de-muestras', subelementos: [] },
  {
    etiqueta: 'Resultados',
    prefijo: '/resultados',
    ruta: '/resultados/ejemplo',
    subelementos: [{ etiqueta: 'Página de ejemplo', ruta: '/resultados/ejemplo' }],
  },
  { etiqueta: 'Administración', prefijo: '/administracion', subelementos: [] },
  { etiqueta: 'Reportes', prefijo: '/reportes', subelementos: [] },
]

export function elementoActivo(ruta: string): ElementoMenu | null {
  for (const elemento of MENU) {
    if (ruta.startsWith(elemento.prefijo)) return elemento
  }
  return null
}
