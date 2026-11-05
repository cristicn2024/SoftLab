import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { mensajeDeError } from '../../compartido/api'
import { armarEntradas, siguienteOrden } from './captura'
import { RUTA_LISTA, rutaDeCaptura } from './rutas'
import { guardarResultados, obtenerLista, obtenerOrden } from './servicio'
import type { OrdenDeLista } from './tipos'

type Estado = {
  cargando: boolean
  orden: OrdenDeLista | null
  error: string
}

type Aviso = {
  id: number
  texto: string
}

const AVISO_GUARDADO = 'Resultados guardados.'

export function useCapturaDeResultados(idOrden: number) {
  const navigate = useNavigate()
  const [estado, setEstado] = useState<Estado>({ cargando: true, orden: null, error: '' })
  const [valores, setValores] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [aviso, setAviso] = useState<Aviso | null>(null)

  useEffect(() => {
    let activo = true

    async function cargar() {
      try {
        const orden = await obtenerOrden(idOrden)
        if (activo) setEstado({ cargando: false, orden, error: '' })
      } catch (error) {
        if (activo) setEstado({ cargando: false, orden: null, error: mensajeDeError(error) })
      }
    }

    void cargar()
    return () => {
      activo = false
    }
  }, [idOrden])

  function cambiarValor(clave: string, texto: string) {
    setValores({ ...valores, [clave]: texto })
    if (mensaje !== '') setMensaje('')
  }

  function volverALista(texto: string | null) {
    if (texto === null) {
      navigate(RUTA_LISTA)
      return
    }
    navigate(RUTA_LISTA, { state: { aviso: texto } })
  }

  async function guardar(irASiguiente: boolean) {
    if (estado.orden === null || guardando) return

    const armado = armarEntradas(estado.orden.pending, valores)
    if (!armado.ok) {
      setMensaje(armado.mensaje)
      return
    }

    setGuardando(true)
    try {
      let antes: OrdenDeLista[] = []
      if (irASiguiente) {
        const listaPrevia = await obtenerLista()
        antes = listaPrevia.orders
      }

      await guardarResultados(idOrden, armado.entradas)

      if (irASiguiente) {
        const listaNueva = await obtenerLista()
        const siguiente = siguienteOrden(antes, listaNueva.orders, idOrden)
        if (siguiente === null) {
          volverALista(AVISO_GUARDADO)
          return
        }
        navigate(rutaDeCaptura(siguiente), { state: { aviso: AVISO_GUARDADO } })
        return
      }

      const ordenActualizada = await obtenerOrden(idOrden)
      if (ordenActualizada.pending.length === 0) {
        volverALista(AVISO_GUARDADO)
        return
      }
      setEstado({ cargando: false, orden: ordenActualizada, error: '' })
      setValores({})
      setAviso({ id: Date.now(), texto: AVISO_GUARDADO })
    } catch (error) {
      setMensaje(mensajeDeError(error))
    } finally {
      setGuardando(false)
    }
  }

  return { estado, valores, guardando, mensaje, aviso, cambiarValor, guardar, volverALista }
}
