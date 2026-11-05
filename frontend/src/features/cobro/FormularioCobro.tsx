import { useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { aCentavos, calcularTotales, formatoDinero, rfcValido } from './calculosCobro'
import type { MontosCaptura, Totales } from './calculosCobro'
import { PORCENTAJES_DESCUENTO, TASA_IMPUESTO } from './datosCobro'
import type { DatosFactura, Descuento, OrdenPorCobrar } from './datosCobro'

export type EnvioCobro = {
  captura: MontosCaptura
  totales: Totales
  descuento: Descuento
  factura: DatosFactura | null
  referenciaTarjeta: string
  referenciaTransferencia: string
}

type Props = {
  orden: OrdenPorCobrar
  pagadoAntes: number
  descuentoInicial: Descuento
  facturaInicial: DatosFactura | null
  puedeAutorizar: boolean
  usuario: string
  enviando: boolean
  onRegistrar: (envio: EnvioCobro) => void
  onDejarPendiente: (envio: EnvioCobro) => void
}

function Renglon({ etiqueta, valor, fuerte }: { etiqueta: string; valor: string; fuerte?: boolean }) {
  let clase = 'cb-renglon'
  if (fuerte) clase = 'cb-renglon cb-renglon-fuerte'
  return (
    <div className={clase}>
      <span>{etiqueta}</span>
      <span>{valor}</span>
    </div>
  )
}

export function FormularioCobro(props: Props) {
  const { orden, pagadoAntes, puedeAutorizar, enviando } = props

  const [efectivo, setEfectivo] = useState('')
  const [tarjeta, setTarjeta] = useState('')
  const [referenciaTarjeta, setReferenciaTarjeta] = useState('')
  const [transferencia, setTransferencia] = useState('')
  const [referenciaTransferencia, setReferenciaTransferencia] = useState('')
  const [porcentaje, setPorcentaje] = useState(props.descuentoInicial.porcentaje)
  const [motivoDescuento, setMotivoDescuento] = useState(props.descuentoInicial.motivo)
  const [requiereFactura, setRequiereFactura] = useState(props.facturaInicial !== null)
  const [rfc, setRfc] = useState(props.facturaInicial?.rfc ?? '')
  const [razonSocial, setRazonSocial] = useState(props.facturaInicial?.razonSocial ?? '')
  const [codigoPostal, setCodigoPostal] = useState(props.facturaInicial?.codigoPostal ?? '')
  const [usoCfdi, setUsoCfdi] = useState(props.facturaInicial?.usoCfdi ?? 'D01 · Honorarios médicos y gastos hospitalarios')
  const [errores, setErrores] = useState<string[]>([])

  const captura: MontosCaptura = {
    efectivo: aCentavos(efectivo),
    tarjeta: aCentavos(tarjeta),
    transferencia: aCentavos(transferencia),
  }
  const totales = calcularTotales(orden.conceptos, porcentaje, TASA_IMPUESTO, captura, pagadoAntes)

  function armarEnvio(): EnvioCobro {
    let factura: DatosFactura | null = null
    if (requiereFactura) {
      factura = { rfc: rfc.trim().toUpperCase(), razonSocial: razonSocial.trim(), codigoPostal: codigoPostal.trim(), usoCfdi }
    }
    let autorizo = ''
    if (porcentaje > 0) autorizo = props.usuario
    return {
      captura,
      totales,
      descuento: { porcentaje, motivo: motivoDescuento.trim(), autorizo },
      factura,
      referenciaTarjeta: referenciaTarjeta.trim(),
      referenciaTransferencia: referenciaTransferencia.trim(),
    }
  }

  function validar(exigirPago: boolean): string[] {
    const lista: string[] = []
    if (exigirPago && totales.pagadoAhora === 0) lista.push('Captura al menos un monto para registrar el pago.')
    if (totales.excedeConTarjeta) lista.push('Tarjeta y transferencia no pueden sumar más que el saldo por cobrar.')
    if (captura.tarjeta > 0 && referenciaTarjeta.trim() === '') lista.push('Escribe el número de autorización de la tarjeta.')
    if (captura.transferencia > 0 && referenciaTransferencia.trim() === '') lista.push('Escribe la referencia de la transferencia.')
    if (porcentaje > 0 && !puedeAutorizar) lista.push('Tu rol no tiene permiso para aplicar descuentos.')
    if (porcentaje > 0 && motivoDescuento.trim() === '') lista.push('El descuento requiere un motivo.')
    if (requiereFactura) {
      if (!rfcValido(rfc)) lista.push('El RFC no tiene un formato válido (ej. LOGM880312AB1).')
      if (razonSocial.trim() === '') lista.push('Escribe el nombre o razón social para la factura.')
      if (!/^\d{5}$/.test(codigoPostal.trim())) lista.push('El código postal fiscal debe tener 5 dígitos.')
    }
    return lista
  }

  function registrar(evento?: FormEvent) {
    if (evento) evento.preventDefault()
    if (enviando) return
    const lista = validar(true)
    setErrores(lista)
    if (lista.length === 0) props.onRegistrar(armarEnvio())
  }

  function dejarPendiente() {
    if (enviando) return
    const lista = validar(false)
    setErrores(lista)
    if (lista.length === 0) props.onDejarPendiente(armarEnvio())
  }

  function atajos(evento: KeyboardEvent<HTMLFormElement>) {
    if (evento.key === 'Enter' && (evento.ctrlKey || evento.metaKey)) {
      evento.preventDefault()
      registrar()
    }
  }

  const filas = orden.conceptos.map((concepto) => (
    <tr key={concepto.clave}>
      <td>{concepto.nombre}</td>
      <td className="cb-mono">{concepto.clave}</td>
      <td className="cb-mono cb-derecha">{formatoDinero(concepto.precio)}</td>
    </tr>
  ))

  let textoDescuento = 'Sin descuento'
  if (totales.descuento > 0) textoDescuento = '–' + formatoDinero(totales.descuento)

  let claseSaldo = 'cb-saldo'
  if (totales.saldo > 0) claseSaldo = 'cb-saldo cb-saldo-pendiente'

  return (
    <form className="cb-rejilla" onSubmit={registrar} onKeyDown={atajos} noValidate>
      <div className="cb-columna">
        <section className="cb-tarjeta">
          <h2>Resumen de la orden</h2>
          <table className="cb-tabla">
            <thead>
              <tr>
                <th>Estudio o perfil</th>
                <th>Clave</th>
                <th className="cb-derecha">Precio</th>
              </tr>
            </thead>
            <tbody>{filas}</tbody>
          </table>
        </section>

        <section className="cb-tarjeta">
          <h2>Pagos</h2>
          <p className="cb-ayuda">Puedes combinar métodos. El efectivo cubre lo que falte y el sistema calcula el cambio.</p>
          <div className="cb-campos">
            <label className="cb-campo">
              <span>Efectivo recibido</span>
              <input inputMode="decimal" placeholder="$0.00" value={efectivo} onChange={(e) => setEfectivo(e.target.value)} autoFocus />
              <small>
                Se aplican {formatoDinero(totales.efectivoAplicado)} · cambio {formatoDinero(totales.cambio)}
              </small>
            </label>
            <label className="cb-campo">
              <span>Tarjeta</span>
              <input inputMode="decimal" placeholder="$0.00" value={tarjeta} onChange={(e) => setTarjeta(e.target.value)} />
              <input placeholder="Núm. de autorización" value={referenciaTarjeta} onChange={(e) => setReferenciaTarjeta(e.target.value)} />
            </label>
            <label className="cb-campo">
              <span>Transferencia</span>
              <input inputMode="decimal" placeholder="$0.00" value={transferencia} onChange={(e) => setTransferencia(e.target.value)} />
              <input placeholder="Referencia o clave de rastreo" value={referenciaTransferencia} onChange={(e) => setReferenciaTransferencia(e.target.value)} />
            </label>
          </div>

          <div className="cb-campos">
            <label className="cb-campo">
              <span>Descuento</span>
              <select value={porcentaje} onChange={(e) => setPorcentaje(Number(e.target.value))} disabled={!puedeAutorizar}>
                {PORCENTAJES_DESCUENTO.map((p) => (
                  <option key={p} value={p}>
                    {p === 0 ? 'Sin descuento' : p + '%'}
                  </option>
                ))}
              </select>
              <small>{puedeAutorizar ? 'Requiere permiso y motivo; queda en bitácora.' : 'Tu rol no puede aplicar descuentos.'}</small>
            </label>
            {porcentaje > 0 && (
              <label className="cb-campo cb-campo-ancho">
                <span>Motivo del descuento</span>
                <input placeholder="Ej. cortesía autorizada por dirección" value={motivoDescuento} onChange={(e) => setMotivoDescuento(e.target.value)} />
                <small>Autoriza: {props.usuario}</small>
              </label>
            )}
          </div>

          <label className="cb-check">
            <input type="checkbox" checked={requiereFactura} onChange={(e) => setRequiereFactura(e.target.checked)} />
            La paciente requiere factura
          </label>
          {requiereFactura && (
            <div className="cb-campos">
              <label className="cb-campo">
                <span>RFC</span>
                <input value={rfc} onChange={(e) => setRfc(e.target.value)} placeholder="LOGM880312AB1" />
              </label>
              <label className="cb-campo">
                <span>Nombre o razón social</span>
                <input value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} />
              </label>
              <label className="cb-campo">
                <span>C.P. fiscal</span>
                <input inputMode="numeric" value={codigoPostal} onChange={(e) => setCodigoPostal(e.target.value)} />
              </label>
              <label className="cb-campo">
                <span>Uso del CFDI</span>
                <input value={usoCfdi} onChange={(e) => setUsoCfdi(e.target.value)} />
                <small>Los datos se guardan con la orden; la factura se emite fuera de SoftLab.</small>
              </label>
            </div>
          )}
        </section>

        {errores.length > 0 && (
          <div className="sl-error" role="alert">
            <b>REVISA</b>
            <ul className="cb-errores">
              {errores.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="cb-ayuda">
          Se puede pagar antes o después de la toma y el análisis, pero nunca después de entregar resultados. El pago se registra en la caja de {orden.sucursal}.
        </p>

        <div className="cb-acciones">
          <button type="submit" className="cb-boton cb-primario" disabled={enviando}>
            {enviando ? 'Guardando…' : 'Registrar pago'}
          </button>
          <kbd className="cb-atajo">Ctrl + Enter</kbd>
          <button type="button" className="cb-boton" onClick={dejarPendiente} disabled={enviando}>
            Dejar pendiente de pago
          </button>
        </div>
      </div>

      <aside className="cb-tarjeta cb-totales" aria-live="polite">
        <h2>Total</h2>
        <Renglon etiqueta="Subtotal" valor={formatoDinero(totales.subtotal)} />
        <Renglon etiqueta={porcentaje > 0 ? `Descuento (${porcentaje}%)` : 'Descuento'} valor={textoDescuento} />
        <Renglon etiqueta={TASA_IMPUESTO === 0 ? 'Impuestos (exento)' : `IVA (${TASA_IMPUESTO}%)`} valor={formatoDinero(totales.impuestos)} />
        <Renglon etiqueta="Total" valor={formatoDinero(totales.total)} fuerte />
        {totales.pagadoAntes > 0 && <Renglon etiqueta="Pagado anteriormente" valor={formatoDinero(totales.pagadoAntes)} />}
        <Renglon etiqueta="Pago en esta captura" valor={formatoDinero(totales.pagadoAhora)} />
        <Renglon etiqueta="Cambio en efectivo" valor={formatoDinero(totales.cambio)} />
        <div className={claseSaldo}>
          <span>Saldo pendiente</span>
          <span>{formatoDinero(totales.saldo)}</span>
        </div>
        {totales.saldo > 0 && totales.pagadoAhora > 0 && <p className="cb-ayuda">Es un pago parcial: la orden quedará como pendiente.</p>}
      </aside>
    </form>
  )
}
