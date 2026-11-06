import { prisma } from '../config/db';

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
