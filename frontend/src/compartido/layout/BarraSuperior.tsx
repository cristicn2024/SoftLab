import { useSesion } from '../sesionContext'

export function BarraSuperior() {
  const { sesion } = useSesion()

  return (
    <header className="sl-barra no-print">
      <div>
        <small>LABORATORIO</small>
        <b>{sesion.laboratorio}</b>
      </div>
      <div>
        <small>SUCURSAL</small>
        <b>{sesion.sucursal}</b>
      </div>
      <div className="sl-empujar">
        <small>USUARIO</small>
        <b>{sesion.usuario}</b>
      </div>
      <div>
        <small>ROL</small>
        <b>{sesion.rol}</b>
      </div>
    </header>
  )
}
