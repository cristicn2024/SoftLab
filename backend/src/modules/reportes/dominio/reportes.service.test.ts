import test from 'node:test';
import assert from 'node:assert/strict';
import { ErrorDeDominio } from '../../../comun/errores';
import { CancelledOrderError, InvalidChannelError, ReleaseOrderNotFoundError, ReportGenerationError } from './reportes.errors';
import { FakeRenderer, FakeRepository, releaseOrder } from './reportes.escenarios';
import { buildPdfData, parseChannel, pendingBalance, ReportesService } from './reportes.service';
import type { Actor, Channel, ReleaseOrder } from './reportes.types';

const NOW = new Date(2026, 10, 3, 10, 0);
const ANA: Actor = { tenantId: 1, name: 'Ana', isAdmin: false };
const ADMIN: Actor = { tenantId: 1, name: 'Ana', isAdmin: true };

function setup(overrides: Partial<ReleaseOrder> = {}) {
  const repository = new FakeRepository();
  repository.add(1, releaseOrder(7, overrides));
  const renderer = new FakeRenderer();
  return { repository, renderer, service: new ReportesService(repository, renderer) };
}

for (const channel of ['counter', 'email', 'portal', 'print']) {
  test(`bloquea saldo en ${channel} sin generar resultados`, async () => {
    const { repository, renderer, service } = setup();
    const result = await service.release(ANA, 7, channel, undefined, NOW);
    assert.equal(result.kind, 'blocked');
    if (result.kind === 'blocked') {
      assert.equal(result.balance, '100.00');
      assert.equal(result.paymentUrl, '/ordenes/cobro?orden=7');
      assert.equal(result.message, 'Entrega bloqueada. Saldo pendiente: $100.00.');
    }
    assert.equal(renderer.received.length, 0);
    assert.equal(repository.stored(1, 7)?.delivered, null);
    assert.equal(repository.logs[0].action, 'Entrega bloqueada');
    assert.match(repository.logs[0].detail, new RegExp(channel));
  });
}

test('liquidar desbloquea automáticamente sin autorización persistente', async () => {
  const { repository, service } = setup({ payments: [{ amount: 100, cancelled: false }] });
  const result = await service.release(ANA, 7, 'counter', undefined, NOW);
  assert.equal(result.kind, 'released');
  assert.deepEqual(repository.stored(1, 7)?.delivered, NOW);
});

test('pago parcial y pago cancelado no liberan', async () => {
  const { service } = setup({
    payments: [
      { amount: 40, cancelled: false },
      { amount: 60, cancelled: true },
    ],
  });
  const result = await service.release(ANA, 7, 'counter', undefined, NOW);
  assert.equal(result.kind === 'blocked' ? result.balance : '', '60.00');
});

test('admin sin motivo sigue bloqueado', async () => {
  const { service } = setup();
  assert.equal((await service.release(ADMIN, 7, 'counter', ' ', NOW)).kind, 'blocked');
});

test('recepcionista no puede autorizar aunque proporcione motivo', async () => {
  const { service } = setup();
  assert.equal((await service.release(ANA, 7, 'counter', 'Urgente', NOW)).kind, 'blocked');
});

test('excepción registra motivo, usuario y saldo', async () => {
  const { repository, service } = setup();
  const result = await service.release(ADMIN, 7, 'counter', 'Urgencia autorizada', NOW);
  assert.equal(result.kind, 'released');
  assert.equal(repository.logs[0].action, 'Excepción de entrega autorizada');
  assert.match(repository.logs[0].detail, /Urgencia autorizada/);
  assert.equal(repository.logs[0].userName, 'Ana');
  assert.equal(repository.logs[1].action, 'Resultados entregados');
});

test('descuento se calcula en centavos y permite total cero', async () => {
  const { service } = setup({ discountPercent: 100 });
  assert.equal((await service.release(ANA, 7, 'counter', undefined, NOW)).kind, 'released');
});

test('orden cancelada nunca se entrega', async () => {
  const { renderer, service } = setup({ status: 'cancelled' });
  await assert.rejects(service.release(ADMIN, 7, 'counter', 'Motivo', NOW), CancelledOrderError);
  assert.equal(renderer.received.length, 0);
});

test('motivo demasiado largo no autoriza la excepción', async () => {
  const { service } = setup();
  assert.equal((await service.release(ADMIN, 7, 'counter', 'a'.repeat(1001), NOW)).kind, 'blocked');
});

test('cada nuevo acceso vuelve a comprobar el saldo', async () => {
  const payments: { amount: number; cancelled: boolean }[] = [];
  const { service } = setup({ payments });
  assert.equal((await service.release(ANA, 7, 'counter', undefined, NOW)).kind, 'blocked');
  payments.push({ amount: 100, cancelled: false });
  assert.equal((await service.release(ANA, 7, 'counter', undefined, NOW)).kind, 'released');
});

