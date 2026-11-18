import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { mensajeDeError } from '../../compartido/api'
import { Cargando } from '../../compartido/Cargando'
import {
  fechaDeActualizacion,
  paginaDe,
  textoDeActivos,
  textoDeDias,
  textoDeEnvio,
  textoDeMaquila,
  textoDeResumen,
  totalDePaginas,
} from './externos'
import { obtenerExternos } from './servicio'
import type { ListaExternos } from './tipos'
import './catalogo-estudios.css'

function IconoBuscar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#14181b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

function IconoInfo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#1f4d3a" />
      <rect x="9.5" y="5.5" width="5" height="13" rx="1" fill="#f3f0e8" />
      <rect x="11" y="7" width="2" height="10" fill="#1f4d3a" />
    </svg>
  )
}

export default function PaginaEstudiosExternos() {
  const [busqueda, setBusqueda] = useState('')
  const [laboratorio, setLaboratorio] = useState('todos')
  const [estatus, setEstatus] = useState('todos')
  const [pagina, setPagina] = useState(1)
  const [lista, setLista] = useState<ListaExternos | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let activo = true
    obtenerExternos(busqueda, laboratorio, estatus)
      .then(function cargar(datos) {
        if (!activo) return
        setLista(datos)
        setError('')
      })
      .catch(function fallo(e: unknown) {
        if (activo) setError(mensajeDeError(e))
      })
    return () => {
      activo = false
    }
  }, [busqueda, laboratorio, estatus])

  function cambiarFiltro(accion: () => void) {
    accion()
    setPagina(1)
  }

  if (lista === null && error === '') {
    return (
      <main className="ce-pagina">
        <Cargando mensaje="Cargando estudios externos…" />
      </main>
    )
  }

  const filas: ReactNode[] = []
  const opcionesLaboratorio: ReactNode[] = []
  let paginas = 1
  let mostrados = 0
  if (lista !== null) {
    paginas = totalDePaginas(lista.estudios.length)
    const visibles = paginaDe(lista.estudios, pagina)
    mostrados = visibles.length
    for (const estudio of visibles) {
      filas.push(
        <tr key={estudio.id}>
          <td className="ce-mono">{estudio.code}</td>
          <td>
            <Link className="ce-nombre-estudio" to={`/catalogo/estudios/${estudio.id}/editar`}>
              {estudio.name}
            </Link>
            {!estudio.status && <span className="ce-inactivo">Inactivo</span>}
          </td>
          <td>{estudio.laboratorio}</td>
          <td>
            <span className="ce-estatus">{textoDeDias(estudio.turnaroundDays)}</span>
          </td>
          <td className="ce-mono">{textoDeMaquila(estudio.outsourcingCost)}</td>
        </tr>,
      )
    }
    for (const opcion of lista.laboratorios) {
      opcionesLaboratorio.push(
        <option key={opcion.id} value={String(opcion.id)}>
          {opcion.name}
        </option>,
      )
    }
  }

  return (
    <main className="ce-pagina">
      <p className="ce-migas">Catálogo clínico / Estudios / Externos</p>

      <div className="ce-cabecera">
        <div className="ce-introduccion">
          <h1>Estudios externos</h1>
          <p className="ce-secundario">Estudios que se envían a un laboratorio externo para su proceso.</p>
        </div>
      </div>

      {error !== '' && (
        <div className="ce-error" role="alert">
          <b>ERROR</b>
          <strong>{error}</strong>
        </div>
      )}

      {lista !== null && (
        <>
          <div className="ce-resumen">
            <strong>{textoDeResumen(lista.resumen)}</strong>
            <span className="ce-estatus">{textoDeActivos(lista.resumen.activos)}</span>
            {lista.actualizada !== null && <span className="ce-secundario">Actualizada · {fechaDeActualizacion(lista.actualizada)}</span>}
          </div>

          <section className="ce-catalogo" aria-label="Estudios externos">
            <div className="ce-filtros">
              <div className="ce-buscar">
                <input
                  className="ce-control"
                  type="search"
                  aria-label="Buscar por clave o nombre"
                  placeholder="Buscar por clave o nombre"
                  value={busqueda}
                  onChange={(e) => cambiarFiltro(() => setBusqueda(e.target.value))}
                />
                <IconoBuscar />
              </div>
              <div className="ce-selector">
                <select
                  className="ce-control"
                  aria-label="Laboratorio"
                  value={laboratorio}
                  onChange={(e) => cambiarFiltro(() => setLaboratorio(e.target.value))}
                >
                  <option value="todos">Todos los laboratorios</option>
                  {opcionesLaboratorio}
                </select>
              </div>
              <div className="ce-selector">
                <select className="ce-control" aria-label="Estatus" value={estatus} onChange={(e) => cambiarFiltro(() => setEstatus(e.target.value))}>
                  <option value="todos">Todos los estatus</option>
                  <option value="activos">Activos</option>
                  <option value="inactivos">Inactivos</option>
                </select>
              </div>
            </div>

            <table className="ce-tabla">
              <thead>
                <tr>
                  <th className="col-clave">CLAVE</th>
                  <th>ESTUDIO</th>
                  <th className="col-laboratorio">LABORATORIO</th>
                  <th className="col-entrega">ENTREGA</th>
                  <th className="col-maquila">MAQUILA</th>
                </tr>
              </thead>
              <tbody>
                {filas}
                {filas.length === 0 && (
                  <tr className="ce-sin-registros">
                    <td colSpan={5}>No hay estudios externos con esos filtros.</td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="ce-pie-tabla">
              <span>
                Mostrando {mostrados} de {lista.estudios.length} estudios externos
              </span>
              <div className="ce-paginacion">
                <button type="button" className="ce-boton sutil" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>
                  Anterior
                </button>
                <span className="ce-estatus" aria-label={`Página ${pagina} de ${paginas}`}>
                  {pagina}
                </span>
                <button type="button" className="ce-boton sutil" disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)}>
                  Siguiente
                </button>
              </div>
            </div>
          </section>

          <div className="ce-aviso-envio" role="note">
            <IconoInfo />
            {lista.ultimoEnvio !== null && (
              <div>
                <strong>Última orden de envío · {lista.ultimoEnvio.folio}</strong>
                <span>{textoDeEnvio(lista.ultimoEnvio)}</span>
              </div>
            )}
            {lista.ultimoEnvio === null && (
              <div>
                <strong>Aún no hay órdenes de envío</strong>
                <span>Cuando se registre una orden con un estudio externo, aquí aparecerá su folio de envío. El resultado puede tardar más; se avisa al personal y al paciente.</span>
              </div>
            )}
          </div>

          <div className="ce-relacionados">
            <p>Un estudio externo genera una orden de envío en lugar de una de proceso interno.</p>
            <nav aria-label="Accesos relacionados">
              <Link className="ce-enlace" to="/catalogo/estudios">
                Ver todos los estudios
              </Link>
              <Link className="ce-enlace" to="/catalogo/estudios" state={{ verBitacora: true }}>
                Ver bitácora
              </Link>
            </nav>
          </div>
        </>
      )}
    </main>
  )
}
