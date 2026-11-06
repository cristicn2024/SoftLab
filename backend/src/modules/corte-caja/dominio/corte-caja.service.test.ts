import test from 'node:test';
import assert from 'node:assert/strict';
import { ErrorDeDominio } from '../../../comun/errores';
import {
  BranchNotFoundError,
  CashCutFailedError,
  CashierNotFoundError,
  CutAlreadyClosedError,
  CutNotFoundError,
  InvalidDateError,
  NoBranchesError,
  ObservationRequiredError,
  TenantNotFoundError,
} from './corte-caja.errors';
import { FakeRepository } from './corte-caja.escenarios';
import { CorteCajaService } from './corte-caja.service';
import type { Scope } from './corte-caja.types';

const NOW = new Date(2026, 0, 15, 18, 0);
const SCOPE: Scope = { tenantId: 1, branchId: 10, cashierId: 5, shift: 'matutino', date: '2026-01-15' };

function at(hour: number): Date {
  return new Date(2026, 0, 15, hour);
}

function setup() {
  const repository = new FakeRepository();
  repository.addTenant(1, 'Lab Uno');
  repository.addBranch(1, 10, 'Sucursal corte');
  repository.addUser(1, 5, 'Cajero corte');
  repository.addUser(1, 6, 'Admin corte', 'admin');
  repository.addOrder(1, 10, 5, at(9), { totalAmount: 100, discountAmount: 10, payments: [{ method: 'cash', amount: 100 }] });
  repository.addOrder(1, 10, 5, at(10), {
    totalAmount: 250,
    payments: [
      { method: 'cash', amount: 200 },
      { method: 'card', amount: 50 },
    ],
  });
  repository.addOrder(1, 10, 5, at(12), { status: 'cancelled' });
  repository.addOrder(1, 10, 5, at(16), { payments: [{ method: 'cash', amount: 999 }] });
  repository.addOrder(1, 10, 6, at(10), { payments: [{ method: 'cash', amount: 777 }] });
  return { repository, service: new CorteCajaService(repository) };
}

async function rejectsWith(promise: Promise<unknown>, tipo: new () => Error, mensaje: string) {
  await assert.rejects(promise, function revisar(error: unknown) {
    assert.ok(error instanceof tipo);
    assert.equal((error as Error).message, mensaje);
    return true;
  });
}

test('el resumen abierto suma solo lo del turno y cajero', async () => {
  const { service } = setup();
  const res = await service.getSummary(SCOPE);
  assert.equal(res.status, 'open');
  assert.equal(res.cutId, null);
  assert.equal(res.summary.cashTotal, 300);
  assert.equal(res.summary.cardTotal, 50);
  assert.equal(res.summary.ordersCount, 3);
  assert.equal(res.summary.cancellationsCount, 1);
  assert.equal(res.scope.branchName, 'Sucursal corte');
  assert.equal(res.scope.cashierName, 'Cajero corte');
  assert.equal(res.scope.schedule, '08:00 – 15:00');
});

test('el resumen no cuenta los pagos anulados en cobro', async () => {
  const { repository, service } = setup();
  repository.addOrder(1, 10, 5, at(13), {
    totalAmount: 500,
    payments: [
      { method: 'cash', amount: 120 },
      { method: 'cash', amount: 380, cancelled: true },
    ],
  });
  const res = await service.getSummary(SCOPE);
  assert.equal(res.summary.cashTotal, 420);
  assert.equal(res.summary.expectedCash, 420);
  assert.equal(res.summary.totalPaid, 470);
});

test('sucursal y cajero inexistentes dan 404 antes de revisar la fecha', async () => {
  const { service } = setup();
  await rejectsWith(service.getSummary({ ...SCOPE, branchId: 99, date: '2026-02-30' }), BranchNotFoundError, 'Sucursal no encontrada');
  await rejectsWith(service.getSummary({ ...SCOPE, cashierId: 99, date: '2026-02-30' }), CashierNotFoundError, 'Cajero no encontrado');
  await rejectsWith(service.getSummary({ ...SCOPE, date: '2026-02-30' }), InvalidDateError, 'Fecha inválida');
});

