import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateLipids, canSaveResult, interpretResult, selectRange } from './interpretation.ts'

test('interpreta límites inclusivos y exclusivos, y valores críticos', () => {
  const inclusive = { low: 70, high: 99, lowInclusive: true, highInclusive: true, criticalLow: 40, criticalHigh: 500 }
  assert.equal(interpretResult(70, inclusive), 'Normal')
  assert.equal(interpretResult(99, inclusive), 'Normal')
  assert.equal(interpretResult(39, inclusive), 'LL')
  assert.equal(interpretResult(501, inclusive), 'HH')
  assert.equal(interpretResult(500, { ...inclusive, criticalHighInclusive: true }), 'HH')
  assert.equal(interpretResult(500, { ...inclusive, criticalHighInclusive: false }), 'H')
  const exclusive = { high: 150, highInclusive: false, low: 40, lowInclusive: false }
  assert.equal(interpretResult(150, exclusive), 'H')
  assert.equal(interpretResult(40, exclusive), 'L')
})

test('marca cualitativos anormales y exige notificación si el resultado es crítico', () => {
  assert.equal(interpretResult('Negativo', { expected: 'Negativo' }), 'Normal')
  assert.equal(interpretResult('Positivo', { expected: 'Negativo' }), 'A')
  assert.equal(canSaveResult('HH', false), false)
  assert.equal(canSaveResult('HH', true), true)
  assert.equal(canSaveResult('H', false), true)
})

test('selecciona rango por sexo y edad, sin adivinar cuando no hay coincidencia', () => {
  const ranges = [{ gender: 'F', minAgeYears: 18, maxAgeYears: 120 }, { gender: 'M', minAgeYears: 18, maxAgeYears: 120 }]
  assert.equal(selectRange(ranges, 'F', 38), ranges[0])
  assert.equal(selectRange(ranges, 'F', 12), undefined)
})

test('calcula LDL y VLDL con un decimal', () => {
  assert.deepEqual(calculateLipids(186, 52, 238), { ldl: 86.4, vldl: 47.6 })
})
