import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { SESION } from '../compartido/sesion';

type Study = { id: number; code: string; name: string; price: string; status: boolean; department: string; sampleType: string };
type Profile = Study & { tests: { test: Study; testId: number }[] };
type Audit = { id: number; userName: string; createdAt: string; before: unknown; after: unknown };
const headers = { 'x-user-name': encodeURIComponent(SESION.usuario), 'x-user-role': encodeURIComponent(SESION.rol) };
const empty = { code: '', name: '', price: '0', department: '', sampleType: '', status: true, testIds: [] as number[] };

export default function CatalogoPage({ kind }: { kind: 'studies' | 'profiles' }) {
  const [catalog, setCatalog] = useState<{ studies: Study[]; profiles: Profile[] }>({ studies: [], profiles: [] });
  const [draft, setDraft] = useState(empty);
  const [id, setId] = useState<number>();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const admin = ['admin', 'Administradora', 'Administrador'].includes(SESION.rol);
  const message = (e: unknown) => {
    const body = (e as { response?: { data?: { message?: string; error?: string | { mensaje?: string } } } }).response?.data;
    return body?.message ?? (typeof body?.error === 'string' ? body.error : body?.error?.mensaje) ?? 'No se pudo completar la operación';
  };
  async function load() { setCatalog((await api.get('/catalogo', { headers })).data); }
  useEffect(() => {
    let active = true;
    setEditing(false); setShowAudit(false); setError('');
    api.get('/catalogo', { headers }).then(r => { if (active) setCatalog(r.data); }).catch(e => { if (active) setError(message(e)); });
    return () => { active = false; };
  }, [kind]);
  function edit(item?: Study | Profile) {
    setId(item?.id);
    setDraft(item ? { code: item.code, name: item.name, price: String(item.price), status: item.status,
      department: item.department ?? '', sampleType: item.sampleType ?? '',
      testIds: 'tests' in item ? item.tests.map(t => t.testId) : [] } : empty);
    setEditing(true); setError('');
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (id) await api.put(`/catalogo/${kind}/${id}`, draft, { headers });
      else await api.post(`/catalogo/${kind}`, draft, { headers });
      await load(); setEditing(false);
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  return <main className="sl-pagina">
    <h1>{kind === 'studies' ? 'Estudios' : 'Perfiles'}</h1>
    {admin && <><button onClick={() => edit()}>Crear {kind === 'studies' ? 'estudio' : 'perfil'}</button>{' '}
      <button onClick={async () => { try { setAudits((await api.get('/catalogo/bitacora', { headers })).data); setShowAudit(true); } catch (e) { setError(message(e)); } }}>Ver bitácora</button></>}
    {error && <p role="alert">{error}</p>}
    {editing && <form onSubmit={save} style={{ display: 'grid', gap: 12, maxWidth: 640, margin: '24px 0' }}>
      <h2>{id ? 'Editar' : 'Crear'} {kind === 'studies' ? 'estudio' : 'perfil'}</h2>
      <label>Clave <input required maxLength={30} value={draft.code} onChange={e => setDraft({ ...draft, code: e.target.value })} /></label>
      <label>Nombre <input required maxLength={150} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
      <label>Precio <input type="number" required min="0" max="99999999.99" step="0.01" value={draft.price} onChange={e => setDraft({ ...draft, price: e.target.value })} /></label>
      {kind === 'studies' ? <>
        <label>Área / departamento <input required maxLength={100} value={draft.department} onChange={e => setDraft({ ...draft, department: e.target.value })} /></label>
        <label>Tipo de muestra <input required maxLength={50} value={draft.sampleType} onChange={e => setDraft({ ...draft, sampleType: e.target.value })} /></label>
      </> : <fieldset><legend>Estudios del perfil (selecciona al menos uno)</legend>
        {catalog.studies.map(t => <label key={t.id} style={{ display: 'block' }}>
          <input type="checkbox" checked={draft.testIds.includes(t.id)} onChange={e => setDraft({ ...draft, testIds: e.target.checked ? [...draft.testIds, t.id] : draft.testIds.filter(v => v !== t.id) })} />
          {t.code} · {t.name} {!t.status && '— Inactivo'}
        </label>)}
        {catalog.studies.some(t => draft.testIds.includes(t.id) && !t.status) && <p role="alert">Este perfil incluye estudios inactivos.</p>}
      </fieldset>}
      <label>Estatus <select value={String(draft.status)} onChange={e => setDraft({ ...draft, status: e.target.value === 'true' })}><option value="true">Activo</option><option value="false">Inactivo</option></select></label>
      <button disabled={busy || (kind === 'profiles' && !draft.testIds.length)}>{busy ? 'Guardando…' : 'Guardar'}</button>
      <button type="button" disabled={busy} onClick={() => setEditing(false)}>Cancelar</button>
    </form>}
    <table style={{ width: '100%', marginTop: 24, textAlign: 'left' }}><thead><tr><th>Clave</th><th>Nombre</th><th>Detalle</th><th>Estatus</th><th>Acciones</th></tr></thead>
      <tbody>{catalog[kind].map(item => <tr key={item.id}><td>{item.code}</td><td>{item.name}</td>
        <td>{'tests' in item ? <>{item.tests.map(t => t.test.name).join(', ')}{item.tests.some(t => !t.test.status) && <p role="alert">Incluye estudios inactivos</p>}</> : item.department}</td>
        <td>{item.status ? 'Activo' : 'Inactivo'}</td><td>{admin && <button onClick={() => edit(item)}>Editar / desactivar</button>}</td></tr>)}</tbody>
    </table>
    {catalog[kind].length === 0 && <p>Aún no hay registros.</p>}
    {showAudit && <section><h2>Bitácora de cambios</h2>{audits.map(a => <details key={a.id}><summary>{new Date(a.createdAt).toLocaleString()} · {a.userName}</summary><h3>Valor anterior</h3><pre>{JSON.stringify(a.before, null, 2)}</pre><h3>Valor nuevo</h3><pre>{JSON.stringify(a.after, null, 2)}</pre></details>)}</section>}
  </main>;
}

