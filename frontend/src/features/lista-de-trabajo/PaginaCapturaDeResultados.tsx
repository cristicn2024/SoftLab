import { FormularioContextoReferencia } from './ContextoReferencia'
import { Fragment } from 'react'
import type { KeyboardEvent } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Aviso } from '../../compartido/Aviso'
import { Cargando } from '../../compartido/Cargando'
import { horaDe, palabraSexo, tituloDeRango, unirConY } from '../../compartido/formato'
import { MensajeError } from '../../compartido/MensajeError'
import { ResultFlag } from '../../components/ResultFlag'
import { banderaEnVivo, claveDe, esBanderaCritica, hayParametrosSinRango, NOTIFICACION_INICIAL, nombresDeEstudios } from './captura'
import { RUTA_LISTA } from './rutas'
import type { DestinatarioCritico, MedioDeContacto, OrdenDeLista } from './tipos'
import { useCapturaDeResultados } from './useCapturaDeResultados'

function claseDeEntrada(bandera: string | null): string {
  if (bandera === null || bandera === 'Normal' || bandera === '—') return 'result-input'
  if (bandera === 'HH' || bandera === 'LL') return 'result-input abnormal critical-input'
  return 'result-input abnormal'
}

function textoDeMuestra(orden: OrdenDeLista): string {
  if (orden.samples.length === 0) return `Muestra · recibida ${horaDe(orden.receivedAt)}`
  const primera = orden.samples[0]
  return `${primera.description ?? primera.barcode} · recibida ${horaDe(orden.receivedAt)}`
}

