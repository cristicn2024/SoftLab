import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { elementoActivo, MENU } from './menu'
import type { ElementoMenu, SubElementoMenu } from './menu'

function SubElemento({ elemento, ruta }: { elemento: SubElementoMenu; ruta: string }) {
  if (elemento.ruta === undefined) {
    return <span>{elemento.etiqueta}</span>
  }

  let clase = ''
  if (ruta.startsWith(elemento.ruta)) clase = 'activo'

  return (
    <Link to={elemento.ruta} className={clase}>
      {elemento.etiqueta}
    </Link>
  )
}

function Modulo({ elemento, activo, ruta }: { elemento: ElementoMenu; activo: boolean; ruta: string }) {
  let clase = 'sl-item'
  if (activo) clase = 'sl-item activo'

  let boton = (
    <button type="button" className={clase} disabled>
      {elemento.etiqueta}
      <span>›</span>
    </button>
  )

  if (elemento.ruta !== undefined) {
    boton = (
      <Link to={elemento.ruta} className={clase}>
        {elemento.etiqueta}
        <span>›</span>
      </Link>
    )
  }

  const subelementos: ReactNode[] = []
  if (activo) {
    for (const subelemento of elemento.subelementos) {
      subelementos.push(<SubElemento key={subelemento.etiqueta} elemento={subelemento} ruta={ruta} />)
    }
  }

  return (
    <section className="sl-modulo">
      {boton}
      {subelementos.length > 0 && <div className="sl-subnav">{subelementos}</div>}
    </section>
  )
}

export function BarraLateral() {
  const { pathname } = useLocation()
  const activo = elementoActivo(pathname)

  const modulos: ReactNode[] = []
  for (const elemento of MENU) {
    modulos.push(<Modulo key={elemento.etiqueta} elemento={elemento} activo={activo === elemento} ruta={pathname} />)
  }

  return (
    <aside className="sl-sidebar no-print">
      <div className="sl-marca">SoftLab</div>
      <nav aria-label="Menú principal">{modulos}</nav>
    </aside>
  )
}
