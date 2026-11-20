import test from 'node:test';
import assert from 'node:assert/strict';
import { CobroPrismaRepository } from './cobro-prisma.repository';

test('HU 5.3 · el pago y su bitácora se guardan en la sucursal de la orden', async () => {
  const pagosCreados: Record<string, unknown>[] = [];
  const logsCreados: Record<string, unknown>[] = [];
  const ordenesActualizadas: Record<string, unknown>[] = [];

  const tx = {
    $queryRaw: async () => [],
    order: {
      findFirst: async () => ({ id: 42, branchId: 9, items: [], payments: [] }),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        ordenesActualizadas.push(data);
        return {};
      },
    },
    payment: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        pagosCreados.push(data);
        return {};
      },
    },
    paymentLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        logsCreados.push(data);
        return {};
      },
    },
  };
  const prisma = { $transaction: async (work: (tx: unknown) => Promise<void>) => work(tx) };
  const repositorio = new CobroPrismaRepository(prisma as never);

  await repositorio.registerPayments(3, 42, (orden) => {
    assert.equal(orden.branchId, 9);
    return {
      userName: 'Laura Méndez',
      order: {
        discountPercent: 0,
        discountReason: null,
        discountAuthorizedBy: null,
        totalAmount: '250.00',
        paidAmount: '100.00',
        invoice: null,
      },
      payments: [{ method: 'cash', amount: '100.00', reference: null, createdBy: 'Laura Méndez' }],
      logs: [{ action: 'Registró pago', detail: 'Efectivo · $100.00' }],
    };
  });

  assert.equal(ordenesActualizadas.length, 1);
  assert.equal(pagosCreados.length, 1);
  assert.equal(pagosCreados[0].tenantId, 3);
  assert.equal(pagosCreados[0].orderId, 42);
  assert.equal(pagosCreados[0].branchId, 9);
  assert.equal(pagosCreados[0].method, 'cash');
  assert.equal(logsCreados.length, 1);
  assert.equal(logsCreados[0].tenantId, 3);
  assert.equal(logsCreados[0].orderId, 42);
  assert.equal(logsCreados[0].userName, 'Laura Méndez');
});