function CapturaDeOrden({ idOrden }: { idOrden: number }) {
  const { recargarContexto, estado, valores, notificaciones, guardando, mensaje, aviso, cambiarValor, cambiarNotificacion, guardar } =
    useCapturaDeResultados(idOrden)
  const ubicacion = useLocation()
  const estadoDeNavegacion = ubicacion.state as { aviso?: string } | null

  if (estado.cargando) {
    return (
      <main className="content">
        <Cargando mensaje="Cargando orden…" />
      </main>
    )
  }

  if (estado.orden === null) {
    return (
      <main className="content">
        <MensajeError mensaje={estado.error} />
        <Link className="outline" to={RUTA_LISTA}>
          Volver a la lista
        </Link>
      </main>
    )
  }

  const orden = estado.orden
  const pendientes = orden.pending
  const primeraMuestra = orden.samples[0]

  let equipo = '—'
  let capturista = '—'
  if (primeraMuestra !== undefined) {
    equipo = primeraMuestra.equipment ?? '—'
    capturista = primeraMuestra.capturedByName ?? '—'
  }

  let codigo = ''
  if (orden.patient.patientCode) codigo = `${orden.patient.patientCode} · `

  function manejarTecla(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key !== 'Enter') return
    evento.preventDefault()

    if (evento.ctrlKey || evento.metaKey) {
      void guardar(true)
      return
    }

    const fila = evento.currentTarget.closest('tr')
    const siguiente = fila?.nextElementSibling?.querySelector('input')
    if (siguiente) siguiente.focus()
  }

  const filas = []
  for (let indice = 0; indice < pendientes.length; indice++) {
    const parametro = pendientes[indice]
    const clave = claveDe(parametro)
    const texto = valores[clave] ?? ''
    const bandera = banderaEnVivo(texto, parametro.rule)

    const notificacion = notificaciones[clave] ?? NOTIFICACION_INICIAL

    filas.push(
      <Fragment key={clave}>
      <tr>
        <td>{parametro.parameterName}</td>
        <td>
          <input
            className={claseDeEntrada(bandera)}
            aria-label={`Resultado ${parametro.parameterName}`}
            inputMode="decimal"
            autoComplete="off"
            autoFocus={indice === 0}
            readOnly={guardando}
            value={texto}
            onChange={(evento) => cambiarValor(clave, evento.target.value)}
            onKeyDown={manejarTecla}
          />
        </td>
        <td>{parametro.unit ?? '—'}</td>
        <td>{parametro.rangeText ?? 'Sin rango'}</td>
        <td>{bandera !== null && <ResultFlag value={bandera} />}</td>
        <td className="mono muted">{parametro.previous ?? '—'}</td>
      </tr>
      {esBanderaCritica(bandera) && (
        <tr className="critical-notification">
          <td colSpan={6}>
            <fieldset disabled={guardando}>
              <legend>Notificación del valor crítico (obligatoria para guardar)</legend>
              <label>
                Notificado a
                <select
                  aria-label={`Notificado a (${parametro.parameterName})`}
                  value={notificacion.recipient}
                  onChange={(evento) => cambiarNotificacion(clave, { recipient: evento.target.value as DestinatarioCritico })}
                >
                  <option value="doctor">Médico</option>
                  <option value="patient">Paciente</option>
                </select>
              </label>
              <label>
                Nombre
                <input
                  aria-label={`Nombre de quien se notificó (${parametro.parameterName})`}
                  autoComplete="off"
                  maxLength={150}
                  value={notificacion.recipientName}
                  onChange={(evento) => cambiarNotificacion(clave, { recipientName: evento.target.value })}
                />
              </label>
              <label>
                Medio
                <select
                  aria-label={`Medio de contacto (${parametro.parameterName})`}
                  value={notificacion.contactMethod}
                  onChange={(evento) => cambiarNotificacion(clave, { contactMethod: evento.target.value as MedioDeContacto })}
                >
                  <option value="phone">Teléfono</option>
                  <option value="email">Correo</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="in_person">En persona</option>
                </select>
              </label>
              <small>Se registra con la fecha y hora en que guardas.</small>
            </fieldset>
          </td>
        </tr>
      )}
      </Fragment>,
    )
  }

  return (
    <main className="content results">
      <div className="crumb">Resultados / Captura de resultados / {orden.folio}</div>
      <h1>Captura de resultados</h1>
      <p className="subtitle">
        {orden.patient.fullName} · {codigo}
        {orden.patient.ageYears} años · {palabraSexo(orden.patient.gender)} · {unirConY(nombresDeEstudios(orden))}
      </p>
      <div className="page-actions">
        <Link className="outline" to={RUTA_LISTA}>
          Volver a la lista
        </Link>
        <button type="button" className="outline" disabled>
          Bitácora del resultado
        </button>
      </div>

      {orden.referenceContext && <FormularioContextoReferencia orderId={idOrden} context={orden.referenceContext} locked={orden.capturedCount > 0} onSaved={recargarContexto} />}

      {hayParametrosSinRango(pendientes) && (
        <div className="range-alert" role="status">
          <b>SIN RANGO</b>
          <div>
            <strong>No hay un rango de referencia compatible con sexo y edad para todos los parámetros.</strong>
            <p>Se permite capturar; los valores sin rango compatible no reciben interpretación automática.</p>
          </div>
        </div>
      )}

      {mensaje !== '' && (
        <div className="range-alert critical" role="alert">
          <b>REVISA</b>
          <div>
            <strong>{mensaje}</strong>
          </div>
        </div>
      )}

      <div className="meta-card">
        <div>
          <small>Folio</small>
          <b>{orden.folio}</b>
        </div>
        <div>
          <small>Muestra</small>
          <b>{textoDeMuestra(orden)}</b>
        </div>
        <div>
          <small>Equipo</small>
          <b>{equipo}</b>
        </div>
        <div>
          <small>Capturista</small>
          <b>{capturista}</b>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>PARÁMETRO</th>
              <th>RESULTADO</th>
              <th>UNIDAD</th>
              <th>{tituloDeRango(orden.patient.gender, orden.patient.ageYears)}</th>
              <th>BANDERA</th>
              <th>ANTERIOR</th>
            </tr>
          </thead>
          <tbody>{filas}</tbody>
        </table>
      </div>

      <div className="actions footer-actions">
        <button type="button" className="primary" disabled={guardando} onClick={() => void guardar(true)}>
          Guardar y siguiente
        </button>
        <kbd>Ctrl + Enter</kbd>
        <button type="button" className="outline" disabled={guardando} onClick={() => void guardar(false)}>
          Guardar
        </button>
        <span>Enter avanza al siguiente parámetro.</span>
      </div>

      {aviso !== null && <Aviso key={aviso.id} mensaje={aviso.texto} />}
      {aviso === null && estadoDeNavegacion?.aviso && <Aviso mensaje={estadoDeNavegacion.aviso} />}
    </main>
  )
}

export default function PaginaCapturaDeResultados() {
  const { idOrden } = useParams()
  const id = Number(idOrden)

  if (!Number.isInteger(id) || id <= 0) {
    return (
      <main className="content">
        <MensajeError mensaje="El identificador de la orden no es válido." />
        <Link className="outline" to={RUTA_LISTA}>
          Volver a la lista
        </Link>
      </main>
    )
  }

  return <CapturaDeOrden key={id} idOrden={id} />
}
