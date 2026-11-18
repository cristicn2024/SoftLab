import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { mensajeDeError } from '../../compartido/api'
import { Cargando } from '../../compartido/Cargando'
import {
  agregarIndicacion,
  AREAS,
  CONTENEDORES,
  estudioAFormulario,
  formularioACuerpo,
  MUESTRAS,
  opcionesCon,
  quitarIndicacion,
  TIPOS_DE_INDICACION,
} from './formularioEstudio'
import { guardarEstudio, obtenerEstudio, obtenerLaboratorios } from './servicio'
import type { EstudioCatalogo, FormularioEstudio, LaboratorioExterno, TipoIndicacion } from './tipos'
import './catalogo-estudios.css'

const RUTA_ESTUDIOS = '/catalogo/estudios'

function Campo({ etiqueta, id, ayuda, children }: { etiqueta: string; id: string; ayuda?: string; children: ReactNode }) {
  let clase = 'ce-campo'
  if (ayuda !== undefined) clase = 'ce-campo con-ayuda'
  return (
    <div className={clase}>
      <label className="ce-etiqueta" htmlFor={id}>
        {etiqueta}
      </label>
      <div className="ce-foco">{children}</div>
      {ayuda !== undefined && <p className="ce-ayuda">{ayuda}</p>}
    </div>
  )
}

function Opciones({ lista }: { lista: string[] }) {
  const opciones: ReactNode[] = []
  for (const opcion of lista) {
    opciones.push(
      <option key={opcion} value={opcion}>
        {opcion}
      </option>,
    )
  }
  return <>{opciones}</>
}

function CajaDeError({ mensaje }: { mensaje: string }) {
  return (
    <div className="ce-error" role="alert">
      <b>ERROR</b>
      <strong>{mensaje}</strong>
    </div>
  )
}

