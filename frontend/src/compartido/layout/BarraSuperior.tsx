import { SESION } from '../sesion'

export function BarraSuperior() {
  return (
    <header className="sl-barra">
      <div>
        <small>LABORATORIO</small>
        <b>{SESION.laboratorio}</b>
      </div>
      <div>
        <small>SUCURSAL</small>
        <b>{SESION.sucursal}</b>
      </div>
      <div className="sl-empujar">
        <small>USUARIO</small>
        <b>{SESION.usuario}</b>
      </div>
      <div>
        <small>ROL</small>
        <b>{SESION.rol}</b>
      </div>
    </header>
  )
}