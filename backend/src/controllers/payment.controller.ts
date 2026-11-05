import { Request, Response } from 'express';
import { prisma } from '../config/db';

// HU 5.3 · Total y estado de pago
// Los importes se calculan en centavos (enteros) y se guardan en pesos (DECIMAL 10,2).

const DISCOUNT_OPTIONS = [0, 5, 10, 15, 20];
const TAX_RATE = 0; // Los análisis clínicos están exentos de IVA.
const ROLES_WITH_SPECIAL_PERMISSION = ['Administradora', 'Administrador', 'admin'];
const RFC_PATTERN = /^([A-ZÑ&]{3,4})(\d{6})([A-Z\d]{3})$/;

type PaymentMethod = 'cash' | 'card' | 'transfer';
const METHOD_LABEL: Record<PaymentMethod, string> = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia' };

class ValidationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function toCents(value: unknown): number {
  return Math.round(Number(value) * 100);
}

function toPesos(cents: number): string {
  return (cents / 100).toFixed(2);
}

function money(cents: number): string {
  return '$' + (cents / 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Mientras no haya inicio de sesión, el frontend manda el usuario en encabezados
// (codificados con encodeURIComponent por los acentos).
function readHeader(req: Request, name: string): string {
  const value = String(req.headers[name] || '');
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function currentUser(req: Request) {
  return {
    name: readHeader(req, 'x-user-name') || 'Usuario sin nombre',
    role: readHeader(req, 'x-user-role'),
  };
}

function calculateTotal(subtotal: number, discountPercent: number) {
  const discount = Math.round((subtotal * discountPercent) / 100);
  const taxes = Math.round(((subtotal - discount) * TAX_RATE) / 100);
  return { discount, taxes, total: subtotal - discount + taxes };
}

function ageFrom(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const beforeBirthday =
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

// Arma todo lo que necesita la pantalla de cobro para una orden.
async function buildBilling(tenantId: number, orderId: number) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId },
    include: {
      patient: true,
      branch: true,
      items: { include: { test: true }, orderBy: { id: 'asc' } },
      payments: { orderBy: { id: 'asc' } },
      paymentLogs: { orderBy: { id: 'desc' } },
    },
  });
  if (!order) return null;

  let subtotal = 0;
  for (const item of order.items) subtotal += toCents(item.price);
  const { discount, taxes, total } = calculateTotal(subtotal, order.discountPercent);

  let paid = 0;
  for (const payment of order.payments) {
    if (!payment.cancelled) paid += toCents(payment.amount);
  }

  let invoice: { rfc: string; name: string | null; zip: string | null; use: string | null } | null = null;
  if (order.invoiceRfc) {
    invoice = { rfc: order.invoiceRfc, name: order.invoiceName, zip: order.invoiceZip, use: order.invoiceUse };
  }

  const genders: Record<string, string> = { F: 'Mujer', M: 'Hombre', Other: 'Otro' };

  return {
    id: order.id,
    folio: 'SL-' + String(order.id).padStart(6, '0'),
    status: order.status,
    patient: {
      name: `${order.patient.firstName} ${order.patient.lastName}`,
      record: 'P-' + String(order.patient.id).padStart(6, '0'),
      age: ageFrom(order.patient.birthDate),
      gender: genders[order.patient.gender] || order.patient.gender,
    },
    doctorName: order.doctorName,
    branch: { id: order.branch.id, name: order.branch.name },
    items: order.items.map((item) => ({ code: item.test?.code ?? 'PERFIL', name: item.test?.name ?? 'Perfil', price: toPesos(toCents(item.price)) })),
    discount: { percent: order.discountPercent, reason: order.discountReason, authorizedBy: order.discountAuthorizedBy },
    invoice,
    subtotal: toPesos(subtotal),
    discountAmount: toPesos(discount),
    taxes: toPesos(taxes),
    total: toPesos(total),
    paid: toPesos(paid),
    balance: toPesos(Math.max(total - paid, 0)),
    resultsDelivered: order.resultsDeliveredAt !== null,
    payments: order.payments.map((payment) => ({
      id: payment.id,
      method: payment.method,
      amount: toPesos(toCents(payment.amount)),
      reference: payment.reference,
      createdBy: payment.createdBy,
      createdAt: payment.createdAt,
      cancelled: payment.cancelled,
      cancelReason: payment.cancelReason,
    })),
    logs: order.paymentLogs.map((log) => ({
      userName: log.userName,
      action: log.action,
      detail: log.detail,
      createdAt: log.createdAt,
    })),
  };
}

