import test from 'node:test'
import assert from 'node:assert/strict'
import { agregarIndicacion, estudioAFormulario, formularioACuerpo, leerCosto, leerVolumen, quitarIndicacion } from './formularioEstudio.ts'
import type { EstudioCatalogo } from './tipos.ts'

const HBA: EstudioCatalogo = {
  id: 7,
  code: 'HBA001',
  name: 'Hemoglobina glucosilada (HbA1c)',
  price: '320.00',
  status: true,
  department: 'Química clínica',
  sampleType: 'Sangre',
  containerType: 'Tubo con EDTA',
  sampleVolume: '3.000',
  sampleVolumeUnit: 'ml',
  fastingHours: 0,
  preparationInstructions: 'Informar si hubo transfusión reciente',
  medicationWarnings: null,
  additionalInstructions: null,
  genderRestriction: 'BOTH',
  externalLabId: 2,
  turnaroundDays: 3,
  outsourcingCost: '90.00',
}

test('carga el estudio como en el Figma', () => {
  const formulario = estudioAFormulario(HBA)
  assert.equal(formulario.volumen, '3 ml')
  assert.equal(formulario.outsourcingCost, '$90.00')
  assert.equal(formulario.esExterno, true)
  const textos: string[] = []
  for (const indicacion of formulario.indicaciones) textos.push(indicacion.texto)
  assert.deepEqual(textos, ['No requiere ayuno', 'Informar si hubo transfusión reciente'])
})

test('arma el cuerpo con la sección de laboratorio externo', () => {
  const cuerpo = formularioACuerpo(estudioAFormulario(HBA), HBA.price)
  assert.equal(cuerpo.ok, true)
  if (!cuerpo.ok) return
  assert.equal(cuerpo.valor.isExternal, true)
  assert.equal(cuerpo.valor.externalLabId, 2)
  assert.equal(cuerpo.valor.turnaroundDays, 3)
  assert.equal(cuerpo.valor.outsourcingCost, '90.00')
  assert.equal(cuerpo.valor.sampleVolume, '3')
  assert.equal(cuerpo.valor.sampleVolumeUnit, 'ml')
  assert.equal(cuerpo.valor.fastingHours, 0)
  assert.equal(cuerpo.valor.price, '320.00')
})

test('al apagar el interruptor no manda laboratorio', () => {
  const formulario = { ...estudioAFormulario(HBA), esExterno: false }
  const cuerpo = formularioACuerpo(formulario, HBA.price)
  assert.equal(cuerpo.ok, true)
  if (!cuerpo.ok) return
  assert.equal(cuerpo.valor.isExternal, false)
  assert.equal(cuerpo.valor.externalLabId, undefined)
})

test('pide laboratorio y días cuando el estudio es externo', () => {
  const sinLaboratorio = formularioACuerpo({ ...estudioAFormulario(HBA), externalLabId: '' }, 1)
  assert.equal(sinLaboratorio.ok, false)
  const sinDias = formularioACuerpo({ ...estudioAFormulario(HBA), turnaroundDays: '' }, 1)
  assert.equal(sinDias.ok, false)
  const costoMalo = formularioACuerpo({ ...estudioAFormulario(HBA), outsourcingCost: 'noventa' }, 1)
  assert.equal(costoMalo.ok, false)
})

test('lee volumen y costo escritos a mano', () => {
  assert.deepEqual(leerVolumen('2,5 mL'), { ok: true, valor: { cantidad: 2.5, unidad: 'mL' } })
  assert.deepEqual(leerVolumen('4'), { ok: true, valor: { cantidad: 4, unidad: 'ml' } })
  assert.equal(leerVolumen('mucho').ok, false)
  assert.deepEqual(leerCosto('$1,250.50'), { ok: true, valor: '1250.50' })
  assert.deepEqual(leerCosto(''), { ok: true, valor: '' })
  assert.equal(leerCosto('12.345').ok, false)
})

test('agrega y quita indicaciones; el ayuno se reemplaza', () => {
  const inicial = estudioAFormulario(HBA).indicaciones
  const conAyuno = agregarIndicacion(inicial, 'ayuno', '8')
  assert.equal(conAyuno.ok, true)
  if (!conAyuno.ok) return
  assert.equal(conAyuno.valor[0].texto, 'Ayuno de 8 horas')
  assert.equal(conAyuno.valor.length, 2)
  const otra = agregarIndicacion(conAyuno.valor, 'medicamentos', 'Suspender biotina 24 horas antes')
  assert.equal(otra.ok, true)
  if (!otra.ok) return
  assert.equal(otra.valor.length, 3)
  assert.equal(quitarIndicacion(otra.valor, 0).length, 2)
  assert.equal(agregarIndicacion(inicial, 'preparacion', '  ').ok, false)
  assert.equal(agregarIndicacion(inicial, 'ayuno', '80').ok, false)
})
