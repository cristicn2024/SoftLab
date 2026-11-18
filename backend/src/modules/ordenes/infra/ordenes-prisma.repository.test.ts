import test from 'node:test';
import assert from 'node:assert/strict';
import { OrdenesPrismaRepository } from './ordenes-prisma.repository';
import type { NewOrderData } from '../dominio/ordenes.types';
import type { PrismaService } from '../../../prisma/prisma.service';

test('guarda snapshot de indicaciones y bitácora de excepciones en la transacción de la orden', async () => {
  let orderWrite: unknown;
  let exceptionWrite: unknown;
  const tx = {
    order: { create: async ({ data }: { data: unknown }) => { orderWrite = data; return { id: 45 }; } },
    studyAdmissionException: { createMany: async ({ data }: { data: unknown }) => { exceptionWrite = data; return { count: 1 }; } },
  };
  const prisma = { $transaction: async <T>(work: (transaction: typeof tx) => Promise<T>) => work(tx) };
  const repository = new OrdenesPrismaRepository(prisma as unknown as PrismaService);
  const snapshot = { estudios: [{ id: 8, name: 'Glucosa', sampleType: 'Sangre' }], conflictos: [] };
  const input: NewOrderData = {
    tenantId: 2, branchId: 4, patientId: 7, doctorId: null, totalAmount: 100, folio: 'ORD-QA', items: [{ price: 100, testId: 8 }],
    preAnalyticalSnapshot: snapshot,
    exceptionApprovals: [{ testId: 8, reason: 'Motivo registrado', authorizedByName: 'Admin QA', authorizedById: 3 }],
  };
  assert.deepEqual(await repository.createOrder(input), { id: 45, shipmentFolios: [] });
  assert.deepEqual((orderWrite as { preAnalyticalSnapshot: unknown }).preAnalyticalSnapshot, snapshot);
  assert.deepEqual(exceptionWrite, [{ tenantId: 2, orderId: 45, patientId: 7, testId: 8, reason: 'Motivo registrado', authorizedByName: 'Admin QA', authorizedById: 3 }]);
});

test('un estudio externo genera su orden de envío dentro de la misma transacción', async () => {
  const envios: Record<string, unknown>[] = [];
  const tx = {
    order: { create: async () => ({ id: 50 }) },
    shipmentOrder: {
      count: async () => 2,
      create: async ({ data }: { data: Record<string, unknown> }) => { envios.push(data); return { id: envios.length }; },
    },
  };
  const prisma = { $transaction: async <T>(work: (transaction: typeof tx) => Promise<T>) => work(tx) };
  const repository = new OrdenesPrismaRepository(prisma as unknown as PrismaService);
  const input: NewOrderData = {
    tenantId: 1, branchId: 1, patientId: 3, doctorId: null, totalAmount: 320, folio: 'ORD-QA-2', items: [{ price: 320, testId: 9 }, { price: 80, testId: 4 }],
    externalStudies: [{ testId: 9, externalLabId: 2, turnaroundDays: 3, outsourcingCost: 90 }],
  };
  const creada = await repository.createOrder(input);
  assert.equal(creada.shipmentFolios.length, 1);
  assert.match(creada.shipmentFolios[0], /^ENV-\d{6}-0003$/);
  assert.equal(envios.length, 1);
  assert.equal(envios[0].orderId, 50);
  assert.equal(envios[0].testId, 9);
  assert.equal(envios[0].externalLabId, 2);
  assert.equal(envios[0].estimatedDays, 3);
  assert.equal(envios[0].outsourcingCost, 90);
});