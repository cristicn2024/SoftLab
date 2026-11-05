export interface SubElementoMenu {
  etiqueta: string
  ruta?: string
}

export interface ElementoMenu {
  etiqueta: string
  ruta?: string
  subelementos: SubElementoMenu[]
}

export const MENU: ElementoMenu[] = [
  {
    etiqueta: 'Recepción',
    subelementos: [
      { etiqueta: 'Pacientes', ruta: '/recepcion/pacientes' },
      { etiqueta: 'Nueva orden', ruta: '/recepcion/nueva-orden' },
      { etiqueta: 'Corte de caja', ruta: '/recepcion/corte-caja' }
    ]
  },
  {
    etiqueta: 'Catálogo',
    subelementos: [
      { etiqueta: 'Estudios', ruta: '/catalogo/estudios' },
      { etiqueta: 'Perfiles', ruta: '/catalogo/perfiles' }
    ]
  },
  {
    etiqueta: 'Toma de muestras',
    subelementos: []
  },
  {
    etiqueta: 'Resultados',
    subelementos: [
      { etiqueta: 'Plantilla de informes', ruta: '/resultados/plantillas' }
    ]
  },
  {
    etiqueta: 'Administración',
    subelementos: []
  },
  {
    etiqueta: 'Reportes',
    subelementos: [
      { etiqueta: 'Ejemplo', ruta: '/configuracion/plantilla-reporte' }
    ]
  }
]

export function elementoActivo(pathname: string): ElementoMenu | undefined {
  return MENU.find((item) =>
    item.subelementos.some((sub) => sub.ruta && pathname.startsWith(sub.ruta))
  )
}