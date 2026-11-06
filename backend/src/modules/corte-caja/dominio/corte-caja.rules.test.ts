import test from 'node:test';
import assert from 'node:assert/strict';
import { InvalidDateError, InvalidShiftError } from './corte-caja.errors';
import {
  buildCsv,
  buildLiveSummary,
  defaultShiftFor,
  formatLocalDate,
  methodForOrder,
  parseDateOnly,
  parseSnapshot,
  resolvePeriod,
  round2,
  shiftForHour,
} from './corte-caja.rules';
import type { LiveOrder } from './corte-caja.types';

function order(id: number, overrides: Partial<LiveOrder> = {}): LiveOrder {
  return {
    id,
    createdAt: new Date(2026, 0, 15, 9),
    folio: `F-${id}`,
    status: 'completed',
    totalAmount: 100,
    discountAmount: 0,
    patientFirstName: 'Ana',
    patientLastName: 'López',
    payments: [],
    ...overrides,
  };
}

test('asigna el turno según la hora del día', () => {
  assert.equal(shiftForHour(7), 'nocturno');
  assert.equal(shiftForHour(8), 'matutino');
  assert.equal(shiftForHour(14), 'matutino');
  assert.equal(shiftForHour(15), 'vespertino');
  assert.equal(shiftForHour(21), 'vespertino');
  assert.equal(shiftForHour(22), 'nocturno');
  assert.equal(shiftForHour(0), 'nocturno');
  assert.equal(defaultShiftFor(new Date(2026, 0, 1, 16)), 'vespertino');
});

test('el turno nocturno termina al día siguiente', () => {
  const { start, end } = resolvePeriod('2026-01-15', 'nocturno');
  assert.equal(start.getDate(), 15);
  assert.equal(start.getHours(), 22);
  assert.equal(end.getDate(), 16);
  assert.equal(end.getHours(), 8);
});

test('un turno desconocido se rechaza', () => {
  assert.throws(() => resolvePeriod('2026-01-15', 'tarde' as never), InvalidShiftError);
});

test('valida fechas reales y rechaza días inexistentes', () => {
  assert.equal(formatLocalDate(new Date(2024, 1, 29)), '2024-02-29');
  const parsed = parseDateOnly('2024-02-29');
  assert.equal(parsed.getUTCFullYear(), 2024);
  assert.equal(parsed.getUTCMonth(), 1);
  assert.equal(parsed.getUTCDate(), 29);
  assert.throws(() => parseDateOnly('2026-02-30'), InvalidDateError);
  assert.throws(() => parseDateOnly('2026-13-01'), InvalidDateError);
  assert.throws(() => parseDateOnly('sin-fecha'), InvalidDateError);
});

test('redondea a centavos', () => {
  assert.equal(round2(1.005), 1.01);
  assert.equal(round2(10.994), 10.99);
  assert.equal(round2(0), 0);
});

test('clasifica el método de cada orden', () => {
  assert.deepEqual(methodForOrder('cancelled', [{ method: 'cash', amount: 1 }]), { method: 'cancelled', label: 'Cancelado' });
  assert.deepEqual(methodForOrder('pending', []), { method: 'pending', label: 'Pendiente' });
  assert.deepEqual(methodForOrder('completed', [{ method: 'card', amount: 1 }]), { method: 'card', label: 'Tarjeta' });
  assert.deepEqual(
    methodForOrder('completed', [
      { method: 'cash', amount: 1 },
      { method: 'card', amount: 1 },
    ]),
    { method: 'mixed', label: 'Efectivo + tarjeta' },
  );
  assert.deepEqual(
    methodForOrder('completed', [
      { method: 'cash', amount: 1 },
      { method: 'transfer', amount: 1 },
    ]),
    { method: 'mixed', label: 'Mixto' },
  );
});

test('acumula totales por método, descuentos y cancelaciones', () => {
  const start = new Date(2026, 0, 15, 8);
  const end = new Date(2026, 0, 15, 15);
  const live = buildLiveSummary(
    [
      order(1, { discountAmount: 10, payments: [{ method: 'cash', amount: 100 }] }),
      order(2, {
        totalAmount: 250,
        payments: [
          { method: 'cash', amount: 200.1 },
          { method: 'card', amount: 49.9 },
        ],
      }),
      order(3, { payments: [{ method: 'transfer', amount: 75 }] }),
      order(4, { status: 'cancelled' }),
      order(5, { folio: null }),
    ],
    start,
    end,
  );

  assert.deepEqual(live.summary, {
    cashTotal: 300.1,
    cardTotal: 49.9,
    transferTotal: 75,
    ordersCount: 5,
    discountsTotal: 10,
    cancellationsCount: 1,
    totalPaid: 425,
    expectedCash: 300.1,
  });
  assert.equal(live.movements[4].folio, 'ORD-000005');
  assert.equal(live.movements[0].patient, 'Ana López');
});

test('parseSnapshot tolera datos vacíos o dañados', () => {
  assert.equal(parseSnapshot(null), null);
  assert.equal(parseSnapshot('{no es json'), null);
  assert.deepEqual(parseSnapshot('{"movements":[]}'), { movements: [] });
});

test('el CSV escapa comillas y separa con CRLF', () => {
  const csv = buildCsv({
    branchName: 'Sucursal "Centro"',
    cashierName: 'Cajero',
    shift: 'matutino',
    cutDate: new Date(Date.UTC(2026, 0, 15)),
    status: 'closed',
    expectedCash: 300,
    countedCash: 290,
    difference: -10,
    observation: null,
    closedByName: null,
    closedAt: null,
    snapshotJson: null,
  });
  const lines = csv.split('\r\n');
  assert.equal(lines[0], '"Reporte","Corte de caja"');
  assert.equal(lines[1], '"Sucursal","Sucursal ""Centro"""');
  assert.equal(lines[4], '"Fecha","2026-01-15"');
  assert.equal(lines[9], '"Observación",""');
  assert.equal(lines[lines.length - 1], '"HORA","FOLIO","PACIENTE","MÉTODO","MONTO"');
});
