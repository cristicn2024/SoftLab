import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Aviso } from '../../compartido/Aviso'
import { Cargando } from '../../compartido/Cargando'
import { horaDe, sexoCorto, unirConComas } from '../../compartido/formato'
import { MensajeError } from '../../compartido/MensajeError'
import { estadoDeMuestra, nombresDeEstudios } from './captura'
import { rutaDeCaptura } from './rutas'
import type { OrdenDeLista } from './tipos'
import { useListaDeTrabajo } from './useListaDeTrabajo'
import './lista-de-trabajo.css'

function filtrarPorEstatus(ordenes: OrdenDeLista[], estatus: string): OrdenDeLista[] {
  const visibles: OrdenDeLista[] = []
  for (const orden of ordenes) {
    const estado = estadoDeMuestra(orden)
    if (estatus === 'todas' || (estatus === 'recibida' && estado === 'Recibido') || (estatus === 'analisis' && estado === 'En análisis')) {
      visibles.push(orden)
    }
  }
  return visibles
}

function textoDeConteo(cantidad: number): string {
  if (cantidad === 1) return '1 orden por capturar'
  return `${cantidad} órdenes por capturar`
}

export default function PaginaListaDeTrabajo() {
  const { cargando, lista, error } = useListaDeTrabajo()
  const [estatus, setEstatus] = useState('todas')
  const ubicacion = useLocation()
  const estadoDeNavegacion = ubicacion.state as { aviso?: string } | null

  if (cargando) {
    return (
      <main className="content">
        <Cargando mensaje="Cargando lista de trabajo…" />
      </main>
    )
  }

  if (error !== '' || lista === null) {
    return (
      <main className="content">
        <MensajeError mensaje={error} />
      </main>
    )
  }

  const visibles = filtrarPorEstatus(lista.orders, estatus)

  const filas: ReactNode[] = []
  for (const orden of visibles) {
    filas.push(
      <tr key={orden.orderId}>
        <td className="mono">{orden.folio}</td>
        <td>{orden.patient.fullName}</td>
        <td>
          {orden.patient.ageYears} · {sexoCorto(orden.patient.gender)}
        </td>
        <td>{unirConComas(nombresDeEstudios(orden))}</td>
        <td>
          <span className="estado-muestra">{estadoDeMuestra(orden)}</span>
        </td>
        <td className="mono">{horaDe(orden.receivedAt)}</td>
        <td>
          <Link className="primary" to={rutaDeCaptura(orden.orderId)} aria-label={`Capturar ${orden.folio}`}>
            Capturar
          </Link>
        </td>
      </tr>,
    )
  }

  return (
    <main className="content">
      <div className="crumb">Resultados / Captura de resultados</div>
      <h1>Lista de trabajo</h1>
      <p className="subtitle">Muestras recibidas pendientes de capturar · Química clínica · Clínica Central</p>

      <div className="search-panel">
        <label>
          Área
          <select disabled defaultValue="quimica">
            <option value="quimica">Química clínica</option>
          </select>
        </label>
        <label>
          Estatus de muestra
          <select value={estatus} onChange={(evento) => setEstatus(evento.target.value)}>
            <option value="todas">Recibida y en análisis</option>
            <option value="recibida">Recibida</option>
            <option value="analisis">En análisis</option>
          </select>
        </label>
        <label>
          Prioridad
          <select disabled defaultValue="urgentes">
            <option value="urgentes">Urgentes primero</option>
          </select>
        </label>
      </div>

      <div className="summary">
        <strong>{textoDeConteo(visibles.length)}</strong>
        <span className="chip">Captura manual desde el equipo</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>FOLIO</th>
              <th>PACIENTE</th>
              <th>EDAD · SEXO</th>
              <th>ESTUDIOS PENDIENTES</th>
              <th>MUESTRA</th>
              <th>RECIBIDA</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filas}
            {filas.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  No hay órdenes por capturar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="subtitle">Al guardar un estudio se abre el siguiente de la lista. Los resultados capturados pasan a «Por validar».</p>

      {estadoDeNavegacion?.aviso && <Aviso mensaje={estadoDeNavegacion.aviso} />}
    </main>
  )
}