test('otro laboratorio no ve sucursales ni cajeros ajenos', async () => {
  const { service } = setup();
  await rejectsWith(service.getSummary({ ...SCOPE, tenantId: 2 }), BranchNotFoundError, 'Sucursal no encontrada');
});

test('cerrar con diferencia exige observación', async () => {
  const { service, repository } = setup();
  await rejectsWith(
    service.closeCut(SCOPE, { countedCash: 290, closedById: 5 }, NOW),
    ObservationRequiredError,
    'La observación es obligatoria cuando el efectivo contado presenta una diferencia',
  );
  await rejectsWith(
    service.closeCut(SCOPE, { countedCash: 290, observation: '   ', closedById: 5 }, NOW),
    ObservationRequiredError,
    'La observación es obligatoria cuando el efectivo contado presenta una diferencia',
  );
  assert.equal(repository.cuts.length, 0);
});

test('cierra el corte, liga los pagos y congela el resumen', async () => {
  const { service, repository } = setup();
  const res = await service.closeCut(SCOPE, { countedCash: 290, observation: ' Faltante de cambio ', closedById: 5 }, NOW);

  assert.equal(res.status, 'closed');
  assert.equal(res.countedCash, 290);
  assert.equal(res.difference, -10);
  assert.equal(res.observation, 'Faltante de cambio');
  assert.equal(res.branch, 'Sucursal corte');
  assert.equal(res.cashier, 'Cajero corte');
  assert.equal(res.movements.length, 3);

  const linked: number[] = [];
  for (const fake of repository.orders) {
    if (fake.cashCutId === res.cutId) linked.push(fake.order.id);
  }
  assert.deepEqual(linked, [1, 2, 3]);

  repository.addOrder(1, 10, 5, at(11), { payments: [{ method: 'cash', amount: 50 }] });
  const frozen = await service.getSummary(SCOPE);
  assert.equal(frozen.status, 'closed');
  assert.equal(frozen.cutId, res.cutId);
  assert.equal(frozen.countedCash, 290);
  assert.equal(frozen.difference, -10);
  assert.equal(frozen.summary.cashTotal, 300);
  assert.equal(frozen.summary.totalPaid, 350);
  assert.equal(frozen.movements.length, 3);
  assert.equal(frozen.closedBy?.fullName, 'Cajero corte');

  await rejectsWith(
    service.closeCut(SCOPE, { countedCash: 290, observation: 'Otra vez', closedById: 5 }, NOW),
    CutAlreadyClosedError,
    'El corte de caja ya está cerrado y no puede modificarse',
  );
});

test('cerrar sin diferencia no necesita observación y la guarda como nula', async () => {
  const { service } = setup();
  const res = await service.closeCut(SCOPE, { countedCash: 300, closedById: null }, NOW);
  assert.equal(res.difference, 0);
  assert.equal(res.observation, null);
});

test('"Sin asignar" (cajero 0) usa un usuario técnico y no deja closedBy', async () => {
  const repository = new FakeRepository();
  repository.addTenant(1);
  repository.addBranch(1, 10);
  repository.addOrder(1, 10, null, at(9), { totalAmount: 200, payments: [{ method: 'cash', amount: 200 }] });
  const service = new CorteCajaService(repository);
  const scope: Scope = { tenantId: 1, branchId: 10, cashierId: 0, shift: 'matutino', date: '2026-01-15' };

  const abierto = await service.getSummary(scope);
  assert.equal(abierto.scope.cashierName, 'Sin asignar');
  assert.equal(abierto.summary.cashTotal, 200);
  assert.equal(await repository.findUnassignedUserId(1), null);

  const cierre = await service.closeCut(scope, { countedCash: 200, closedById: null }, NOW);
  assert.equal(cierre.cashier, 'Sin asignar');
  assert.ok((await repository.findUnassignedUserId(1)) !== null);
  assert.equal(repository.cuts[0].input.closedById, null);

  await assert.rejects(service.closeCut(scope, { countedCash: 200, closedById: null }, NOW), CutAlreadyClosedError);

  const cerrado = await service.getSummary(scope);
  assert.equal(cerrado.status, 'closed');
  assert.equal(cerrado.summary.cashTotal, 200);

  const historial = await service.getHistory(1);
  assert.equal(historial[0].cashier.fullName, 'Sin asignar');
  assert.equal(historial[0].closedBy, null);
});

