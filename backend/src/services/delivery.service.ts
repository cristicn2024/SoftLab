import { Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/db';

const cents = (value: unknown) => Math.round(Number(value) * 100);
function header(req: Request, key: string) {
  try { return decodeURIComponent(String(req.headers[key] || '')); }
  catch { return ''; }
}

// El bloqueo de fila también se usa al cobrar/cancelar para serializar las operaciones.
export async function releaseReport(
  req: Request, tenantId: number, orderId: number, channel: string,
  render: (tx: Prisma.TransactionClient) => Promise<Buffer>,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} AND tenant_id = ${tenantId} FOR UPDATE`;
    const order = await tx.order.findFirst({
      where: { id: orderId, tenantId }, include: { items: true, payments: true },
    });
    if (!order) return { status: 404, error: 'La orden no existe' };
    if (order.status === 'cancelled') return { status: 409, error: 'La orden está cancelada' };
    const subtotal = order.items.reduce((sum, item) => sum + cents(item.price), 0);
    const total = subtotal - Math.round(subtotal * order.discountPercent / 100);
    const paid = order.payments.filter(p => !p.cancelled).reduce((sum, p) => sum + cents(p.amount), 0);
    const balance = Math.max(total - paid, 0);
    const userName = header(req, 'x-user-name') || 'Usuario sin nombre';
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    const special = ['Administradora', 'Administrador', 'admin'].includes(header(req, 'x-user-role'));
    const log = (action: string, detail: string) => tx.paymentLog.create({
      data: { tenantId, orderId, userName, action, detail },
    });
    if (balance > 0 && (!special || !reason || reason.length > 1000)) {
      await log('Entrega bloqueada', `Canal: ${channel} · Saldo: $${(balance / 100).toFixed(2)}`);
      return {
        status: 409, code: 'PAYMENT_REQUIRED',
        error: `Entrega bloqueada. Saldo pendiente: $${(balance / 100).toFixed(2)}.`,
        balance: (balance / 100).toFixed(2), paymentUrl: `/ordenes/cobro?orden=${orderId}`,
      };
    }
    const buffer = await render(tx);
    if (balance > 0) await log('Excepción de entrega autorizada', `Canal: ${channel} · Saldo: $${(balance / 100).toFixed(2)} · Motivo: ${reason}`);
    await tx.order.update({ where: { id: orderId }, data: { resultsDeliveredAt: order.resultsDeliveredAt ?? new Date() } });
    await log('Resultados entregados', `Canal: ${channel}`);
    return { buffer };
  }, { timeout: 60000 });
}
