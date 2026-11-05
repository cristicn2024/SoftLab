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
  {
    etiqueta: 'Recepción',
    prefijo: '/ordenes',
    ruta: '/ordenes/corte-caja',
    subelementos: [{ etiqueta: 'Corte de caja', ruta: '/ordenes/corte-caja' }],
  },
  { etiqueta: 'Catálogo', prefijo: '/catalogo', subelementos: [] },
  { etiqueta: 'Toma de muestras', prefijo: '/toma-de-muestras', subelementos: [] },
  {
    etiqueta: 'Resultados',
    prefijo: '/resultados',
    ruta: '/resultados/plantillas',
    subelementos: [
      { etiqueta: 'Plantillas de informe', ruta: '/resultados/plantillas' },
      { etiqueta: 'Página de ejemplo', ruta: '/resultados/ejemplo' },
    ],
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
