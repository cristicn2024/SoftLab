export function MensajeError({ mensaje }: { mensaje: string }) {
  return (
    <div className="sl-error" role="alert">
      <b>ERROR</b>
      <div>
        <strong>{mensaje}</strong>
      </div>
    </div>
  )
}
