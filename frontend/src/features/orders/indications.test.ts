import test from 'node:test'
import assert from 'node:assert/strict'
import { consolidateInstructions, canContinueToCheckout } from './indications.ts'

test('mantiene distintos requisitos de ayuno y agrupa indicaciones configuradas', () => {
  const result = consolidateInstructions([
    { type: 'fasting', minHours: 8, maxHours: 12, text: 'Ayuno 8–12 h', study: 'Glucosa en ayuno' },
    { type: 'fasting', minHours: 12, maxHours: 12, text: 'Ayuno 12 h', study: 'Perfil lipídico' },
    { type: 'first_urine', text: 'Primera orina', study: 'Examen general de orina' },
  ])
  assert.equal(result[0].title, 'Ayuno de 8 horas')
  assert.deepEqual(result[0].studies, ['Glucosa en ayuno'])
  assert.match(result[0].note ?? '', /revisión/i)
  assert.equal(result[1].title, 'Ayuno de 12 horas')
  assert.deepEqual(result[2].studies, ['Examen general de orina'])
})

test('bloquea continuar al cobro mientras falte confirmar indicaciones', () => {
  assert.equal(canContinueToCheckout(true, false), false)
  assert.equal(canContinueToCheckout(true, true), true)
  assert.equal(canContinueToCheckout(false, false), true)
})
