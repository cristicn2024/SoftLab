import test from 'node:test';
import assert from 'node:assert/strict';
import { ResultsAlreadyDeliveredError } from './cobro.errors';
import { FakeRepository, order } from './cobro.escenarios';
import { CobroService } from './cobro.service';
import type { Actor } from './cobro.types';

const HOY = new Date(2026, 10, 19);
const ADMIN: Actor = { tenantId: 1, name: 'Administradora QA', isAdmin: true };

function setup() {
  const repository = new FakeRepository();
  return { repository, service: new CobroService(repository) };
}

test('HU 5.3 · combina efectivo, tarjeta y transferencia en un solo cobro con cambio', async () => {
  const { repository, service } = setup();
  repository.add(1, order(10, { prices: [250] }));

  const cobro = await service.registerPayments(
    ADMIN,
    10,
    {
      payments: [
        { method: 'cash', amount: 100 },
        { method: 'card', amount: 100, reference: 'AUTH-123' },
        { method: 'transfer', amount: 50, reference: 'TR-987' },
      ],
      cashReceived: 150,
    },
    HOY,
  );

  assert.equal(cobro.total, '250.00');
  assert.equal(cobro.paid, '250.00');
  assert.equal(cobro.balance, '0.00');
  assert.deepEqual(cobro.payments.map((pago) => pago.method), ['cash', 'card', 'transfer']);
  assert.equal(cobro.payments[1].reference, 'AUTH-123');
  assert.equal(cobro.payments[2].reference, 'TR-987');
  assert.ok(cobro.logs.some((log) => /cambio \$50\.00/.test(log.detail)));
});

test('HU 5.3 · un pago parcial deja saldo por cobrar y bitácora de pendiente', async () => {
  const { repository, service } = setup();
  repository.add(1, order(11, { prices: [250] }));

  const parcial = await service.registerPayments(
    ADMIN,
    11,
    { payments: [{ method: 'cash', amount: 100 }] },
    HOY,
  );

  assert.equal(parcial.paid, '100.00');
  assert.equal(parcial.balance, '150.00');
  const pendiente = parcial.logs.find((log) => log.action === 'Orden pendiente de pago');
  assert.ok(pendiente);
  assert.match(pendiente.detail, /Saldo por cobrar \$150\.00/);
});

test('HU 5.3 · se puede cobrar antes de entregar resultados y no después', async () => {
  const { repository, service } = setup();
  repository.add(1, order(12, { prices: [250], resultsDeliveredAt: null }));
  repository.add(1, order(13, { prices: [250], resultsDeliveredAt: new Date(2026, 10, 18) }));

  const antesDeEntregar = await service.registerPayments(
    ADMIN,
    12,
    { payments: [{ method: 'cash', amount: 250 }] },
    HOY,
  );
  assert.equal(antesDeEntregar.balance, '0.00');
  assert.equal(antesDeEntregar.resultsDelivered, false);

  await assert.rejects(
    service.registerPayments(
      ADMIN,
      13,
      { payments: [{ method: 'cash', amount: 10 }] },
      HOY,
    ),
    ResultsAlreadyDeliveredError,
  );
});
