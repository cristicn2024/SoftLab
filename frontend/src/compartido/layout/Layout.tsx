import { useSesion } from '../sesionContext'
import { Suspense } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Cargando } from '../Cargando'
import { BarraLateral } from './BarraLateral'
import { BarraSuperior } from './BarraSuperior'
import { elementoActivo, panelInicial, rutaPermitida } from './menu'
import { PiePagina } from './PiePagina'
import './layout.css'

export function Layout() {
  const { pathname } = useLocation()
  const { sesion, cargando } = useSesion()
  if (cargando) return <main role="status">Verificando sesión…</main>
  if (!sesion) return <Navigate to="/login" replace />
  if (pathname !== '/panel' && !rutaPermitida(pathname, sesion.permisos)) {
    return <Navigate to={panelInicial(sesion.permisos)} replace />
  }
  const activo = elementoActivo(pathname)

  let modulo = ''
  if (activo !== undefined) modulo = activo.etiqueta
  
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
