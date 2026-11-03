import { Prisma } from '@prisma/client';
import { prisma } from '../config/db';

export async function createOrder(testIds: number[], physicianId?: number | null) {
  const tenant = await prisma.tenant.findFirstOrThrow({ where: { name: 'Laboratorio Santa Lucía' } });
  const branch = await prisma.branch.findFirstOrThrow({ where: { tenantId: tenant.id, name: 'Clínica Central' } });
  const patient = await prisma.patient.findFirstOrThrow({
    where: { tenantId: tenant.id, firstName: 'María', lastName: 'López García' },
  });
  const tests = await prisma.testCatalog.findMany({ where: { tenantId: tenant.id, id: { in: testIds } } });

  if (!tests.length) {
    const error = new Error('Agrega al menos un estudio para crear la orden.');
    Object.assign(error, { statusCode: 422 });
    throw error;
  }

  const total = tests.reduce((sum, test) => sum.add(test.price), new Prisma.Decimal(0));
  return prisma.order.create({
    data: {
      tenantId: tenant.id,
      branchId: branch.id,
      patientId: patient.id,
      physicianId: physicianId ?? null,
      totalAmount: total,
      items: { create: tests.map((test) => ({ testId: test.id, price: test.price })) },
    },
  });
}

export async function confirmOrderInstructions(orderId: number, observation?: string | null) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  const user = await prisma.user.findFirst({ where: { tenantId: order.tenantId, fullName: 'Laura Méndez' } });

  return prisma.instructionConfirmation.upsert({
    where: { orderId: order.id },
    update: { userId: user?.id, observation: observation ?? null, confirmedAt: new Date() },
    create: {
      tenantId: order.tenantId,
      orderId: order.id,
      branchId: order.branchId,
      userId: user?.id,
      observation: observation ?? null,
    },
  });
}

export async function recordInstructionDelivery(orderId: number, channel: 'email' | 'whatsapp') {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  const user = await prisma.user.findFirst({ where: { tenantId: order.tenantId, fullName: 'Laura Méndez' } });

  return prisma.instructionDelivery.create({
    data: { tenantId: order.tenantId, orderId: order.id, userId: user?.id, channel },
  });
}