test('una orden inexistente o de otro laboratorio da 404', async () => {
  const { service } = setup();
  await assert.rejects(service.release(ANA, 99, 'counter', undefined, NOW), ReleaseOrderNotFoundError);
  await assert.rejects(service.release({ ...ANA, tenantId: 2 }, 7, 'counter', undefined, NOW), ReleaseOrderNotFoundError);
});

test('el canal por omisión es counter y uno desconocido se rechaza', async () => {
  assert.equal(parseChannel(undefined), 'counter');
  assert.equal(parseChannel(null), 'counter');
  const valid: Channel[] = ['counter', 'email', 'portal', 'print'];
  for (const channel of valid) assert.equal(parseChannel(channel), channel);
  assert.throws(() => parseChannel('fax'), InvalidChannelError);
  assert.throws(() => parseChannel(['email']), InvalidChannelError);
  assert.throws(() => parseChannel(5), InvalidChannelError);
});

test('sin plantilla predeterminada no se emite ni se marca como entregado', async () => {
  const { repository, service } = setup({ payments: [{ amount: 100, cancelled: false }] });
  repository.template = null;
  await assert.rejects(service.release(ANA, 7, 'counter', undefined, NOW), ReportGenerationError);
  assert.equal(repository.stored(1, 7)?.qrToken, null);
  assert.equal(repository.stored(1, 7)?.delivered, null);
  assert.equal(repository.logs.length, 0);
});

test('si falla el PDF todo se revierte y el error es de generación', async () => {
  const { repository, renderer, service } = setup({ payments: [{ amount: 100, cancelled: false }] });
  renderer.failWith = new Error('chromium no arrancó');
  const original = console.error;
  console.error = () => undefined;
  try {
    await assert.rejects(service.release(ANA, 7, 'counter', undefined, NOW), ReportGenerationError);
  } finally {
    console.error = original;
  }
  assert.equal(repository.stored(1, 7)?.delivered, null);
  assert.equal(repository.logs.length, 0);
});

test('los errores de dominio no se esconden detrás del error de generación', async () => {
  const { service } = setup({ status: 'cancelled' });
  await assert.rejects(service.release(ANA, 7, 'counter', undefined, NOW), ErrorDeDominio);
});

test('el saldo pendiente nunca es negativo', () => {
  assert.equal(pendingBalance(releaseOrder(1, { payments: [{ amount: 500, cancelled: false }] })), 0);
});

test('arma los datos del PDF con los mismos valores de siempre', async () => {
  const { repository, renderer, service } = setup({ payments: [{ amount: 100, cancelled: false }] });
  await service.release(ANA, 7, 'portal', undefined, NOW);
  const data = renderer.received[0];
  assert.equal(data.folio, 'SL-7');
  assert.equal(data.doctorName, 'Particular');
  assert.equal(data.patient.fullName, 'Paciente Orden 7');
  assert.equal(data.patient.ageYears, 36);
  assert.equal(data.qrToken, 'token-7');
  assert.equal(data.template.logoUrl, undefined);
  assert.equal(data.template.signatureUrl, 'firma.png');
  assert.equal(data.resultsByArea[0].areaName, 'LABORATORIO CLÍNICO GENERAL');
  assert.deepEqual(data.resultsByArea[0].items[0], {
    testName: 'Glucosa', resultValue: '90', units: 'mg/dL', referenceRange: '70 - 99', flag: 'NORMAL',
  });
  assert.deepEqual(data.resultsByArea[0].items[1], {
    testName: 'Perfil lipídico', resultValue: 'N/A', units: 'mg/dL', referenceRange: 'Normal', flag: 'HIGH',
  });
  assert.equal(data.resultsByArea[0].items[2].testName, 'Concepto sin nombre');
  assert.equal(repository.stored(1, 7)?.qrToken, 'token-7');
});

test('sin folio se arma uno con el id y un médico se muestra como Dr.', () => {
  const { repository } = setup();
  const stored = repository.stored(1, 7);
  assert.ok(stored);
  const report = { ...stored.report, folio: null, doctorName: 'Ruiz' };
  const template = { id: 1, primaryColor: '#000', logoUrl: 'logo.png', signatureUrl: null, chemistName: null, chemistCedula: null };
  const data = buildPdfData(report, template, 'tok', NOW);
  assert.equal(data.folio, 'ORD-000007');
  assert.equal(data.doctorName, 'Dr. Ruiz');
  assert.equal(data.template.logoUrl, 'logo.png');
});

test('verify entrega los datos o nada', async () => {
  const { repository, service } = setup();
  repository.verified.set('abc', { laboratory: 'Lab', patient: 'Ana Pérez', issuedAt: NOW });
  assert.deepEqual(await service.verify('abc'), { laboratory: 'Lab', patient: 'Ana Pérez', issuedAt: NOW });
  assert.equal(await service.verify('nope'), null);
});
