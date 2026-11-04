import { useEffect, useState } from 'react'

export function Aviso({ mensaje }: { mensaje: string }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const temporizador = setTimeout(() => setVisible(false), 4000)
    return () => clearTimeout(temporizador)
  }, [])

  if (!visible) return null

  return (
    <div className="sl-aviso" role="status">
      {mensaje}
    </div>
  )
}