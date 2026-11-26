import { useEffect, useState } from 'react'
import { api, mensajeDeError } from '../compartido/api'
import './branch-access.css'

type Branch = { id: number; name: string }
type Employee = { id: number; fullName: string; email: string; role: string; branchIds: number[] }
type AccessResponse = { branches: Branch[]; users: Employee[] }

const roleLabel: Record<string, string> = { receptionist: 'Recepción', chemist: 'Química', doctor: 'Médico' }

export function BranchAccessPage() {
  const [data, setData] = useState<AccessResponse>({ branches: [], users: [] })
  const [drafts, setDrafts] = useState<Record<number, number[]>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const response = await api.get<AccessResponse>('/admin/access/branches')
      setData(response.data)
      setDrafts(Object.fromEntries(response.data.users.map(user => [user.id, user.branchIds])))
    } catch (cause) {
      setError(mensajeDeError(cause))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  function toggle(userId: number, branchId: number) {
    setDrafts(current => {
      const selected = current[userId] ?? []
      return { ...current, [userId]: selected.includes(branchId) ? selected.filter(id => id !== branchId) : [...selected, branchId] }
    })
    setMessage('')
  }

  async function save(userId: number) {
    setSaving(userId)
    setMessage('')
    setError('')
    try {
      await api.put(`/admin/access/users/${userId}/branches`, { branchIds: drafts[userId] ?? [] })
      setMessage('Asignación actualizada.')
      await load()
    } catch (cause) {
      setError(mensajeDeError(cause))
    } finally {
      setSaving(null)
    }
  }

  return (
    <main className="sl-pagina">
      <header className="sl-page-header">
        <div>
          <p className="sl-eyebrow">Administración</p>
          <h1>Control de acceso multisucursal</h1>
          <p>Define en qué sucursales puede operar cada integrante del laboratorio.</p>
        </div>
      </header>
      {message && <p role="status" className="ba-message">{message}</p>}
      {error && <p role="alert" className="ba-error">{error}</p>}
      {loading ? <p>Cargando personal y sucursales…</p> : data.users.length === 0 ? <p>No hay empleados para configurar.</p> : (
        <section className="ba-list" aria-label="Personal del laboratorio">
          {data.users.map(user => (
            <article className="ba-card" key={user.id}>
              <div className="ba-employee">
                <div><h2>{user.fullName}</h2><p>{user.email}</p></div>
                <span>{roleLabel[user.role] ?? user.role}</span>
              </div>
              <fieldset className="ba-branches">
                <legend>Sucursales permitidas</legend>
                {data.branches.map(branch => (
                  <label key={branch.id}>
                    <input type="checkbox" checked={(drafts[user.id] ?? []).includes(branch.id)} onChange={() => toggle(user.id, branch.id)} />
                    {branch.name}
                  </label>
                ))}
              </fieldset>
              <button type="button" className="ba-save" disabled={saving === user.id || (drafts[user.id] ?? []).length === 0} onClick={() => void save(user.id)}>
                {saving === user.id ? 'Guardando…' : 'Guardar asignación'}
              </button>
            </article>
          ))}
        </section>
      )}
    </main>
  )
}
