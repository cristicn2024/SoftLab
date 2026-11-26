import assert from 'node:assert/strict';
import test from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { BranchAccessService } from './branch-access.service';

function setup(overrides: Record<string, unknown> = {}) {
  const prisma = {
    user: { findFirst: async () => ({ id: 7, role: 'receptionist', branchId: 2 }) },
    userBranchAccess: { findMany: async () => [{ branchId: 2 }, { branchId: 4 }] },
    order: { findFirst: async () => ({ branchId: 4 }) },
    payment: { findFirst: async () => ({ branchId: 5 }) },
    ...overrides,
  };
  return new BranchAccessService(prisma as never);
}

const session = { tenantId: 1, nombre: 'Empleado', email: 'empleado@demo.test', rol: 'receptionist' as const };

test('devuelve únicamente las sucursales asignadas a la cuenta del laboratorio', async () => {
  const access = await setup().allowedBranchIds(session);
  assert.deepEqual(access, [2, 4]);
});

test('deniega sesiones sin identidad verificable', async () => {
  await assert.rejects(setup().allowedBranchIds({ ...session, email: undefined }), ForbiddenException);
});

test('permite todas las sucursales a administradores identificados en la base', async () => {
  const prisma = { user: { findFirst: async () => ({ id: 1, role: 'admin', branchId: 2 }) } };
  assert.equal(await setup(prisma).allowedBranchIds(session), null);
});

test('deniega una orden y un pago que pertenecen a sucursales no asignadas', async () => {
  const service = setup({
    userBranchAccess: { findMany: async () => [{ branchId: 2 }, { branchId: 4 }] },
  });
  await service.exigirAccesoOrden(session, 55);
  await assert.rejects(service.exigirAccesoPago(session, 90), ForbiddenException);
});
