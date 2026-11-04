export function Cargando({ mensaje = 'Cargando…' }: { mensaje?: string }) {
  return (
    <p className="sl-cargando" role="status">
      {mensaje}
    </p>
  )
}
