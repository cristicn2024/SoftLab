import type { EstudioCatalogo, FormularioEstudio, Indicacion, TipoIndicacion } from './tipos.ts'

export type Resultado<T> = { ok: true; valor: T } | { ok: false; mensaje: string }

export const AREAS = ['Química clínica', 'Hematología', 'Uroanálisis', 'Inmunología', 'Hormonas', 'Microbiología', 'General']
export const MUESTRAS = ['Sangre', 'Suero', 'Plasma', 'Orina', 'Heces', 'Exudado']
export const CONTENEDORES = ['Tubo con EDTA', 'Tubo rojo', 'Tubo amarillo (gel)', 'Tubo azul (citrato)', 'Tubo gris (fluoruro)', 'Frasco estéril', 'Contenedor de heces']

export const TIPOS_DE_INDICACION: { valor: TipoIndicacion; etiqueta: string }[] = [
  { valor: 'ayuno', etiqueta: 'Horas de ayuno' },
  { valor: 'preparacion', etiqueta: 'Preparación' },
  { valor: 'medicamentos', etiqueta: 'Medicamentos' },
  { valor: 'adicional', etiqueta: 'Instrucción adicional' },
]

export function opcionesCon(lista: string[], actual: string): string[] {
  const opciones: string[] = []
  for (const opcion of lista) opciones.push(opcion)
  if (actual !== '' && !opciones.includes(actual)) opciones.unshift(actual)
  return opciones
}

export function textoDeAyuno(horas: number): string {
  if (horas === 0) return 'No requiere ayuno'
  if (horas === 1) return 'Ayuno de 1 hora'
  return `Ayuno de ${horas} horas`
}

function lineas(texto: string | null | undefined, tipo: TipoIndicacion): Indicacion[] {
  const lista: Indicacion[] = []
  if (texto === null || texto === undefined) return lista
  for (const linea of texto.split('\n')) {
    const limpia = linea.trim()
    if (limpia !== '') lista.push({ tipo, texto: limpia, horas: null })
  }
  return lista
}

function textoDeVolumen(estudio: EstudioCatalogo): string {
  if (estudio.sampleVolume === null || estudio.sampleVolume === undefined || estudio.sampleVolume === '') return ''
  let unidad = ''
  if (estudio.sampleVolumeUnit) unidad = ` ${estudio.sampleVolumeUnit}`
  return `${Number(estudio.sampleVolume)}${unidad}`
}

function textoDeCosto(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return ''
  return `$${Number(valor).toFixed(2)}`
}

export function estudioAFormulario(estudio: EstudioCatalogo): FormularioEstudio {
  const indicaciones: Indicacion[] = []
  if (estudio.fastingHours !== null && estudio.fastingHours !== undefined) {
    indicaciones.push({ tipo: 'ayuno', texto: textoDeAyuno(estudio.fastingHours), horas: estudio.fastingHours })
  }
  for (const indicacion of lineas(estudio.preparationInstructions, 'preparacion')) indicaciones.push(indicacion)
  for (const indicacion of lineas(estudio.medicationWarnings, 'medicamentos')) indicaciones.push(indicacion)
  for (const indicacion of lineas(estudio.additionalInstructions, 'adicional')) indicaciones.push(indicacion)

  let externalLabId = ''
  if (estudio.externalLabId) externalLabId = String(estudio.externalLabId)
  let dias = ''
  if (estudio.turnaroundDays) dias = String(estudio.turnaroundDays)

  return {
    code: estudio.code,
    name: estudio.name,
    department: estudio.department ?? '',
    status: estudio.status,
    sampleType: estudio.sampleType ?? '',
    containerType: estudio.containerType ?? '',
    volumen: textoDeVolumen(estudio),
    genderRestriction: estudio.genderRestriction ?? 'BOTH',
    indicaciones,
    esExterno: externalLabId !== '',
    externalLabId,
    turnaroundDays: dias,
    outsourcingCost: textoDeCosto(estudio.outsourcingCost),
  }
}

export function leerVolumen(texto: string): Resultado<{ cantidad: number | null; unidad: string | null }> {
  const limpio = texto.trim()
  if (limpio === '') return { ok: true, valor: { cantidad: null, unidad: null } }
  const partes = /^(\d+(?:[.,]\d+)?)\s*([a-zA-ZµμÁÉÍÓÚáéíóú]+)?$/.exec(limpio)
  if (partes === null) return { ok: false, mensaje: 'Escribe el volumen con número y unidad, por ejemplo 3 ml.' }
  const cantidad = Number(partes[1].replace(',', '.'))
  if (cantidad <= 0) return { ok: false, mensaje: 'El volumen requerido debe ser mayor a 0.' }
  let unidad = 'ml'
  if (partes[2] !== undefined) unidad = partes[2]
  return { ok: true, valor: { cantidad, unidad } }
}

