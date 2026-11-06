import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFolio,
  buildRule,
  calculateAge,
  describePrevious,
  interpretValue,
  pickRange,
  prepareValue,
} from './worklist.rules';
import type { RangeRecord, RangeRule } from './worklist.types';

function range(overrides: Partial<RangeRecord>): RangeRecord {
  return {
    gender: null,
    minAgeYears: null,
    maxAgeYears: null,
    low: null,
    high: null,
    lowInclusive: true,
    highInclusive: true,
    criticalLow: null,
    criticalHigh: null,
    criticalLowInclusive: false,
    criticalHighInclusive: false,
    display: '',
    ...overrides,
  };
}

function rule(overrides: Partial<RangeRule>): RangeRule {
  return {
    low: null,
    high: null,
    lowInclusive: true,
    highInclusive: true,
    criticalLow: null,
    criticalHigh: null,
    criticalLowInclusive: false,
    criticalHighInclusive: false,
    expected: null,
    ...overrides,
  };
}

test('la edad no suma un año hasta que llega el cumpleaños', () => {
  const today = new Date(2026, 10, 3);
  assert.equal(calculateAge(new Date(1988, 10, 3), today), 38);
  assert.equal(calculateAge(new Date(1988, 10, 4), today), 37);
  assert.equal(calculateAge(new Date(1988, 11, 1), today), 37);
});

test('elige el rango por sexo y edad, y no adivina si no hay coincidencia', () => {
  const ranges = [
    range({ gender: 'F', minAgeYears: 18, maxAgeYears: 120, display: 'mujer' }),
    range({ gender: 'M', minAgeYears: 18, maxAgeYears: 120, display: 'hombre' }),
  ];
  assert.equal(pickRange(ranges, 'F', 38)?.display, 'mujer');
  assert.equal(pickRange(ranges, 'M', 45)?.display, 'hombre');
  assert.equal(pickRange(ranges, 'F', 12), null);
  assert.equal(pickRange(ranges, 'M', 6), null);
});

test('un rango sin sexo aplica a cualquiera', () => {
  const ranges = [range({ minAgeYears: 0, maxAgeYears: 120, display: 'general' })];
  assert.equal(pickRange(ranges, 'M', 6)?.display, 'general');
});

test('sin rango y sin valor esperado no hay regla', () => {
  assert.equal(buildRule(null, null), null);
  assert.equal(buildRule(null, 'Negativo')?.expected, 'Negativo');
});

test('interpreta límites inclusivos, exclusivos y críticos', () => {
  const inclusive = rule({ low: 70, high: 99, criticalLow: 40, criticalHigh: 500 });
  assert.equal(interpretValue('70', inclusive), 'Normal');
  assert.equal(interpretValue('99', inclusive), 'Normal');
  assert.equal(interpretValue('100', inclusive), 'H');
  assert.equal(interpretValue('69', inclusive), 'L');
  assert.equal(interpretValue('39', inclusive), 'LL');
  assert.equal(interpretValue('501', inclusive), 'HH');
  assert.equal(interpretValue('500', { ...inclusive, criticalHighInclusive: true }), 'HH');
  assert.equal(interpretValue('500', { ...inclusive, criticalHighInclusive: false }), 'H');

  const exclusive = rule({ high: 150, highInclusive: false, low: 40, lowInclusive: false });
  assert.equal(interpretValue('150', exclusive), 'H');
  assert.equal(interpretValue('40', exclusive), 'L');
});

test('un estudio cualitativo compara contra el valor esperado', () => {
  const expected = rule({ expected: 'Negativo' });
  assert.equal(interpretValue('negativo', expected), 'Normal');
  assert.equal(interpretValue('Positivo', expected), 'A');
});

test('sin regla no hay interpretación automática', () => {
  assert.equal(interpretValue('85', null), '—');
  assert.equal(interpretValue('', rule({ low: 1 })), '—');
});

test('prepareValue acepta coma decimal y rechaza texto en estudios numéricos', () => {
  const numeric = rule({ low: 70, high: 99 });
  assert.deepEqual(prepareValue(' 98,5 ', numeric), { ok: true, value: '98.5' });
  assert.equal(prepareValue('alto', numeric).ok, false);
  assert.equal(prepareValue('   ', numeric).ok, false);
});

test('prepareValue acepta texto si es cualitativo o no hay regla', () => {
  assert.deepEqual(prepareValue('Positivo', rule({ expected: 'Negativo' })), { ok: true, value: 'Positivo' });
  assert.deepEqual(prepareValue('turbio', null), { ok: true, value: 'turbio' });
});

test('el folio usa el de la orden y si no hay arma uno con el id', () => {
  assert.equal(buildFolio('SL-261020-0057', 3), 'SL-261020-0057');
  assert.equal(buildFolio(null, 123), 'ORD-000123');
});

test('el valor anterior lleva su fecha cuando existe', () => {
  assert.equal(describePrevious('98', '10 oct'), '98 (10 oct)');
  assert.equal(describePrevious('98', null), '98');
  assert.equal(describePrevious(null, '10 oct'), null);
});
