import test from 'node:test';
import assert from 'node:assert/strict';
import { ageFrom, calculateTotal, money, RFC_PATTERN, toCents, toPesos } from './cobro.rules';

test('toCents y toPesos redondean a centavos', () => {
  assert.equal(toCents('10.005'), 1001);
  assert.equal(toCents(250), 25000);
  assert.equal(toPesos(25000), '250.00');
  assert.equal(toPesos(5), '0.05');
});

test('money da formato de pesos mexicanos', () => {
  assert.equal(money(5000), '$50.00');
  assert.equal(money(123456), '$1,234.56');
});

test('calculateTotal aplica el descuento sin impuestos', () => {
  assert.deepEqual(calculateTotal(25000, 10), { discount: 2500, taxes: 0, total: 22500 });
  assert.deepEqual(calculateTotal(25000, 0), { discount: 0, taxes: 0, total: 25000 });
});

test('la edad no suma un año hasta el cumpleaños', () => {
  const today = new Date(2026, 10, 3);
  assert.equal(ageFrom(new Date(1990, 10, 3), today), 36);
  assert.equal(ageFrom(new Date(1990, 10, 4), today), 35);
  assert.equal(ageFrom(new Date(1990, 0, 1), today), 36);
});

test('el RFC acepta personas físicas y morales', () => {
  assert.equal(RFC_PATTERN.test('ABC010101AB1'), true);
  assert.equal(RFC_PATTERN.test('ABCD010101AB1'), true);
  assert.equal(RFC_PATTERN.test('NO-ES-RFC'), false);
});