test('el contexto devuelve laboratorio, cajeros, turnos y turno por defecto', async () => {
  const { service } = setup();
  const ctx = await service.getContext(1, NOW);
  assert.equal(ctx.tenant.name, 'Lab Uno');
  assert.equal(ctx.cashiers.length, 2);
  assert.equal(ctx.currentUser?.id, 5);
  assert.deepEqual(
    ctx.shifts.map((shift) => shift.value),
    ['matutino', 'vespertino', 'nocturno'],
  );
  assert.equal(ctx.today, '2026-01-15');
  assert.equal(ctx.defaultShift, 'vespertino');
});

test('el cajero por defecto es quien registró el último pago', async () => {
  const { service, repository } = setup();
  repository.addOrder(1, 10, 6, new Date(2026, 0, 15, 17, 30), { payments: [{ method: 'cash', amount: 1 }] });
  const ctx = await service.getContext(1, new Date(2026, 0, 15, 23));
  assert.equal(ctx.currentUser?.id, 6);
  assert.equal(ctx.defaultShift, 'vespertino');
});

test('sin usuarios registrados el contexto trae currentUser nulo y cajeros vacíos', async () => {
  const repository = new FakeRepository();
  repository.addTenant(1);
  repository.addBranch(1, 10);
  const ctx = await new CorteCajaService(repository).getContext(1, NOW);
  assert.equal(ctx.currentUser, null);
  assert.deepEqual(ctx.cashiers, []);
});

test('el contexto avisa si falta laboratorio o sucursales', async () => {
  const repository = new FakeRepository();
  const service = new CorteCajaService(repository);
  await rejectsWith(service.getContext(1, NOW), TenantNotFoundError, 'Laboratorio no encontrado');
  repository.addTenant(1);
  await rejectsWith(service.getContext(1, NOW), NoBranchesError, 'No hay sucursales registradas');
});

test('el historial y el CSV usan el corte guardado', async () => {
  const { service } = setup();
  const res = await service.closeCut(SCOPE, { countedCash: 290, observation: 'Faltante', closedById: 5 }, NOW);

  const historial = await service.getHistory(1);
  assert.equal(historial.length, 1);
  assert.equal(historial[0].branch.name, 'Sucursal corte');
  assert.equal(historial[0].expectedCash, 300);
  assert.equal(historial[0].closedBy?.id, 5);
  assert.deepEqual(await service.getHistory(2), []);

  const csv = await service.getCsv(1, res.cutId);
  assert.ok(csv.startsWith('"Reporte","Corte de caja"'));
  assert.match(csv, /Faltante/);
  await rejectsWith(service.getCsv(1, 999), CutNotFoundError, 'Corte de caja no encontrado');
  await rejectsWith(service.getCsv(2, res.cutId), CutNotFoundError, 'Corte de caja no encontrado');
});

test('un fallo inesperado del repositorio se vuelve error interno genérico', async () => {
  const { service, repository } = setup();
  const original = console.error;
  console.error = () => undefined;
  try {
    repository.failWith = new Error('se cayó la base');
    await rejectsWith(service.getSummary(SCOPE), CashCutFailedError, 'Error interno al procesar el corte de caja');
    await rejectsWith(service.getHistory(1), CashCutFailedError, 'Error interno al procesar el corte de caja');
    await assert.rejects(service.getContext(1, NOW), function revisar(error: unknown) {
      return error instanceof ErrorDeDominio;
    });
  } finally {
    console.error = original;
  }
});
