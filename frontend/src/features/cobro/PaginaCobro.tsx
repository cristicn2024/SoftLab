import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Aviso } from '../../compartido/Aviso'
import { Cargando } from '../../compartido/Cargando'
import { MensajeError } from '../../compartido/MensajeError'
import { SESION } from '../../compartido/sesion'
import { cancelarPago, mensajeDeError, obtenerCobro, registrarPagos } from './cobroApi'
import { ComprobantePago } from './ComprobantePago'
import { ROLES_CON_PERMISO_ESPECIAL } from './datosCobro'
import type { CobroOrden } from './datosCobro'
import { FormularioCobro } from './FormularioCobro'
import type { EnvioCobro } from './FormularioCobro'
import './cobro.css'

// HU 5.3 · Total y estado de pago
// La orden se elige con ?orden=ID en la URL (por defecto la 1, que viene en los datos de prueba).
type Vista = 'cobro' | 'registrada'

export default function PaginaCobro() {
  const [parametros] = useSearchParams()
  const ordenId = Number(parametros.get('orden') ?? '1')
  const puedeAutorizar = ROLES_CON_PERMISO_ESPECIAL.includes(SESION.rol)

  const [datos, setDatos] = useState<CobroOrden | null>(null)
  const [errorCarga, setErrorCarga] = useState('')
  const [errorAccion, setErrorAccion] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [vista, setVista] = useState<Vista>('cobro')
  const [aviso, setAviso] = useState({ texto: '', clave: 0 })

  useEffect(() => {
    let vigente = true
    obtenerCobro(ordenId)
      .then((respuesta) => {
        if (!vigente) return
        setDatos(respuesta)
        setErrorCarga('')
        // Si la orden ya tiene pagos, se abre directo en su comprobante.
        if (respuesta.pagos.length > 0) setVista('registrada')
      })
      .catch((error: unknown) => {
        if (vigente) setErrorCarga(mensajeDeError(error))
      })
    return () => {
      vigente = false
    }
  }, [ordenId])

  function mostrarAviso(texto: string) {
    setAviso({ texto, clave: aviso.clave + 1 })
  }

  async function guardar(envio: EnvioCobro, dejarPendiente: boolean) {
    setEnviando(true)
    setErrorAccion('')
    try {
      const respuesta = await registrarPagos(ordenId, envio, dejarPendiente)
      setDatos(respuesta)
      setVista('registrada')
    } catch (error) {
      setErrorAccion(mensajeDeError(error))
    } finally {
      setEnviando(false)
    }
  }

  async function cancelar(pagoId: number, motivo: string): Promise<boolean> {
    setEnviando(true)
    setErrorAccion('')
    try {
      const respuesta = await cancelarPago(pagoId, motivo)
      setDatos(respuesta)
      mostrarAviso('Pago cancelado y registrado en bitácora.')
      return true
    } catch (error) {
      setErrorAccion(mensajeDeError(error))
      return false
    } finally {
      setEnviando(false)
    }
  }

  if (errorCarga !== '') {
    return (
      <main className="sl-pagina cb-pagina">
        <div className="sl-migas">Recepción / Nueva orden / Cobro</div>
        <h1>Cobro de la orden</h1>
        <MensajeError mensaje={errorCarga} />
      </main>
    )
  }

  if (datos === null) {
    return (
      <main className="sl-pagina cb-pagina">
        <Cargando mensaje="Cargando la orden…" />
      </main>
    )
  }

  const { orden } = datos
  let titulo = 'Cobro de la orden'
  if (vista === 'registrada') titulo = `Orden ${orden.folio}`

  return (
    <main className="sl-pagina cb-pagina">
      <div className="sl-migas">Recepción / Nueva orden / Cobro</div>
      <h1>{titulo}</h1>
      <p className="sl-subtitulo">
        {orden.paciente} · {orden.expediente} · {orden.edad} años · {orden.sexo} · {orden.medico}
      </p>

      {errorAccion !== '' && <MensajeError mensaje={errorAccion} />}

      {vista === 'cobro' && (
        <FormularioCobro
          orden={orden}
          pagadoAntes={datos.pagado}
          descuentoInicial={datos.descuento}
          facturaInicial={datos.factura}
          puedeAutorizar={puedeAutorizar}
          usuario={SESION.usuario}
          enviando={enviando}
          onRegistrar={(envio) => guardar(envio, false)}
          onDejarPendiente={(envio) => guardar(envio, true)}
        />
      )}

      {vista === 'registrada' && (
        <ComprobantePago
          orden={orden}
          total={datos.total}
          pagado={datos.pagado}
          pagos={datos.pagos}
          factura={datos.factura}
          bitacora={datos.bitacora}
          folioTicket={'T-' + orden.folio.slice(3)}
          puedeCancelar={puedeAutorizar}
          usuario={SESION.usuario}
          enviando={enviando}
          onRegistrarOtroPago={() => {
            setErrorAccion('')
            setVista('cobro')
          }}
          onCancelarPago={cancelar}
          onEnviarTicket={() => mostrarAviso('Ticket enviado al correo de la paciente.')}
        />
      )}

      {aviso.texto !== '' && <Aviso key={aviso.clave} mensaje={aviso.texto} />}
    </main>
  )
}
