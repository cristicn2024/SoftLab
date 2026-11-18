import assert from 'node:assert/strict';
import test from 'node:test';
import { DatoExternoInvalidoError, FiltroInvalidoError } from './externos.errors';
import { estudio } from './externos.escenarios';
import { armarEnvios, filtrarEstudios, folioDeEnvio, leerDatosExternos, leerFiltro, resumir } from './externos.rules';

test('marca un estudio como externo con laboratorio, días y maquila', () => {
  const datos = leerDatosExternos({ isExternal: true, externalLabId: '2', turnaroundDays: '3', outsourcingCost: '90.00' });
  assert.deepEqual(datos, { externalLabId: 2, turnaroundDays: 3, outsourcingCost: 90 });
});

test('el costo de maquila es opcional', () => {
  const datos = leerDatosExternos({ isExternal: true, externalLabId: 2, turnaroundDays: 5, outsourcingCost: '' });
  assert.deepEqual(datos, { externalLabId: 2, turnaroundDays: 5, outsourcingCost: null });
});

test('al apagar el interruptor se limpian los datos externos', () => {
  const datos = leerDatosExternos({ isExternal: false, externalLabId: 2, turnaroundDays: 5, outsourcingCost: 10 });
  assert.deepEqual(datos, { externalLabId: null, turnaroundDays: null, outsourcingCost: null });
});

test('si la pantalla no manda la sección no se toca', () => {
  assert.equal(leerDatosExternos({ code: 'X' }), undefined);
});

test('rechaza datos externos incompletos o inválidos', () => {
  const invalidos: Record<string, unknown>[] = [
    { isExternal: 'si' },
    { isExternal: true, turnaroundDays: 3 },
    { isExternal: true, externalLabId: 1 },
    { isExternal: true, externalLabId: 1, turnaroundDays: 0 },
    { isExternal: true, externalLabId: 1, turnaroundDays: 2.5 },
    { isExternal: true, externalLabId: 1, turnaroundDays: 400 },
    { isExternal: true, externalLabId: 1, turnaroundDays: 3, outsourcingCost: -1 },
    { isExternal: true, externalLabId: 1, turnaroundDays: 3, outsourcingCost: '12.345' },
    { isExternal: true, externalLabId: 1, turnaroundDays: 3, outsourcingCost: 'abc' },
  ];
  for (const cuerpo of invalidos) {
    assert.throws(() => leerDatosExternos(cuerpo), DatoExternoInvalidoError);
  }
});

test('filtra por laboratorio, estatus y texto sin importar acentos', () => {
  const estudios = [
    estudio(1, 'HBA001', 'Hemoglobina glucosilada', 1, 'Referencia Nacional'),
    estudio(2, 'EXT001', 'Vitamina D', 2, 'Referencia del Norte'),
    estudio(3, 'EXT002', 'Hormona antimülleriana', 1, 'Referencia Nacional', false),
  ];
  assert.equal(filtrarEstudios(estudios, leerFiltro('', '1', 'todos')).length, 2);
  assert.equal(filtrarEstudios(estudios, leerFiltro('', '1', 'activos')).length, 1);
  assert.equal(filtrarEstudios(estudios, leerFiltro('', undefined, 'inactivos'))[0].code, 'EXT002');
  assert.equal(filtrarEstudios(estudios, leerFiltro('mulleriana', '', ''))[0].id, 3);
  assert.equal(filtrarEstudios(estudios, leerFiltro('ext0', 'todos', undefined)).length, 2);
});

test('rechaza filtros inválidos', () => {
  assert.throws(() => leerFiltro('', 'abc', 'todos'), FiltroInvalidoError);
  assert.throws(() => leerFiltro('', '1', 'pendientes'), FiltroInvalidoError);
  assert.throws(() => leerFiltro('x'.repeat(101), '', ''), FiltroInvalidoError);
});

test('el resumen cuenta estudios por laboratorio y activos', () => {
  const resumen = resumir([
    estudio(1, 'A', 'A', 1, 'Nacional'),
    estudio(2, 'B', 'B', 2, 'Norte'),
    estudio(3, 'C', 'C', 1, 'Nacional', false),
  ]);
  assert.deepEqual(resumen, {
    total: 3,
    activos: 2,
    porLaboratorio: [
      { laboratorio: 'Nacional', cantidad: 2 },
      { laboratorio: 'Norte', cantidad: 1 },
    ],
  });
});

test('el folio de envío usa la fecha y un consecutivo de 4 dígitos', () => {
  assert.equal(folioDeEnvio(new Date('2026-10-10T16:18:00Z'), 1), 'ENV-261010-0001');
});

test('solo los estudios externos generan orden de envío, una por estudio', () => {
  const envios = armarEnvios(
    [
      { testId: 1, externalLabId: null, turnaroundDays: null, outsourcingCost: null },
      { testId: 2, externalLabId: 7, turnaroundDays: 3, outsourcingCost: 90 },
      { testId: 2, externalLabId: 7, turnaroundDays: 3, outsourcingCost: 90 },
      { testId: 3, externalLabId: 8, turnaroundDays: null, outsourcingCost: null },
    ],
    new Date('2026-10-10T16:18:00Z'),
    4,
  );
  assert.deepEqual(envios, [
    { testId: 2, externalLabId: 7, folio: 'ENV-261010-0005', estimatedDays: 3, outsourcingCost: 90 },
    { testId: 3, externalLabId: 8, folio: 'ENV-261010-0006', estimatedDays: 1, outsourcingCost: null },
  ]);
});
