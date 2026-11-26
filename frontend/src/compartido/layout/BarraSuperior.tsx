import { useState } from 'react'
import { api, mensajeDeError } from '../api'
import { useSesion } from '../sesionContext'

export function BarraSuperior() {
  const { sesion, establecer } = useSesion()
  const [error, setError] = useState('')
  const [cerrando, setCerrando] = useState(false)
  if (!sesion) return null
  async function salir() {
    setCerrando(true)
    try { await api.post('/auth/logout'); establecer(null) }
    catch (e) { setError(mensajeDeError(e)) }
    finally { setCerrando(false) }
  }

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
        <b>{sesion.nombre}</b>
      </div>
      <div>
        <small>ROL</small>
        <b>{sesion.nombreRol}</b>
      </div>
      <button type="button" disabled={cerrando} onClick={salir}>Cerrar sesión</button>
      {error && <span role="alert">{error}</span>}
    </header>
  )
}
