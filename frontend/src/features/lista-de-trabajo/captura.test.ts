import test from 'node:test'
import assert from 'node:assert/strict'
import { armarEntradas, banderaEnVivo, claveDe, hayParametrosSinRango, prepararValor, siguienteOrden } from './captura.ts'
import type { OrdenDeLista, ParametroPendiente } from './tipos.ts'

function parametro(id: number, conRegla: boolean): ParametroPendiente {
  let regla = null
  if (conRegla) {
    regla = {
      low: 70,
      high: 99,
      lowInclusive: true,
      highInclusive: true,
      criticalLow: 40,
      criticalHigh: 500,
      criticalLowInclusive: false,
      criticalHighInclusive: false,
      expected: null,
    }
  }
  return {
    orderItemId: 1000,
    parameterId: id,
    testName: 'Glucosa en ayuno',
    parameterName: `Parámetro ${id}`,
    unit: 'mg/dL',
    rangeText: null,
    previous: null,
    rule: regla,
  }
}

function orden(id: number): OrdenDeLista {
  return {
    orderId: id,
    folio: `SL-${id}`,
    receivedAt: null,
    capturedCount: 0,
    samples: [],
    patient: { id: id, fullName: 'Paciente', patientCode: null, gender: 'F', ageYears: 30 },
    pending: [],
  }
}

test('la coma decimal se acepta y el texto en un estudio numérico se rechaza', () => {
  const regla = parametro(1, true).rule
  assert.deepEqual(prepararValor(' 98,5 ', regla), { ok: true, valor: '98.5' })
  assert.equal(prepararValor('alto', regla).ok, false)
  assert.equal(prepararValor('   ', regla).ok, false)
  assert.deepEqual(prepararValor('turbio', null), { ok: true, valor: 'turbio' })
})

test('la bandera en vivo usa el rango del paciente y no inventa nada sin rango', () => {
  const regla = parametro(1, true).rule
  assert.equal(banderaEnVivo('85', regla), 'Normal')
  assert.equal(banderaEnVivo('120', regla), 'H')
  assert.equal(banderaEnVivo('30', regla), 'LL')
  assert.equal(banderaEnVivo('85', null), '—')
  assert.equal(banderaEnVivo('', regla), null)
  assert.equal(banderaEnVivo('abc', regla), null)
})

test('detecta parámetros sin rango para avisar al capturista', () => {
  assert.equal(hayParametrosSinRango([parametro(1, true), parametro(2, false)]), true)
  assert.equal(hayParametrosSinRango([parametro(1, true)]), false)
})

test('arma solo los resultados escritos y deja pasar los que no tienen rango', () => {
  const pendientes = [parametro(1, true), parametro(2, false), parametro(3, true)]
  const valores: Record<string, string> = {}
  valores[claveDe(pendientes[0])] = '90,5'
  valores[claveDe(pendientes[1])] = '85'

  const armado = armarEntradas(pendientes, valores)
  assert.equal(armado.ok, true)
  if (armado.ok) {
    assert.equal(armado.entradas.length, 2)
    assert.equal(armado.entradas[0].value, '90.5')
    assert.equal(armado.entradas[1].parameterId, 2)
  }
})

test('no arma la captura si está vacía, tiene texto inválido o un valor crítico', () => {
  const pendientes = [parametro(1, true)]
  const clave = claveDe(pendientes[0])

  assert.equal(armarEntradas(pendientes, {}).ok, false)
  assert.equal(armarEntradas(pendientes, { [clave]: 'alto' }).ok, false)

  const critico = armarEntradas(pendientes, { [clave]: '600' })
  assert.equal(critico.ok, false)
  if (!critico.ok) assert.match(critico.mensaje, /crítico/)
})

test('después de guardar abre la siguiente orden de la lista', () => {
  const antes = [orden(1), orden(2), orden(3)]
  assert.equal(siguienteOrden(antes, [orden(2), orden(3)], 1), 2)
  assert.equal(siguienteOrden(antes, [orden(1), orden(3)], 2), 3)
  assert.equal(siguienteOrden(antes, [orden(1), orden(2)], 3), 1)
  assert.equal(siguienteOrden(antes, [orden(1), orden(3)], 1), 3)
  assert.equal(siguienteOrden([orden(1)], [], 1), null)
})
