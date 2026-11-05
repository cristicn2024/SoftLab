import { useState } from 'react'
import { formatoDinero } from './calculosCobro'
import type { DatosFactura, MovimientoBitacora, OrdenPorCobrar, Pago } from './datosCobro'

type Props = {
  orden: OrdenPorCobrar
  total: number
  pagado: number
  pagos: Pago[]
  factura: DatosFactura | null
  bitacora: MovimientoBitacora[]
  folioTicket: string
  puedeCancelar: boolean
  usuario: string
  enviando: boolean
  onRegistrarOtroPago: () => void
  onCancelarPago: (id: number, motivo: string) => Promise<boolean>
  onEnviarTicket: () => void
}

function PanelCancelacion({ pago, usuario, puedeCancelar, enviando, onConfirmar, onCerrar }: {
  pago: Pago
  usuario: string
  puedeCancelar: boolean
  enviando: boolean
  onConfirmar: (motivo: string) => void
  onCerrar: () => void
}) {
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')

  function confirmar() {
    if (!puedeCancelar) {
      setError('Tu rol no tiene permiso especial para cancelar pagos.')
      return
    }
    if (motivo.trim() === '') {
      setError('El motivo es obligatorio.')
      return
    }
    onConfirmar(motivo.trim())
  }

  return (
    <div className="cb-panel cb-no-imprimir" role="dialog" aria-label="Cancelar pago">
      <h3>
        Cancelar pago de {formatoDinero(pago.monto)} ({pago.metodo})
      </h3>
      <p className="cb-ayuda">Requiere permiso especial. Quedará en bitácora con usuario, fecha y motivo; el monto vuelve al saldo de la orden.</p>
      <label className="cb-campo cb-campo-ancho">
        <span>Motivo</span>
        <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. se cobró a la tarjeta equivocada" autoFocus />
        <small>Autoriza: {usuario}</small>
      </label>
      {error !== '' && <p className="cb-texto-error">{error}</p>}
      <div className="cb-acciones">
        <button type="button" className="cb-boton cb-peligro" onClick={confirmar} disabled={enviando}>
          {enviando ? 'Cancelando…' : 'Confirmar cancelación'}
        </button>
        <button type="button" className="cb-boton" onClick={onCerrar}>
          Volver
        </button>
      </div>
    </div>
  )
}

export function ComprobantePago(props: Props) {
  const { orden, total, pagos, factura } = props
  const [cancelando, setCancelando] = useState<Pago | null>(null)

  const pagado = props.pagado
  const saldo = Math.max(total - pagado, 0)
  const pagada = saldo === 0

  let titulo = 'Orden registrada y pagada'
  let detalle = `Folio ${orden.folio} · ${formatoDinero(total)} · registrada por ${props.usuario} en ${orden.sucursal}`
  if (!pagada) {
    titulo = `Orden registrada con saldo pendiente: ${formatoDinero(saldo)}`
    detalle = 'Puede tomarse la muestra y procesarse; los resultados no se entregan hasta liquidar el saldo.'
  }

  const lineasTicket: string[] = []
  for (const concepto of orden.conceptos) lineasTicket.push(`${concepto.clave.padEnd(8)} ${formatoDinero(concepto.precio).padStart(12)}`)
  lineasTicket.push('-'.repeat(21))
  lineasTicket.push(`TOTAL    ${formatoDinero(total).padStart(12)}`)
  for (const pago of pagos) {
    if (!pago.cancelado) lineasTicket.push(`${pago.metodo.slice(0, 8).padEnd(8)} ${formatoDinero(pago.monto).padStart(12)}`)
  }
  lineasTicket.push(`SALDO    ${formatoDinero(saldo).padStart(12)}`)

  const filasPagos = pagos.map((pago) => (
    <tr key={pago.id} className={pago.cancelado ? 'cb-cancelado' : ''}>
      <td>{pago.fecha}</td>
      <td>{pago.metodo}</td>
      <td className="cb-mono">{pago.referencia || '—'}</td>
      <td className="cb-mono cb-derecha">{formatoDinero(pago.monto)}</td>
      <td>{pago.cancelado ? 'Cancelado' : 'Vigente'}</td>
      <td className="cb-no-imprimir">
        {!pago.cancelado && (
          <button type="button" className="cb-boton cb-chico" onClick={() => setCancelando(pago)}>
            Cancelar pago
          </button>
        )}
      </td>
    </tr>
  ))

  const filasBitacora = props.bitacora.map((m, i) => (
    <tr key={i}>
      <td>{m.fecha}</td>
      <td>{m.usuario}</td>
      <td>{m.accion}</td>
      <td>{m.detalle}</td>
    </tr>
  ))

  return (
    <div className="cb-columna">
      <div className={pagada ? 'cb-banner cb-banner-ok' : 'cb-banner cb-banner-pendiente'} role="status">
        <b>{pagada ? 'PAGADA' : 'PENDIENTE'}</b>
        <div>
          <strong>{titulo}</strong>
          <p>{detalle}</p>
        </div>
        {!pagada && (
          <button type="button" className="cb-boton cb-primario cb-no-imprimir" onClick={props.onRegistrarOtroPago}>
            Registrar pago
          </button>
        )}
      </div>

      <div className="cb-rejilla">
        <section className="cb-tarjeta">
          <h2>Pagos de la orden</h2>
          <table className="cb-tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Método</th>
                <th>Referencia</th>
                <th className="cb-derecha">Monto</th>
                <th>Estado</th>
                <th className="cb-no-imprimir"></th>
              </tr>
            </thead>
            <tbody>{filasPagos}</tbody>
          </table>
          {pagos.length === 0 && <p className="cb-ayuda">Aún no hay pagos registrados para esta orden.</p>}
          {factura !== null && (
            <p className="cb-ayuda">
              Datos de facturación: {factura.rfc} · {factura.razonSocial} · C.P. {factura.codigoPostal} · {factura.usoCfdi}
            </p>
          )}
        </section>

        <aside className="cb-tarjeta cb-ticket" aria-label="Comprobante de pago">
          <span>LABORATORIO SANTA LUCÍA</span>
          <span>{orden.sucursal}</span>
          <span>Ticket {props.folioTicket}</span>
          <span>Orden {orden.folio}</span>
          <span>{orden.paciente}</span>
          <pre>{lineasTicket.join('\n')}</pre>
          <span>ESTADO: {pagada ? 'PAGADO' : 'PENDIENTE'}</span>
        </aside>
      </div>

      {cancelando !== null && (
        <PanelCancelacion
          pago={cancelando}
          usuario={props.usuario}
          puedeCancelar={props.puedeCancelar}
          enviando={props.enviando}
          onCerrar={() => setCancelando(null)}
          onConfirmar={async (motivo) => {
            const listo = await props.onCancelarPago(cancelando.id, motivo)
            if (listo) setCancelando(null)
          }}
        />
      )}

      <div className="cb-acciones cb-no-imprimir">
        <button type="button" className="cb-boton cb-primario" onClick={() => window.print()}>
          Imprimir ticket
        </button>
        <button type="button" className="cb-boton" onClick={props.onEnviarTicket}>
          Enviar ticket
        </button>
      </div>

      <section className="cb-tarjeta cb-no-imprimir">
        <h2>Bitácora de cobro</h2>
        <table className="cb-tabla">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Usuario</th>
              <th>Acción</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>{filasBitacora}</tbody>
        </table>
      </section>
    </div>
  )
}
