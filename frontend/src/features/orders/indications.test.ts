import test from 'node:test'
import assert from 'node:assert/strict'
import { consolidateInstructions, canContinueToCheckout } from './indications.ts'

test('consolida ayunos con la duración más estricta y agrupa indicaciones por tipo', () => {
  const result = consolidateInstructions([
    { type: 'fasting', minHours: 8, maxHours: 12, text: 'Ayuno 8–12 h', study: 'Glucosa en ayuno' },
    { type: 'fasting', minHours: 12, maxHours: 12, text: 'Ayuno 12 h', study: 'Perfil lipídico' },
    { type: 'first_urine', text: 'Primera orina', study: 'Examen general de orina' },
  ])
  assert.equal(result[0].title, 'Ayuno de 12 horas')
  assert.deepEqual(result[0].studies, ['Glucosa en ayuno', 'Perfil lipídico'])
  assert.match(result[0].note ?? '', /más estricta/i)
  assert.equal(result[1].studies[0], 'Examen general de orina')
})

test('bloquea continuar al cobro mientras falte confirmar indicaciones', () => {
  assert.equal(canContinueToCheckout(true, false), false)
  assert.equal(canContinueToCheckout(true, true), true)
  assert.equal(canContinueToCheckout(false, false), true)
})
