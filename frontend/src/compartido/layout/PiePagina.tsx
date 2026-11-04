export function PiePagina({ modulo }: { modulo: string }) {
  return (
    <footer className="sl-pie">
      <span>SoftLab · {modulo}</span>
      <span>El historial se conserva en cada cambio.</span>
    </footer>
  )
}
