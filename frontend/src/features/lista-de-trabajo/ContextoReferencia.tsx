import { useState, type FormEvent } from 'react'
import { api } from '../../services/api'
import { SESION } from '../../compartido/sesion'

export type ContextoReferencia = { processedAt: string | null; condition: string; weeks: number | null }

function fechaLocal(value: string | null) {
  const date = value ? new Date(value) : new Date()
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export function FormularioContextoReferencia({ orderId, context, locked, onSaved }: {
  orderId: number; context: ContextoReferencia; locked: boolean; onSaved: () => Promise<void>
}) {
  const [date, setDate] = useState(() => fechaLocal(context.processedAt))
  const [condition, setCondition] = useState(context.condition)
  const [weeks, setWeeks] = useState(context.weeks === null ? '' : String(context.weeks))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const authorized = ['admin', 'chemist', 'Administradora', 'Administrador', 'Químico', 'Química'].includes(SESION.rol)

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setMessage('')
    try {
      await api.post(`/referencias/ordenes/${orderId}/contexto`, {
        processedAt: new Date(date).toISOString(), condition, weeks: weeks === '' ? null : Number(weeks),
      }, { headers: { 'x-user-name': encodeURIComponent(SESION.usuario), 'x-user-role': encodeURIComponent(SESION.rol) } })
      await onSaved()
      setMessage('Contexto guardado. Referencias recalculadas para la fecha de procesamiento.')
    } catch (error) {
      const body = (error as { response?: { data?: { message?: string; error?: { mensaje?: string } } } }).response?.data
      setMessage(body?.message ?? body?.error?.mensaje ?? 'No se pudo guardar el contexto.')
    } finally { setBusy(false) }
  }

  return <section className="meta-card" style={{ display: 'block', marginBottom: 20 }}>
    <h2>Contexto para valores de referencia</h2>
    <p>Registra la fecha real de procesamiento y la condición del paciente en esta orden antes de capturar resultados.</p>
    <form onSubmit={save}>
      <fieldset disabled={locked || busy || !authorized} style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <legend>Procesamiento y condición</legend>
        <label>Fecha de procesamiento <input required type="datetime-local" value={date} onChange={e => setDate(e.target.value)} /></label>
        <label>Condición especial <input maxLength={100} placeholder="Ej. embarazo; vacío = general" value={condition} onChange={e => { setCondition(e.target.value); if (!e.target.value.trim()) setWeeks('') }} /></label>
        <label>Semanas de embarazo <input type="number" min="0" max="45" step="1" disabled={!condition.trim()} value={weeks} onChange={e => setWeeks(e.target.value)} /></label>
        <button type="submit">Aplicar contexto y recalcular rangos</button>
      </fieldset>
    </form>
    {locked && <p>El contexto se conserva y queda bloqueado tras la primera captura.</p>}
    {!context.processedAt && !locked && <p>Si no aplicas una fecha, se utilizará y conservará la hora de la primera captura.</p>}
    {message && <p role="status">{message}</p>}
  </section>
}
