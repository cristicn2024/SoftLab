import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildConcepts,
  buildFolio,
  buildOrderItems,
  normalizeQuery,
  parseOpenOrderPatientId,
  startOfDay,
} from './ordenes.rules';
import { catalogProfile, catalogTest } from './ordenes.escenarios';

test('la búsqueda se recorta y lo vacío no cuenta', () => {
  assert.equal(normalizeQuery('  BH  '), 'BH');
  assert.equal(normalizeQuery(''), '');
  assert.equal(normalizeQuery(undefined), '');
  assert.equal(normalizeQuery(null), '');
  assert.equal(normalizeQuery(['a', 'b']), 'a,b');
});

test('los estudios van primero y los perfiles después, con su restricción de sexo', () => {
  const concepts = buildConcepts(
    [catalogTest(1, { genderRestriction: 'F' }), catalogTest(2)],
    [catalogProfile(9, [1, 2])],
  );
  assert.deepEqual(
    concepts.map((c) => [c.type, c.id, c.genderRestriction, c.includedTestIds]),
    [
      ['TEST', 1, 'F', [1]],
      ['TEST', 2, 'BOTH', [2]],
      ['PROFILE', 9, 'BOTH', [1, 2]],
    ],
  );
});

test('el folio usa la fecha en UTC y el consecutivo del día con cuatro cifras', () => {
  const now = new Date(Date.UTC(2026, 10, 3, 15, 0));
  assert.equal(buildFolio(now, 0), 'ORD-20261103-0001');
  assert.equal(buildFolio(now, 41), 'ORD-20261103-0042');
  assert.equal(buildFolio(now, 12344), 'ORD-20261103-12345');
});

test('el inicio del día se calcula en hora local', () => {
  const start = startOfDay(new Date(2026, 10, 3, 17, 45, 12));
  assert.equal(start.getHours(), 0);
  assert.equal(start.getMinutes(), 0);
  assert.equal(start.getDate(), 3);
});

test('los conceptos de la orden separan estudios y perfiles y descartan los vacíos', () => {
  const items = buildOrderItems([
    { id: 5, type: 'TEST', price: 150 },
    { id: 7, type: 'PROFILE', price: '300' },
    { id: 8 },
    { type: 'PROFILE', price: 10 },
    {},
    null,
    0,
  ]);
  assert.deepEqual(items, [
    { price: 150, testId: 5 },
    { price: 300, profileId: 7 },
    { price: 0, testId: 8 },
    { price: 10, profileId: Number.NaN },
  ]);
  assert.deepEqual(buildOrderItems(undefined), []);
  assert.deepEqual(buildOrderItems('no es lista'), []);
});

test('el id de paciente de la consulta solo cuenta si es un número distinto de cero', () => {
  assert.equal(parseOpenOrderPatientId('12'), 12);
  assert.equal(parseOpenOrderPatientId('abc'), null);
  assert.equal(parseOpenOrderPatientId('0'), null);
  assert.equal(parseOpenOrderPatientId(undefined), null);
  assert.equal(parseOpenOrderPatientId('-3'), -3);
});
