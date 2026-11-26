export interface SubElementoMenu {
  permiso?: string
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
      { etiqueta: 'Nueva orden', permiso: 'ordenes', ruta: '/recepcion/nueva-orden' },
      { etiqueta: 'Cobro de la orden', permiso: 'cobro', ruta: '/ordenes/cobro' },
      { etiqueta: 'Corte de caja', permiso: 'caja', ruta: '/ordenes/corte-caja' }
    ]
  },
  {
    etiqueta: 'Catálogo',
    subelementos: [
      { etiqueta: 'Estudios', permiso: 'catalogo', ruta: '/catalogo/estudios' },
      { etiqueta: 'Perfiles', permiso: 'catalogo', ruta: '/catalogo/perfiles' }
    ]
  },
  {
    etiqueta: 'Toma de muestras',
    subelementos: []
  },
  {
    etiqueta: 'Resultados',
    subelementos: [
      { etiqueta: 'Entrega de resultados', permiso: 'entrega', ruta: '/resultados/entrega' },
      { etiqueta: 'Captura de resultados', permiso: 'resultados', ruta: '/resultados/lista-de-trabajo' },
      { etiqueta: 'Por validar' },
      { etiqueta: 'Envíos' },
      { etiqueta: 'Rangos de referencia', permiso: 'referencias', ruta: '/resultados/referencias' },
      { etiqueta: 'Plantilla de informes', permiso: 'plantillas', ruta: '/resultados/plantillas' }
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

const paginas = MENU.flatMap(item => item.subelementos)

export function panelInicial(permisos: string[]) {
  for (const permiso of permisos) {
    const pagina = paginas.find(p => p.permiso === permiso)
    if (pagina?.ruta) return pagina.ruta
  }
  return '/panel'
}

export function rutaPermitida(pathname: string, permisos: string[]) {
  if (pathname === '/resultados/ejemplo') return permisos.includes('resultados')
  return paginas.some(p => p.ruta && p.permiso && permisos.includes(p.permiso)
    && (pathname === p.ruta || pathname.startsWith(p.ruta + '/')))
}
