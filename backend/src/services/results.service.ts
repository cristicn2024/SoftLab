import { prisma } from '../config/db';

type CriticalNotificationInput = {
  recipient: 'doctor' | 'patient';
  recipientName: string;
  contactMethod: 'phone' | 'email' | 'whatsapp' | 'in_person';
  notifiedAt: string;
};

export async function recordCriticalNotification(resultId: number, branchId: number, input: CriticalNotificationInput) {
  const result = await prisma.testResult.findUniqueOrThrow({ where: { id: resultId } });
  const user = await prisma.user.findFirst({
    where: { tenantId: result.tenantId, fullName: 'Q.F.B. Andrea Ruiz' },
  });

  return prisma.criticalNotification.create({
    data: {
      tenantId: result.tenantId,
      resultId: result.id,
      branchId,
      userId: user?.id,
      ...input,
      notifiedAt: new Date(input.notifiedAt),
    },
  });
}

export async function saveResult(
  orderItemId: number,
  parameterId: number,
  value: string,
  flag: string,
  notification?: CriticalNotificationInput,
) {
  const critical = flag === 'HH' || flag === 'LL';
  if (critical && !notification) {
    const error = new Error('Registra la notificación del resultado crítico antes de guardar.');
    Object.assign(error, { statusCode: 422 });
    throw error;
  }

  const orderItem = await prisma.orderItem.findUniqueOrThrow({
    where: { id: orderItemId },
    include: { order: true },
  });
  const parameter = await prisma.testParameter.findUniqueOrThrow({ where: { id: parameterId } });
  const result = await prisma.testResult.upsert({
    where: { orderItemId_parameterId: { orderItemId: orderItem.id, parameterId: parameter.id } },
    update: { resultValue: value, flag, isAlert: !['Normal', '—'].includes(flag) },
    create: {
      tenantId: orderItem.order.tenantId,
      orderItemId: orderItem.id,
      parameterId: parameter.id,
      resultValue: value,
      flag,
      isAlert: !['Normal', '—'].includes(flag),
    },
  });

  if (critical && notification) {
    const existingNotification = await prisma.criticalNotification.findFirst({ where: { resultId: result.id } });
    if (!existingNotification) {
      const user = await prisma.user.findFirst({
        where: { tenantId: result.tenantId, fullName: 'Q.F.B. Andrea Ruiz' },
      });
      await prisma.criticalNotification.create({
        data: {
          tenantId: result.tenantId,
          resultId: result.id,
          branchId: orderItem.order.branchId,
          userId: user?.id,
          ...notification,
          notifiedAt: new Date(notification.notifiedAt),
        },
      });
    }
  }

  return result;
}
