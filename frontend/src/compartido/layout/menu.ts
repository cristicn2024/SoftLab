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
    ruta: '/ordenes/nueva',
    subelementos: [{ etiqueta: 'Pacientes' }, { etiqueta: 'Nueva orden', ruta: '/ordenes/nueva' }, { etiqueta: 'Corte de caja' }],
  },
  { etiqueta: 'Catálogo', prefijo: '/catalogo', subelementos: [] },
  { etiqueta: 'Toma de muestras', prefijo: '/toma-de-muestras', subelementos: [] },
  {
    etiqueta: 'Resultados',
    prefijo: '/resultados',
    ruta: '/resultados/lista-de-trabajo',
    subelementos: [
      { etiqueta: 'Captura de resultados', ruta: '/resultados/lista-de-trabajo' },
      { etiqueta: 'Por validar' },
      { etiqueta: 'Envíos' },
      { etiqueta: 'Rangos de referencia' },
      { etiqueta: 'Plantillas de informe' },
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
