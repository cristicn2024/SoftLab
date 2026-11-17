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
  assert.deepEqual(await repository.createOrder(input), { id: 45 });
  assert.deepEqual((orderWrite as { preAnalyticalSnapshot: unknown }).preAnalyticalSnapshot, snapshot);
  assert.deepEqual(exceptionWrite, [{ tenantId: 2, orderId: 45, patientId: 7, testId: 8, reason: 'Motivo registrado', authorizedByName: 'Admin QA', authorizedById: 3 }]);
});