export function leerCosto(texto: string): Resultado<string> {
  const limpio = texto.replace(/[$,\s]/g, '')
  if (limpio === '') return { ok: true, valor: '' }
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return { ok: false, mensaje: 'El costo de maquila debe ser un importe, por ejemplo $90.00.' }
  return { ok: true, valor: limpio }
}

function unirTextos(indicaciones: Indicacion[], tipo: TipoIndicacion): string {
  const textos: string[] = []
  for (const indicacion of indicaciones) {
    if (indicacion.tipo === tipo) textos.push(indicacion.texto)
  }
  return textos.join('\n')
}

function horasDeAyuno(indicaciones: Indicacion[]): number | null {
  for (const indicacion of indicaciones) {
    if (indicacion.tipo === 'ayuno') return indicacion.horas
  }
  return null
}

export function formularioACuerpo(formulario: FormularioEstudio, precio: string | number): Resultado<Record<string, unknown>> {
  if (formulario.code.trim() === '' || formulario.name.trim() === '' || formulario.department.trim() === '') {
    return { ok: false, mensaje: 'Completa la clave, el nombre y el área del estudio.' }
  }
  if (formulario.sampleType.trim() === '') return { ok: false, mensaje: 'Selecciona el tipo de muestra.' }

  const volumen = leerVolumen(formulario.volumen)
  if (!volumen.ok) return volumen

  const cuerpo: Record<string, unknown> = {
    code: formulario.code.trim(),
    name: formulario.name.trim(),
    price: String(precio),
    status: formulario.status,
    department: formulario.department.trim(),
    sampleType: formulario.sampleType.trim(),
    containerType: formulario.containerType,
    sampleVolume: volumen.valor.cantidad === null ? '' : String(volumen.valor.cantidad),
    sampleVolumeUnit: volumen.valor.unidad ?? '',
    genderRestriction: formulario.genderRestriction,
    fastingHours: horasDeAyuno(formulario.indicaciones),
    preparationInstructions: unirTextos(formulario.indicaciones, 'preparacion'),
    medicationWarnings: unirTextos(formulario.indicaciones, 'medicamentos'),
    additionalInstructions: unirTextos(formulario.indicaciones, 'adicional'),
    isExternal: formulario.esExterno,
  }

  if (!formulario.esExterno) return { ok: true, valor: cuerpo }

  if (formulario.externalLabId === '') return { ok: false, mensaje: 'Selecciona el laboratorio que procesa el estudio.' }
  const dias = Number(formulario.turnaroundDays)
  if (formulario.turnaroundDays.trim() === '' || !Number.isInteger(dias) || dias < 1 || dias > 365) {
    return { ok: false, mensaje: 'El tiempo estimado de entrega debe ser de 1 a 365 días.' }
  }
  const costo = leerCosto(formulario.outsourcingCost)
  if (!costo.ok) return costo

  cuerpo.externalLabId = Number(formulario.externalLabId)
  cuerpo.turnaroundDays = dias
  cuerpo.outsourcingCost = costo.valor
  return { ok: true, valor: cuerpo }
}

export function agregarIndicacion(lista: Indicacion[], tipo: TipoIndicacion, texto: string): Resultado<Indicacion[]> {
  const nueva: Indicacion[] = []
  if (tipo === 'ayuno') {
    const horas = Number(texto)
    if (texto.trim() === '' || !Number.isInteger(horas) || horas < 0 || horas > 72) {
      return { ok: false, mensaje: 'Las horas de ayuno deben ser un número entero de 0 a 72.' }
    }
    nueva.push({ tipo: 'ayuno', texto: textoDeAyuno(horas), horas })
    for (const indicacion of lista) {
      if (indicacion.tipo !== 'ayuno') nueva.push(indicacion)
    }
    return { ok: true, valor: nueva }
  }

  const limpio = texto.trim()
  if (limpio === '') return { ok: false, mensaje: 'Escribe la indicación.' }
  for (const indicacion of lista) nueva.push(indicacion)
  nueva.push({ tipo, texto: limpio, horas: null })
  return { ok: true, valor: nueva }
}

export function quitarIndicacion(lista: Indicacion[], posicion: number): Indicacion[] {
  const nueva: Indicacion[] = []
  for (let i = 0; i < lista.length; i++) {
    if (i !== posicion) nueva.push(lista[i])
  }
  return nueva
}
