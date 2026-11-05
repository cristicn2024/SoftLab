import { useEffect, useState } from 'react'
import { mensajeDeError } from '../../compartido/api'
import { obtenerLista } from './servicio'
import type { ListaDeTrabajo } from './tipos'

type Estado = {
  cargando: boolean
  lista: ListaDeTrabajo | null
  error: string
}

export function useListaDeTrabajo(): Estado {
  const [estado, setEstado] = useState<Estado>({ cargando: true, lista: null, error: '' })

  useEffect(() => {
    let activo = true

    async function cargar() {
      try {
        const lista = await obtenerLista()
        if (activo) setEstado({ cargando: false, lista, error: '' })
      } catch (error) {
        if (activo) setEstado({ cargando: false, lista: null, error: mensajeDeError(error) })
      }
    }

    void cargar()
    return () => {
      activo = false
    }
  }, [])

  return estado
}
