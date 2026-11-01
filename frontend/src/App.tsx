import { useEffect, useState } from 'react'
import { consolidateInstructions, canContinueToCheckout } from './features/orders/indications'
import { calculateLipids, canSaveResult, interpretResult, selectRange, type Flag } from './features/results/interpretation'
import { ResultFlag } from './features/results/ResultFlag'
import './App.css'

const API = 'http://localhost:4000/api'
type AnyRecord = Record<string, any>
const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

export default function App() {
  const [data, setData] = useState<AnyRecord | null>(null)
  const [error, setError] = useState('')
  const [view, setView] = useState(location.pathname.startsWith('/cobro/') ? 'checkout' : location.pathname.includes('/resultados') ? 'results' : 'order')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<number[]>([])
  const [confirmed, setConfirmed] = useState(false)
  const [observation, setObservation] = useState('')
  const [notice, setNotice] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [notification, setNotification] = useState<AnyRecord | null>(null)
  const [draftOrderId, setDraftOrderId] = useState<number | null>(null)

  useEffect(() => { fetch(`${API}/feature-data`).then(async (response) => { if (!response.ok) throw new Error((await response.json()).error); return response.json() }).then((result) => { setData(result); setConfirmed(false); setObservation(''); setSelected(result.tests.filter((test: AnyRecord) => ['GLU001', 'BH001', 'PERF02', 'EG0001'].includes(test.code)).map((test: AnyRecord) => test.id)) }).catch((reason: Error) => setError(reason.message)) }, [])
  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === 'F2') { event.preventDefault(); setConfirmed((previous) => !previous) }
      if (event.ctrlKey && event.key === 'Enter') { event.preventDefault(); if (view === 'order') void continueOrder(); else void saveResults() }
      if (view === 'order' && event.key === 'Enter' && (document.activeElement as HTMLElement)?.id === 'study-search') { event.preventDefault(); addFirstMatch() }
    }
    window.addEventListener('keydown', keyHandler)
    return () => window.removeEventListener('keydown', keyHandler)
  })

  if (error) return <main className="load-error"><h1>SoftLab</h1><p>{error}</p><p>Levanta la API y ejecuta el seed HU 5.2/6.2.</p></main>
  if (!data) return <main className="load-error">Cargando SoftLab…</main>
  const order = data.orders?.[0]
  const patient = order?.patient ?? data.patients?.[0]
  const age = patient?.birthDate ? ageAt(new Date(patient.birthDate)) : 38
  const patientName = patient ? `${patient.firstName} ${patient.lastName}` : ''
  const genderLabel = patient?.gender === 'F' ? 'Mujer' : patient?.gender === 'M' ? 'Hombre' : 'Otro'
  const rangeLabel = `${genderLabel.toUpperCase()} ${age >= 18 ? (patient?.gender === 'F' ? 'ADULTA' : 'ADULTO') : 'PEDIÁTRICO'}`
  const branchName = order?.branch?.name ?? data.branches?.[0]?.name ?? ''
  const tests: AnyRecord[] = data.tests ?? []
  const chosen = selected.map((id) => tests.find((test) => test.id === id)).filter(Boolean) as AnyRecord[]
  const existingItems = order?.items ?? []
  const orderTests: AnyRecord[] = view === 'order' ? chosen : existingItems.map((item: AnyRecord) => item.test)
  const allInstructions = orderTests.flatMap((test) => (test.instructions ?? []).map((item: AnyRecord) => ({ ...item, study: test.name })))
  const consolidated = consolidateInstructions(allInstructions)
  const subtotal = orderTests.reduce((sum, test) => sum + Number(test.price), 0)
  const matches = tests.filter((test) => !selected.includes(test.id) && `${test.code} ${test.name}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))

  function addFirstMatch() { if (matches[0]) { setSelected((items) => [...items, matches[0].id]); setSearch('') } }
  async function continueOrder() {
    if (!chosen.length) { setNotice('Agrega al menos un estudio para continuar.'); return }
    if (!canContinueToCheckout(allInstructions.length > 0, confirmed)) { setNotice('Confirma con F2 que informaste las indicaciones antes de continuar.'); return }
    const currentOrderId = await ensureDraftOrder()
    if (allInstructions.length) await fetch(`${API}/orders/${currentOrderId}/confirmation`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ observation }) })
    const reference = `PENDIENTE-${currentOrderId}`
    history.pushState({}, '', `/cobro/${reference}`)
    setView('checkout')
  }
  async function ensureDraftOrder() {
    if (draftOrderId) return draftOrderId
    const response = await fetch(`${API}/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ testIds: chosen.map((test) => test.id) }) })
    const created = await response.json()
    if (!response.ok) throw new Error(created.error ?? 'No se pudo crear la orden.')
    setDraftOrderId(created.id)
    return created.id as number
  }
  async function deliver(channel: 'whatsapp' | 'email') {
    const currentOrderId = await ensureDraftOrder()
    await fetch(`${API}/orders/${currentOrderId}/deliveries`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel }) })
    setNotice(channel === 'whatsapp' ? 'Envío por WhatsApp simulado y registrado.' : 'Envío por correo simulado y registrado.')
  }
  const rows: AnyRecord[] = existingItems.flatMap((item: AnyRecord) => (item.test.parameters ?? []).map((parameter: AnyRecord) => ({ ...parameter, resultValue: item.testResults?.find((result: AnyRecord) => result.parameterId === parameter.id)?.resultValue, orderItem: item, range: selectRange(parameter.ranges ?? [], patient?.gender ?? '', age) })))
  const currentNumeric = (name: string) => {
    const row = rows.find((item: AnyRecord) => item.name === name)
    const raw = values[name] ?? row?.resultValue ?? ''
    return raw === '' || raw == null ? null : Number(raw)
  }
  const totals = currentNumeric('Colesterol total'), hdl = currentNumeric('Colesterol HDL'), triglycerides = currentNumeric('Triglicéridos')
  const lipidInputsReady = totals != null && hdl != null && triglycerides != null
  const calculated = lipidInputsReady ? calculateLipids(totals, hdl, triglycerides) : null
  const resultValues: [string, string][] = rows.map((row: AnyRecord) => [row.name, row.name.includes('LDL') && calculated ? String(calculated.ldl) : row.name.includes('VLDL') && calculated ? String(calculated.vldl) : values[row.name] ?? row.resultValue ?? ''])
  const flagged: Flag[] = rows.map((row: AnyRecord, index: number) => interpretResult(resultValues[index][1] ?? null, row.range ? { ...row.range, expected: row.qualitativeExpected } : row.qualitativeExpected ? { expected: row.qualitativeExpected } : null))
  const missingRange = rows.some((row: AnyRecord) => !row.range && !row.qualitativeExpected)
  const bannerIndex = flagged.findIndex((flag) => flag !== 'Normal' && flag !== '—')
  const abnormalCount = flagged.filter((flag) => flag !== 'Normal' && flag !== '—').length

  async function saveResults() {
    const criticalRows = flagged.filter((flag) => ['HH', 'LL'].includes(flag))
    if (criticalRows.length && !canSaveResult(flagged.find((flag) => ['HH', 'LL'].includes(flag))!, Boolean(notification?.registered))) { setNotice('Resultado crítico: registra a quién notificaste antes de guardar.'); setNotification({ recipient: 'doctor', recipientName: 'Dra. Patricia Ruiz', contactMethod: 'phone', notifiedAt: new Date().toISOString().slice(0, 16) }); return }
    for (const [index, row] of rows.entries()) {
      const value = String(resultValues[index][1]);
      if (!value || value === 'undefined') continue
      await fetch(`${API}/results/${row.orderItem.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parameterId: row.id, value, flag: flagged[index], notification: ['HH', 'LL'].includes(flagged[index]) ? notification : undefined }) })
    }
    setNotice('Resultados guardados como capturados, pendientes de validar.')
  }

  return <div className="shell">
    <aside className="sidebar"><div className="brand">SoftLab</div><nav>{['Recepción', 'Catálogo', 'Toma de muestras', 'Resultados', 'Administración', 'Reportes'].map((label) => <section key={label}><button className={`nav-item ${((label === 'Recepción' && view === 'order') || (label === 'Resultados' && view === 'results')) ? 'active' : ''}`} onClick={() => { const next = label === 'Resultados' ? 'results' : 'order'; setView(next); history.pushState({}, '', next === 'results' ? `/resultados/captura/${order?.folio ?? ''}` : '/ordenes/nueva') }}>{label}<span>›</span></button>{(label === 'Recepción' && view === 'order' || label === 'Resultados' && view === 'results') && <small>{view === 'order' ? 'Pacientes　　Nueva orden　　Corte de caja' : 'Captura de resultados　　Por validar　　Envíos'}</small>}</section>)}</nav></aside>
    <div className="workspace"><header className="topbar"><div><small>LABORATORIO</small><b>{data.name}</b></div><div><small>SUCURSAL</small><b>{branchName}</b></div><div className="push"><small>USUARIO</small><b>Laura Méndez</b></div><div><small>ROL</small><b>Administradora</b></div></header>
      {view === 'checkout' ? <main className="content"><div className="crumb">Recepción / Cobro</div><h1>Cobro pendiente</h1><p className="subtitle">Pantalla de cobro fuera del alcance de HU 5.2. Referencia del stub: <span className="mono">{decodeURIComponent(location.pathname.split('/').pop() ?? '')}</span></p><button className="outline" onClick={() => { setView('order'); history.pushState({}, '', '/ordenes/nueva') }}>Volver a Nueva orden</button></main> : view === 'order' ? <main className="content"><div className="crumb">Recepción / Nueva orden</div><h1>Nueva orden</h1><p className="subtitle">{patientName} · {patient?.patientCode} · {age} años · {genderLabel} · {branchName}</p>
        <div className="search-panel"><label>Médico solicitante<select defaultValue=""><option value="">Selecciona un médico</option>{data.practitioners?.map((person: AnyRecord) => <option key={person.id} value={person.id}>{person.fullName} · {person.specialty}</option>)}</select><small>Opcional. Busca o registra al médico sin salir de la orden.</small></label><label>Agregar estudio o perfil<input id="study-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Busca por clave o nombre" list="test-options"/><datalist id="test-options">{matches.map((test) => <option key={test.id} value={`${test.code} · ${test.name}`} />)}</datalist><small>Solo estudios disponibles en {branchName} con precio vigente. Enter para agregar.</small>{search && <div className="suggestions">{matches.slice(0, 5).map((test) => <button key={test.id} onClick={() => { setSelected((items) => [...items, test.id]); setSearch('') }}>{test.code} · {test.name} · {money.format(Number(test.price))}</button>)}</div>}</label><button className="outline">Registrar médico</button></div>
        <div className="table-wrap"><table><thead><tr><th>ESTUDIO O PERFIL</th><th>CLAVE</th><th>MUESTRA</th><th>INDICACIONES</th><th>PRECIO</th><th></th></tr></thead><tbody>{chosen.map((test) => <tr key={test.id}><td>{test.name}{test.externalLab && <div className="external">El resultado puede tardar más · {test.turnaroundHours} h · {test.externalLab}</div>}</td><td className="mono">{test.code}</td><td>{test.sampleType}</td><td>{test.instructions?.length ? <span className="hint">{test.instructions[0].text}</span> : ''}</td><td className="mono">{money.format(Number(test.price))}</td><td><button className="outline remove" onClick={() => setSelected((items) => items.filter((id) => id !== test.id))}>Quitar</button></td></tr>)}</tbody></table></div>
        {consolidated.length > 0 && <section className="instructions"><h2>Indicaciones para la paciente <span className="hint">Consolidadas</span></h2>{consolidated.map((item, index) => <p key={index}>· {item.title} · {item.studies.join(', ')}{item.note && <small> ({item.note})</small>}</p>)}<label className="wide-label">Observación de preparación<input value={observation} onChange={(event) => setObservation(event.target.value)} placeholder="Agrega una observación de preparación"/></label><div className="actions"><label className="check"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)}/> Informé a la paciente las indicaciones <kbd>F2</kbd></label><button className="outline" onClick={() => window.print()}>Imprimir indicaciones</button><button className="outline" onClick={() => void deliver('whatsapp')}>Enviar por WhatsApp</button></div></section>}
        <div className="summary"><span>{chosen.length} conceptos · la paciente no tiene otra orden abierta hoy</span><strong>Subtotal {money.format(subtotal)}</strong></div><div className="actions footer-actions"><button className="primary" onClick={() => void continueOrder()}>Continuar al cobro</button><kbd>Ctrl + Enter</kbd><button className="outline">Cancelar</button><span>Toda la orden se captura con teclado: Tab, Enter para agregar, F2 para confirmar indicaciones.</span></div>{notice && <div className="toast" role="status">{notice}</div>}</main>
      : <main className="content results"><div className="crumb">Resultados / Captura de resultados / {order?.folio}</div><h1>Captura de resultados</h1><p className="subtitle">{patientName} · {patient?.patientCode} · {age} años · {genderLabel} · {existingItems.map((item: AnyRecord) => item.test.name).join(' y ')}</p><div className="page-actions"><button className="outline">Volver a la lista</button><button className="outline">Bitácora del resultado</button></div>
        {missingRange && <div className="range-alert" role="status"><b>SIN RANGO</b><div><strong>No hay un rango de referencia compatible con sexo y edad para todos los parámetros.</strong><p>Se permite capturar; los valores sin rango compatible no reciben interpretación automática.</p></div></div>}
        {bannerIndex >= 0 && <div className={`range-alert ${['HH', 'LL'].includes(flagged[bannerIndex]) ? 'critical' : ''}`} role={['HH', 'LL'].includes(flagged[bannerIndex]) ? 'alert' : 'status'}><b>FUERA DE RANGO</b><div><strong>{rows[bannerIndex]?.name}: {resultValues[bannerIndex]?.[1]} {rows[bannerIndex]?.unit} {bannerDirection(flagged[bannerIndex])} ({rows[bannerIndex]?.range?.display} {rows[bannerIndex]?.unit}).</strong><p>Revisa la captura. Si es correcto, continúa: la bandera {flagged[bannerIndex]} aparecerá en la validación y en el informe.</p></div></div>}
        <div className="meta-card"><div><small>Folio</small><b>{order?.folio}</b></div><div><small>Muestra</small><b>{order?.samples?.[0]?.sampleDescription} · recibida {order?.samples?.[0]?.receivedAt ? new Date(order.samples[0].receivedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : ''}</b></div><div><small>Equipo</small><b>{order?.samples?.[0]?.equipment}</b></div><div><small>Capturista</small><b>{order?.samples?.[0]?.capturedByName}</b></div></div>
        <div className="table-wrap"><table><thead><tr><th>PARÁMETRO</th><th>RESULTADO</th><th>UNIDAD</th><th>RANGO ({rangeLabel})</th><th>BANDERA</th><th>ANTERIOR</th></tr></thead><tbody>{rows.map((row: AnyRecord, index: number) => { const flag = flagged[index]; const value = resultValues[index]?.[1] ?? ''; const isCalculated = row.name.includes('(calculado)'); return <tr key={`${row.id}-${index}`}><td>{row.name}</td><td><input className={`result-input ${flag !== 'Normal' && flag !== '—' ? `abnormal ${['HH', 'LL'].includes(flag) ? 'critical-input' : ''}` : ''}`} aria-label={`Resultado ${row.name}`} readOnly={isCalculated} value={value} onChange={(event) => { const nextValue = event.target.value; setValues((old) => ({ ...old, [row.name]: nextValue })); const nextFlag = interpretResult(nextValue, row.range ? { ...row.range, expected: row.qualitativeExpected } : row.qualitativeExpected ? { expected: row.qualitativeExpected } : null); if (['HH', 'LL'].includes(nextFlag) && !notification) setNotification({ recipient: 'doctor', recipientName: order?.physician?.fullName ?? '', contactMethod: 'phone', notifiedAt: new Date().toISOString().slice(0, 16) }) }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); (event.currentTarget.closest('tr')?.nextElementSibling?.querySelector('input') as HTMLInputElement)?.focus() } }}/></td><td>{row.unit}</td><td>{row.range?.display ?? 'Sin rango'}</td><td><ResultFlag value={flag}/></td><td className="mono muted">{row.previousValue ? `${row.previousValue} (${row.previousDate})` : '—'}</td></tr>})}</tbody></table></div>
        <div className="summary abnormal-summary"><span>{abnormalCount} resultados anormales · {flagged.filter((flag) => flag === 'H' || flag === 'L').length} fuera de rango · {flagged.filter((flag) => flag === 'HH' || flag === 'LL').length} críticos</span></div>
        <div className="actions footer-actions"><button className="primary" onClick={() => void saveResults()}>Guardar y siguiente</button><kbd>Ctrl + Enter</kbd><button className="outline" onClick={() => void saveResults()}>Guardar</button><span>Enter avanza al siguiente parámetro · Los valores calculados se llenan solos.</span></div>{notice && <div className="toast" role="status">{notice}</div>}
        {notification && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="critical-title"><h2 id="critical-title">Notificación de resultado crítico</h2><p>Antes de guardar, registra a quién se notificó.</p><label>Notificado a<select value={notification.recipient} onChange={(event) => setNotification({ ...notification, recipient: event.target.value })}><option value="doctor">Médico</option><option value="patient">Paciente</option></select></label><label>Nombre<input value={notification.recipientName} onChange={(event) => setNotification({ ...notification, recipientName: event.target.value })}/></label><label>Fecha y hora<input type="datetime-local" value={notification.notifiedAt} onChange={(event) => setNotification({ ...notification, notifiedAt: event.target.value })}/></label><label>Medio<select value={notification.contactMethod} onChange={(event) => setNotification({ ...notification, contactMethod: event.target.value })}><option value="phone">Teléfono</option><option value="email">Correo</option><option value="whatsapp">WhatsApp</option><option value="in_person">En persona</option></select></label><div className="actions"><button className="primary" onClick={() => { if (notification.recipientName.trim()) { setNotice('Notificación lista. Guarda nuevamente para persistir el resultado.'); setNotification({ ...notification, registered: true }) } }}>Registrar notificación</button><button className="outline" onClick={() => setNotification(null)}>Cerrar</button></div></section></div>}
      </main>}<footer className="app-footer"><span>SoftLab · {view === 'order' || view === 'checkout' ? 'Recepción' : 'Resultados'}</span><span>El historial se conserva en cada cambio.</span></footer></div></div>
}

function ageAt(birthDate: Date) {
  const now = new Date()
  return now.getFullYear() - birthDate.getFullYear() - (now < new Date(now.getFullYear(), birthDate.getMonth(), birthDate.getDate()) ? 1 : 0)
}

function bannerDirection(flag: Flag) {
  if (flag === 'H') return 'por encima del rango'
  if (flag === 'L') return 'por debajo del rango'
  if (flag === 'HH') return 'por encima del límite crítico'
  if (flag === 'LL') return 'por debajo del límite crítico'
  return 'es distinto al valor esperado'
}
