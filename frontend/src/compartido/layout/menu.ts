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
      { etiqueta: 'Pacientes' },
      { etiqueta: 'Nueva orden', ruta: '/recepcion/nueva-orden' },
      { etiqueta: 'Cobro de la orden', ruta: '/ordenes/cobro' },
      { etiqueta: 'Corte de caja' }
    ]
  },
  {
    etiqueta: 'Catálogo',
    subelementos: [
      { etiqueta: 'Estudios' },
      { etiqueta: 'Perfiles' }
    ]
  },
  {
    etiqueta: 'Toma de muestras',
    subelementos: []
  },
  {
    etiqueta: 'Resultados',
    subelementos: [
      { etiqueta: 'Entrega de resultados', ruta: '/resultados/entrega' },
      { etiqueta: 'Plantilla de informes', ruta: '/resultados/plantillas' }
    ]
  },
  {
    etiqueta: 'Administración',
    subelementos: []
  },
  {
    etiqueta: 'Reportes',
    subelementos: []
  }
]

export function elementoActivo(pathname: string): ElementoMenu | undefined {
  return MENU.find((item) =>
    item.subelementos.some((sub) => sub.ruta && pathname.startsWith(sub.ruta))
  )
}