// GET /api/orders/:id/billing
export async function getBilling(req: Request, res: Response) {
  try {
    const tenantId = Number(req.headers['x-tenant-id'] || 1);
    const billing = await buildBilling(tenantId, Number(req.params.id));
    if (!billing) return res.status(404).json({ error: 'La orden no existe' });
    return res.json(billing);
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener la orden' });
  }
}

// POST /api/orders/:id/payments
// Body: { payments: [{ method, amount, reference }], cashReceived, discount: { percent, reason }, invoice, leavePending }
export async function registerPayments(req: Request, res: Response) {
  try {
    const tenantId = Number(req.headers['x-tenant-id'] || 1);
    const orderId = Number(req.params.id);
    const user = currentUser(req);
    const body = req.body || {};
    const canAuthorize = ROLES_WITH_SPECIAL_PERMISSION.includes(user.role);

    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} AND tenant_id = ${tenantId} FOR UPDATE`;
      const order = await tx.order.findFirst({
        where: { id: orderId, tenantId },
        include: { items: true, payments: true },
      });
      if (!order) throw new ValidationError('La orden no existe', 404);
      if (order.resultsDeliveredAt) {
        throw new ValidationError('Los resultados de esta orden ya se entregaron: no se pueden registrar más pagos.', 409);
      }

      // Descuento: solo con permiso y motivo.
      const discountPercent = Number(body.discount?.percent ?? order.discountPercent);
      const discountReason = String(body.discount?.reason ?? '').trim();
      if (!DISCOUNT_OPTIONS.includes(discountPercent)) throw new ValidationError('Porcentaje de descuento no válido.');
      const discountChanged = discountPercent !== order.discountPercent;
      if (discountChanged && !canAuthorize) throw new ValidationError('Tu rol no tiene permiso para aplicar descuentos.', 403);
      if (discountPercent > 0 && discountChanged && discountReason === '') throw new ValidationError('El descuento requiere un motivo.');

      // Datos de facturación (opcionales).
      let invoice: { rfc: string; name: string; zip: string; use: string } | null = null;
      if (body.invoice) {
        invoice = {
          rfc: String(body.invoice.rfc || '').trim().toUpperCase(),
          name: String(body.invoice.name || '').trim(),
          zip: String(body.invoice.zip || '').trim(),
          use: String(body.invoice.use || '').trim(),
        };
        if (!RFC_PATTERN.test(invoice.rfc)) throw new ValidationError('El RFC no tiene un formato válido.');
        if (invoice.name === '') throw new ValidationError('Falta el nombre o razón social para la factura.');
        if (!/^\d{5}$/.test(invoice.zip)) throw new ValidationError('El código postal fiscal debe tener 5 dígitos.');
      }

      let subtotal = 0;
      for (const item of order.items) subtotal += toCents(item.price);
      const { total } = calculateTotal(subtotal, discountPercent);

      let alreadyPaid = 0;
      for (const payment of order.payments) {
        if (!payment.cancelled) alreadyPaid += toCents(payment.amount);
      }
      if (alreadyPaid > total) throw new ValidationError('Con ese descuento lo ya pagado supera el total de la orden.');
      const balance = total - alreadyPaid;

      // Pagos nuevos: el monto de efectivo es lo aplicado a la orden; cashReceived sirve para el cambio.
      const incoming: { method: PaymentMethod; amount: number; reference: string }[] = [];
      for (const raw of Array.isArray(body.payments) ? body.payments : []) {
        const method = raw.method as PaymentMethod;
        if (!(method in METHOD_LABEL)) throw new ValidationError('Método de pago no válido.');
        const amount = toCents(raw.amount);
        if (!Number.isFinite(amount) || amount <= 0) continue;
        const reference = String(raw.reference || '').trim();
        if (method !== 'cash' && reference === '') {
          throw new ValidationError(`Falta la referencia del pago con ${METHOD_LABEL[method].toLowerCase()}.`);
        }
        incoming.push({ method, amount, reference });
      }
      let incomingTotal = 0;
      for (const payment of incoming) incomingTotal += payment.amount;
      if (incomingTotal > balance) throw new ValidationError('Los pagos superan el saldo por cobrar.');
      if (!body.leavePending && incomingTotal === 0) throw new ValidationError('Captura al menos un monto para registrar el pago.');

      const logs: { action: string; detail: string }[] = [];
      if (discountChanged) {
        let detail = 'Sin descuento';
        if (discountPercent > 0) detail = `${discountPercent}% · ${discountReason} · autorizó ${user.name}`;
        logs.push({ action: 'Aplicó descuento', detail });
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          discountPercent,
          discountReason: discountChanged ? discountReason || null : order.discountReason,
          discountAuthorizedBy: discountChanged ? (discountPercent > 0 ? user.name : null) : order.discountAuthorizedBy,
          totalAmount: toPesos(total),
          paidAmount: toPesos(alreadyPaid + incomingTotal),
          ...(invoice
            ? { invoiceRfc: invoice.rfc, invoiceName: invoice.name, invoiceZip: invoice.zip, invoiceUse: invoice.use }
            : {}),
        },
      });

      const cashReceived = toCents(body.cashReceived || 0);
      for (const payment of incoming) {
        await tx.payment.create({
          data: {
            tenantId,
            orderId: order.id,
            branchId: order.branchId,
            method: payment.method,
            amount: toPesos(payment.amount),
            reference: payment.reference || null,
            createdBy: user.name,
          },
        });
        let detail = `${METHOD_LABEL[payment.method]} · ${money(payment.amount)}`;
        if (payment.method === 'cash' && cashReceived > payment.amount) detail += ` · cambio ${money(cashReceived - payment.amount)}`;
        logs.push({ action: 'Registró pago', detail });
      }

      const newBalance = balance - incomingTotal;
      if (newBalance > 0) logs.push({ action: 'Orden pendiente de pago', detail: `Saldo por cobrar ${money(newBalance)}` });
      if (invoice) logs.push({ action: 'Capturó datos de facturación', detail: invoice.rfc });

      for (const log of logs) {
        await tx.paymentLog.create({ data: { tenantId, orderId: order.id, userName: user.name, ...log } });
      }
    });

    return res.status(201).json(await buildBilling(tenantId, orderId));
  } catch (error) {
    if (error instanceof ValidationError) return res.status(error.status).json({ error: error.message });
    return res.status(500).json({ error: 'Error al registrar el pago' });
  }
}

// POST /api/payments/:id/cancel
// Body: { reason }
export async function cancelPayment(req: Request, res: Response) {
  try {
    const tenantId = Number(req.headers['x-tenant-id'] || 1);
    const user = currentUser(req);
    const reason = String(req.body?.reason || '').trim();

    if (!ROLES_WITH_SPECIAL_PERMISSION.includes(user.role)) {
      return res.status(403).json({ error: 'Tu rol no tiene permiso especial para cancelar pagos.' });
    }
    if (reason === '') return res.status(400).json({ error: 'El motivo de la cancelación es obligatorio.' });

    const orderId = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({ where: { id: Number(req.params.id), tenantId } });
      if (!payment) throw new ValidationError('El pago no existe', 404);
      if (payment.cancelled) throw new ValidationError('El pago ya estaba cancelado.', 409);

      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${payment.orderId} AND tenant_id = ${tenantId} FOR UPDATE`;
      const lockedPayment = await tx.payment.findFirst({ where: { id: payment.id, tenantId } });
      if (!lockedPayment || lockedPayment.cancelled) throw new ValidationError('El pago ya estaba cancelado.', 409);
      const deliveredOrder = await tx.order.findUniqueOrThrow({ where: { id: payment.orderId } });
      if (deliveredOrder.resultsDeliveredAt) throw new ValidationError('No se puede cancelar un pago después de entregar resultados.', 409);
      await tx.payment.update({
        where: { id: payment.id },
        data: { cancelled: true, cancelReason: reason, cancelledBy: user.name, cancelledAt: new Date() },
      });
      const order = await tx.order.findUniqueOrThrow({ where: { id: payment.orderId } });
      const paid = Math.max(toCents(order.paidAmount) - toCents(payment.amount), 0);
      await tx.order.update({ where: { id: order.id }, data: { paidAmount: toPesos(paid) } });
      await tx.paymentLog.create({
        data: {
          tenantId,
          orderId: order.id,
          userName: user.name,
          action: 'Canceló pago',
          detail: `${METHOD_LABEL[payment.method as PaymentMethod]} · ${money(toCents(payment.amount))} · ${reason}`,
        },
      });
      return order.id;
    }, { isolationLevel: 'ReadCommitted' });

    return res.json(await buildBilling(tenantId, orderId));
  } catch (error) {
    if (error instanceof ValidationError) return res.status(error.status).json({ error: error.message });
    return res.status(500).json({ error: 'Error al cancelar el pago' });
  }
}
