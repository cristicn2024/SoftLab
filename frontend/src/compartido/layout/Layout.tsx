import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Cargando } from '../Cargando'
import { BarraLateral } from './BarraLateral'
import { BarraSuperior } from './BarraSuperior'
import { elementoActivo } from './menu'
import { PiePagina } from './PiePagina'
import './layout.css'

export function Layout() {
  const { pathname } = useLocation()
  const activo = elementoActivo(pathname)

  let modulo = ''
  if (activo !== null) modulo = activo.etiqueta

  return (
    <div className="sl-shell">
      <BarraLateral />
      <div className="sl-workspace">
        <BarraSuperior />
        <Suspense
          fallback={
            <main className="sl-pagina">
              <Cargando />
            </main>
          }
        >
          <Outlet />
        </Suspense>
        <PiePagina modulo={modulo} />
      </div>
    </div>
  )
}