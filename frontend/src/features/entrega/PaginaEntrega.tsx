import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ReportViewerModal } from '../../components/ReportViewerModal'

export default function PaginaEntrega() {
  const [params] = useSearchParams()
  const [id, setId] = useState(params.get('orden') ?? '')
  const [abierta, setAbierta] = useState(false)
  const valido = Number.isSafeInteger(Number(id)) && Number(id) > 0
  return <main className="sl-pagina">
    <h1>Entrega de resultados</h1>
    <p>El saldo se verifica antes de liberar el informe en cualquier canal.</p>
    <form onSubmit={e => { e.preventDefault(); if (valido) setAbierta(true) }}>
      <label>Número de orden <input type="number" min="1" step="1" required value={id} onChange={e => setId(e.target.value)} /></label>{' '}
      <button disabled={!valido}>Consultar entrega</button>
    </form>
    <ReportViewerModal orderId={Number(id)} isOpen={abierta} onClose={() => setAbierta(false)} />
  </main>
}
