<<<<<<< HEAD
export interface SubElementoMenu {
=======
export type SubElementoMenu = {
>>>>>>> origin/hu-5.4
  etiqueta: string
  ruta?: string
}

<<<<<<< HEAD
export interface ElementoMenu {
  etiqueta: string
=======
export type ElementoMenu = {
  etiqueta: string
  prefijo: string
>>>>>>> origin/hu-5.4
  ruta?: string
  subelementos: SubElementoMenu[]
}

export const MENU: ElementoMenu[] = [
  {
    etiqueta: 'Recepción',
<<<<<<< HEAD
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
=======
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
>>>>>>> origin/hu-5.4