export default function PaginaEditarEstudio() {
  const { idEstudio } = useParams()
  const navegar = useNavigate()
  const id = Number(idEstudio)

  const [cargando, setCargando] = useState(true)
  const [estudio, setEstudio] = useState<EstudioCatalogo | null>(null)
  const [formulario, setFormulario] = useState<FormularioEstudio | null>(null)
  const [laboratorios, setLaboratorios] = useState<LaboratorioExterno[]>([])
  const [error, setError] = useState('')
  const [guardado, setGuardado] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [agregando, setAgregando] = useState(false)
  const [tipoNuevo, setTipoNuevo] = useState<TipoIndicacion>('preparacion')
  const [textoNuevo, setTextoNuevo] = useState('')

  useEffect(() => {
    let activo = true
    Promise.all([obtenerEstudio(id), obtenerLaboratorios()])
      .then(function cargar([encontrado, labs]) {
        if (!activo) return
        if (encontrado === null) {
          setError('No existe el estudio en este laboratorio.')
        } else {
          setEstudio(encontrado)
          setFormulario(estudioAFormulario(encontrado))
        }
        setLaboratorios(labs)
        setCargando(false)
      })
      .catch(function fallo(e: unknown) {
        if (!activo) return
        setError(mensajeDeError(e))
        setCargando(false)
      })
    return () => {
      activo = false
    }
  }, [id])

  function cambiar(cambios: Partial<FormularioEstudio>) {
    if (formulario === null) return
    setFormulario({ ...formulario, ...cambios })
    setGuardado('')
  }

  function cancelar() {
    navegar(RUTA_ESTUDIOS)
  }

  async function guardar() {
    if (formulario === null || estudio === null || guardando) return
    setError('')
    setGuardado('')
    const cuerpo = formularioACuerpo(formulario, estudio.price)
    if (!cuerpo.ok) {
      setError(cuerpo.mensaje)
      return
    }
    setGuardando(true)
    try {
      await guardarEstudio(estudio.id, cuerpo.valor)
      const actualizado = await obtenerEstudio(estudio.id)
      if (actualizado !== null) {
        setEstudio(actualizado)
        setFormulario(estudioAFormulario(actualizado))
      }
      setGuardado('Cambios guardados. Quedaron registrados en la bitácora.')
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      setGuardando(false)
    }
  }

  useEffect(() => {
    function alPresionar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        navegar(RUTA_ESTUDIOS)
        return
      }
      if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 's') {
        evento.preventDefault()
        void guardar()
      }
    }
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  })

  function confirmarIndicacion() {
    if (formulario === null) return
    const resultado = agregarIndicacion(formulario.indicaciones, tipoNuevo, textoNuevo)
    if (!resultado.ok) {
      setError(resultado.mensaje)
      return
    }
    setError('')
    cambiar({ indicaciones: resultado.valor })
    setAgregando(false)
    setTextoNuevo('')
  }

  if (cargando) {
    return (
      <main className="ce-pagina">
        <Cargando mensaje="Cargando estudio…" />
      </main>
    )
  }

  if (formulario === null || estudio === null) {
    return (
      <main className="ce-pagina">
        <p className="ce-migas">Catálogo clínico / Estudios / Editar</p>
        <CajaDeError mensaje={error} />
        <Link className="ce-boton fijo" to={RUTA_ESTUDIOS}>
          Volver a estudios
        </Link>
      </main>
    )
  }

  const filasIndicaciones: ReactNode[] = []
  for (let i = 0; i < formulario.indicaciones.length; i++) {
    const indicacion = formulario.indicaciones[i]
    filasIndicaciones.push(
      <div className="ce-indicacion" key={`${indicacion.tipo}-${i}`}>
        <span>{indicacion.texto}</span>
        <div className="ce-envoltura-boton">
          <button
            type="button"
            className="ce-boton fijo"
            aria-label={`Quitar ${indicacion.texto}`}
            onClick={() => cambiar({ indicaciones: quitarIndicacion(formulario.indicaciones, i) })}
          >
            Quitar
          </button>
        </div>
      </div>,
    )
  }

  const opcionesTipo: ReactNode[] = []
  for (const tipo of TIPOS_DE_INDICACION) {
    opcionesTipo.push(
      <option key={tipo.valor} value={tipo.valor}>
        {tipo.etiqueta}
      </option>,
    )
  }

  const opcionesLaboratorio: ReactNode[] = []
  for (const laboratorio of laboratorios) {
    opcionesLaboratorio.push(
      <option key={laboratorio.id} value={String(laboratorio.id)}>
        {laboratorio.name}
      </option>,
    )
  }

  let estadoExterno = 'Inactivo'
  if (formulario.esExterno) estadoExterno = 'Activo'
  const externoApagado = !formulario.esExterno

  let placeholderNuevo = 'Escribe la indicación'
  if (tipoNuevo === 'ayuno') placeholderNuevo = 'Horas de ayuno (0 si no requiere)'

  return (
    <main className="ce-pagina">
      <p className="ce-migas">Catálogo clínico / Estudios / {estudio.code} / Editar</p>

      <div className="ce-cabecera">
        <div className="ce-introduccion">
          <h1>Editar estudio</h1>
          <p className="ce-secundario">
            {estudio.code} · {estudio.name}
          </p>
        </div>
        <div className="ce-acciones-cabecera">
          <div className="ce-envoltura-boton">
            <Link className="ce-boton ancho-referencias" to="/resultados/referencias">
              Valores de referencia
            </Link>
          </div>
          <div className="ce-envoltura-boton">
            <Link className="ce-boton" to="/catalogo/estudios/externos">
              Ver estudios externos
            </Link>
          </div>
        </div>
      </div>

      {error !== '' && <CajaDeError mensaje={error} />}
      {guardado !== '' && (
        <p className="ce-guardado" role="status">
          {guardado}
        </p>
      )}

      <form
        className="ce-formulario"
        onSubmit={(evento) => {
          evento.preventDefault()
          void guardar()
        }}
      >
        <section className="ce-seccion" aria-labelledby="ce-datos">
          <div className="ce-encabezado-seccion">
            <h2 id="ce-datos">Datos del estudio</h2>
            <p className="ce-secundario">La clave y el nombre deben ser únicos.</p>
          </div>
          <div className="ce-campos">
            <Campo etiqueta="Clave única *" id="ce-clave">
              <input id="ce-clave" className="ce-control" required maxLength={30} value={formulario.code} onChange={(e) => cambiar({ code: e.target.value })} />
            </Campo>
            <Campo etiqueta="Nombre del estudio *" id="ce-nombre">
              <input id="ce-nombre" className="ce-control" required maxLength={150} value={formulario.name} onChange={(e) => cambiar({ name: e.target.value })} />
            </Campo>
            <div className="ce-fila-campos">
              <Campo etiqueta="Área / departamento *" id="ce-area">
                <div className="ce-selector">
                  <select id="ce-area" className="ce-control" value={formulario.department} onChange={(e) => cambiar({ department: e.target.value })}>
                    <Opciones lista={opcionesCon(AREAS, formulario.department)} />
                  </select>
                </div>
              </Campo>
              <Campo etiqueta="Estatus *" id="ce-estatus">
                <div className="ce-selector">
                  <select id="ce-estatus" className="ce-control" value={String(formulario.status)} onChange={(e) => cambiar({ status: e.target.value === 'true' })}>
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
              </Campo>
            </div>
          </div>
        </section>

        <section className="ce-seccion" aria-labelledby="ce-muestra">
          <h2 id="ce-muestra">Muestra e indicaciones</h2>
          <div className="ce-campos">
            <Campo etiqueta="Tipo de muestra" id="ce-tipo-muestra">
              <div className="ce-selector">
                <select id="ce-tipo-muestra" className="ce-control" value={formulario.sampleType} onChange={(e) => cambiar({ sampleType: e.target.value })}>
                  <Opciones lista={opcionesCon(MUESTRAS, formulario.sampleType)} />
                </select>
              </div>
            </Campo>
            <Campo etiqueta="Tipo de contenedor" id="ce-contenedor">
              <div className="ce-selector">
                <select id="ce-contenedor" className="ce-control" value={formulario.containerType} onChange={(e) => cambiar({ containerType: e.target.value })}>
                  <option value="">Sin contenedor</option>
                  <Opciones lista={opcionesCon(CONTENEDORES, formulario.containerType)} />
                </select>
              </div>
            </Campo>
            <Campo etiqueta="Volumen requerido" id="ce-volumen">
              <input id="ce-volumen" className="ce-control" placeholder="3 ml" value={formulario.volumen} onChange={(e) => cambiar({ volumen: e.target.value })} />
            </Campo>
            <div className="ce-indicaciones">
              <p className="ce-etiqueta">Indicaciones de preparación</p>
              {filasIndicaciones}
              {agregando && (
                <div className="ce-nueva-indicacion">
                  <div className="ce-selector">
                    <select className="ce-control" aria-label="Tipo de indicación" value={tipoNuevo} onChange={(e) => setTipoNuevo(e.target.value as TipoIndicacion)}>
                      {opcionesTipo}
                    </select>
                  </div>
                  <input
                    className="ce-control"
                    aria-label="Nueva indicación"
                    placeholder={placeholderNuevo}
                    value={textoNuevo}
                    onChange={(e) => setTextoNuevo(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        confirmarIndicacion()
                      }
                    }}
                  />
                  <button type="button" className="ce-boton fijo primario" onClick={confirmarIndicacion}>
                    Agregar
                  </button>
                </div>
              )}
              <div>
                <div className="ce-envoltura-boton ce-en-linea">
                  <button type="button" className="ce-boton fijo" onClick={() => setAgregando(!agregando)}>
                    {agregando ? 'Cerrar' : 'Agregar indicación'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <p className="ce-secundario">Las indicaciones se muestran al registrar la orden y se pueden imprimir o enviar al paciente.</p>
        </section>

        <section className="ce-seccion" aria-labelledby="ce-aplica">
          <h2 id="ce-aplica">Aplica a</h2>
          <Campo etiqueta="Aplica a" id="ce-sexo" ayuda="Opciones: Ambos, Solo femenino, Solo masculino">
            <div className="ce-selector">
              <select id="ce-sexo" className="ce-control" value={formulario.genderRestriction} onChange={(e) => cambiar({ genderRestriction: e.target.value })}>
                <option value="BOTH">Ambos</option>
                <option value="F">Solo femenino</option>
                <option value="M">Solo masculino</option>
              </select>
            </div>
          </Campo>
          <p className="ce-secundario">
            Si el estudio no corresponde al sexo del paciente, el sistema advierte al crear la orden (Solo femenino advierte si el paciente es hombre; Solo
            masculino, si es mujer). Un usuario con permiso puede autorizar una excepción y debe registrar el motivo.
          </p>
        </section>

        <section className="ce-seccion" aria-labelledby="ce-externo">
          <h2 id="ce-externo">Laboratorio externo</h2>
          <div className="ce-opcion-externo">
            <button
              type="button"
              role="switch"
              className="ce-interruptor"
              aria-checked={formulario.esExterno}
              aria-labelledby="ce-externo-titulo"
              onClick={() => cambiar({ esExterno: !formulario.esExterno })}
            >
              <span />
            </button>
            <div>
              <strong id="ce-externo-titulo">Se procesa en laboratorio externo</strong>
              <span className="ce-secundario">{estadoExterno}</span>
            </div>
          </div>
          <div className="ce-campos">
            <Campo etiqueta="Laboratorio que lo procesa" id="ce-laboratorio">
              <div className="ce-selector">
                <select
                  id="ce-laboratorio"
                  className="ce-control"
                  disabled={externoApagado}
                  value={formulario.externalLabId}
                  onChange={(e) => cambiar({ externalLabId: e.target.value })}
                >
                  <option value="">Selecciona un laboratorio</option>
                  {opcionesLaboratorio}
                </select>
              </div>
            </Campo>
            <Campo etiqueta="Tiempo estimado de entrega en días" id="ce-dias">
              <input
                id="ce-dias"
                className="ce-control"
                type="number"
                min={1}
                max={365}
                step={1}
                disabled={externoApagado}
                value={formulario.turnaroundDays}
                onChange={(e) => cambiar({ turnaroundDays: e.target.value })}
              />
            </Campo>
            <Campo etiqueta="Costo de maquila, opcional" id="ce-maquila">
              <input
                id="ce-maquila"
                className="ce-control"
                inputMode="decimal"
                placeholder="$0.00"
                disabled={externoApagado}
                value={formulario.outsourcingCost}
                onChange={(e) => cambiar({ outsourcingCost: e.target.value })}
              />
            </Campo>
          </div>
          <p className="ce-secundario">El resultado puede tardar más. Se avisa al personal y al paciente.</p>
        </section>

        <div className="ce-pie-formulario">
          <p className="ce-secundario">Los cambios quedan en bitácora</p>
          <div className="ce-botones-pie">
            <div className="ce-atajo">
              <kbd>Esc</kbd>
              <div className="ce-envoltura-boton">
                <button type="button" className="ce-boton fijo" onClick={cancelar}>
                  Cancelar
                </button>
              </div>
            </div>
            <div className="ce-atajo">
              <kbd>Ctrl + S</kbd>
              <div className="ce-envoltura-boton">
                <button type="submit" className="ce-boton fijo primario" disabled={guardando}>
                  {guardando ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </main>
  )
}
