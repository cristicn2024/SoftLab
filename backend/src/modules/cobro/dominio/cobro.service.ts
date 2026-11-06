import {
  BillingOrderNotFoundError,
  CancelNotAllowedError,
  CancelReasonRequiredError,
  DiscountNotAllowedError,
  InvalidDiscountError,
  InvalidInvoiceError,
  InvalidPaymentError,
  PaymentAlreadyCancelledError,
  ResultsAlreadyDeliveredError,
} from './cobro.errors';
import type { CobroRepository } from './cobro.repository';
import {
  ageFrom,
  calculateTotal,
  DISCOUNT_OPTIONS,
  METHOD_LABEL,
  money,
  RFC_PATTERN,
  toCents,
  toPesos,
} from './cobro.rules';
import type {
  Actor,
  Billing,
  BillingOrder,
  CancellableOrder,
  CancellablePayment,
  CancellationPlan,
  InvoiceData,
  PayableOrder,
  PaymentMethod,
  PaymentsPlan,
  RegisterPaymentsInput,
} from './cobro.types';

const GENDERS: Record<string, string> = { F: 'Mujer', M: 'Hombre', Other: 'Otro' };

function read(value: unknown, key: string): unknown {
  if (value === null || value === undefined) return undefined;
  return (value as Record<string, unknown>)[key];
}

function isMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(METHOD_LABEL, value);
}

export function buildBilling(order: BillingOrder, today: Date): Billing {
  let subtotal = 0;
  for (const item of order.items) subtotal += toCents(item.price);
  const { discount, taxes, total } = calculateTotal(subtotal, order.discountPercent);

  let paid = 0;
  for (const payment of order.payments) {
    if (!payment.cancelled) paid += toCents(payment.amount);
  }

  let invoice: Billing['invoice'] = null;
  if (order.invoiceRfc) {
    invoice = { rfc: order.invoiceRfc, name: order.invoiceName, zip: order.invoiceZip, use: order.invoiceUse };
  }

  const payments: Billing['payments'] = [];
  for (const payment of order.payments) {
    payments.push({
      id: payment.id,
      method: payment.method,
      amount: toPesos(toCents(payment.amount)),
      reference: payment.reference,
      createdBy: payment.createdBy,
      createdAt: payment.createdAt,
      cancelled: payment.cancelled,
      cancelReason: payment.cancelReason,
    });
  }

  const logs: Billing['logs'] = [];
  for (const log of order.logs) {
    logs.push({ userName: log.userName, action: log.action, detail: log.detail, createdAt: log.createdAt });
  }

  const lines: Billing['items'] = [];
  for (const item of order.items) {
    lines.push({ code: item.code, name: item.name, price: toPesos(toCents(item.price)) });
  }

  return {
    id: order.id,
    folio: 'SL-' + String(order.id).padStart(6, '0'),
    status: order.status,
    patient: {
      name: `${order.patient.firstName} ${order.patient.lastName}`,
      record: 'P-' + String(order.patient.id).padStart(6, '0'),
      age: ageFrom(order.patient.birthDate, today),
      gender: GENDERS[order.patient.gender] || order.patient.gender,
    },
    doctorName: order.doctorName,
    branch: { id: order.branch.id, name: order.branch.name },
    items: lines,
    discount: {
      percent: order.discountPercent,
      reason: order.discountReason,
      authorizedBy: order.discountAuthorizedBy,
    },
    invoice,
    subtotal: toPesos(subtotal),
    discountAmount: toPesos(discount),
    taxes: toPesos(taxes),
    total: toPesos(total),
    paid: toPesos(paid),
    balance: toPesos(Math.max(total - paid, 0)),
    resultsDelivered: order.resultsDeliveredAt !== null,
    payments,
    logs,
  };
}

export function decidePayments(order: PayableOrder, body: RegisterPaymentsInput, actor: Actor): PaymentsPlan {
  if (order.resultsDeliveredAt) {
    throw new ResultsAlreadyDeliveredError(
      'Los resultados de esta orden ya se entregaron: no se pueden registrar más pagos.',
    );
  }

  const discountBody = read(body.discount, 'percent');
  const discountPercent = Number(discountBody ?? order.discountPercent);
  const discountReason = String(read(body.discount, 'reason') ?? '').trim();
  if (!DISCOUNT_OPTIONS.includes(discountPercent)) throw new InvalidDiscountError('Porcentaje de descuento no válido.');
  const discountChanged = discountPercent !== order.discountPercent;
  if (discountChanged && !actor.isAdmin) throw new DiscountNotAllowedError();
  if (discountPercent > 0 && discountChanged && discountReason === '') {
    throw new InvalidDiscountError('El descuento requiere un motivo.');
  }

  let invoice: InvoiceData | null = null;
  if (body.invoice) {
    invoice = {
      rfc: String(read(body.invoice, 'rfc') || '').trim().toUpperCase(),
      name: String(read(body.invoice, 'name') || '').trim(),
      zip: String(read(body.invoice, 'zip') || '').trim(),
      use: String(read(body.invoice, 'use') || '').trim(),
    };
    if (!RFC_PATTERN.test(invoice.rfc)) throw new InvalidInvoiceError('El RFC no tiene un formato válido.');
    if (invoice.name === '') throw new InvalidInvoiceError('Falta el nombre o razón social para la factura.');
    if (!/^\d{5}$/.test(invoice.zip)) throw new InvalidInvoiceError('El código postal fiscal debe tener 5 dígitos.');
  }

  let subtotal = 0;
  for (const price of order.itemPrices) subtotal += toCents(price);
  const { total } = calculateTotal(subtotal, discountPercent);

  let alreadyPaid = 0;
  for (const payment of order.payments) {
    if (!payment.cancelled) alreadyPaid += toCents(payment.amount);
  }
  if (alreadyPaid > total) {
    throw new InvalidPaymentError('Con ese descuento lo ya pagado supera el total de la orden.');
  }
  const balance = total - alreadyPaid;

  const incoming: { method: PaymentMethod; amount: number; reference: string }[] = [];
  const rawPayments = Array.isArray(body.payments) ? body.payments : [];
  for (const raw of rawPayments) {
    const method = read(raw, 'method');
    if (!isMethod(method)) throw new InvalidPaymentError('Método de pago no válido.');
    const amount = toCents(read(raw, 'amount'));
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const reference = String(read(raw, 'reference') || '').trim();
    if (method !== 'cash' && reference === '') {
      throw new InvalidPaymentError(`Falta la referencia del pago con ${METHOD_LABEL[method].toLowerCase()}.`);
    }
    incoming.push({ method, amount, reference });
  }
  let incomingTotal = 0;
  for (const payment of incoming) incomingTotal += payment.amount;
  if (incomingTotal > balance) throw new InvalidPaymentError('Los pagos superan el saldo por cobrar.');
  if (!body.leavePending && incomingTotal === 0) {
    throw new InvalidPaymentError('Captura al menos un monto para registrar el pago.');
  }

  const logs: { action: string; detail: string }[] = [];
  if (discountChanged) {
    let detail = 'Sin descuento';
    if (discountPercent > 0) detail = `${discountPercent}% · ${discountReason} · autorizó ${actor.name}`;
    logs.push({ action: 'Aplicó descuento', detail });
  }

  const cashReceived = toCents(body.cashReceived || 0);
  const payments: PaymentsPlan['payments'] = [];
  for (const payment of incoming) {
    payments.push({
      method: payment.method,
      amount: toPesos(payment.amount),
      reference: payment.reference || null,
      createdBy: actor.name,
    });
    let detail = `${METHOD_LABEL[payment.method]} · ${money(payment.amount)}`;
    if (payment.method === 'cash' && cashReceived > payment.amount) {
      detail += ` · cambio ${money(cashReceived - payment.amount)}`;
    }
    logs.push({ action: 'Registró pago', detail });
  }

  const newBalance = balance - incomingTotal;
  if (newBalance > 0) logs.push({ action: 'Orden pendiente de pago', detail: `Saldo por cobrar ${money(newBalance)}` });
  if (invoice) logs.push({ action: 'Capturó datos de facturación', detail: invoice.rfc });

  let authorizedBy = order.discountAuthorizedBy;
  if (discountChanged) authorizedBy = discountPercent > 0 ? actor.name : null;

  return {
    userName: actor.name,
    order: {
      discountPercent,
      discountReason: discountChanged ? discountReason || null : order.discountReason,
      discountAuthorizedBy: authorizedBy,
      totalAmount: toPesos(total),
      paidAmount: toPesos(alreadyPaid + incomingTotal),
      invoice,
    },
    payments,
    logs,
  };
}

export function decideCancellation(
  payment: CancellablePayment,
  order: CancellableOrder,
  reason: string,
  actor: Actor,
  now: Date,
): CancellationPlan {
  if (payment.cancelled) throw new PaymentAlreadyCancelledError();
  if (order.resultsDeliveredAt) {
    throw new ResultsAlreadyDeliveredError('No se puede cancelar un pago después de entregar resultados.');
  }
  const paid = Math.max(toCents(order.paidAmount) - toCents(payment.amount), 0);
  return {
    paymentId: payment.id,
    orderId: order.id,
    reason,
    cancelledBy: actor.name,
    cancelledAt: now,
    newPaidAmount: toPesos(paid),
    log: {
      userName: actor.name,
      action: 'Canceló pago',
      detail: `${METHOD_LABEL[payment.method as PaymentMethod]} · ${money(toCents(payment.amount))} · ${reason}`,
    },
  };
}

export class CobroService {
  constructor(private readonly repository: CobroRepository) {}

  async getBilling(tenantId: number, orderId: number, today: Date = new Date()): Promise<Billing> {
    const order = await this.repository.findBillingOrder(tenantId, orderId);
    if (!order) throw new BillingOrderNotFoundError();
    return buildBilling(order, today);
  }

  async registerPayments(
    actor: Actor,
    orderId: number,
    body: RegisterPaymentsInput,
    today: Date = new Date(),
  ): Promise<Billing> {
    function decide(order: PayableOrder): PaymentsPlan {
      return decidePayments(order, body, actor);
    }

    await this.repository.registerPayments(actor.tenantId, orderId, decide);
    return this.getBilling(actor.tenantId, orderId, today);
  }

  async cancelPayment(actor: Actor, paymentId: number, reason: unknown, today: Date = new Date()): Promise<Billing> {
    if (!actor.isAdmin) throw new CancelNotAllowedError();
    const cleanReason = String(reason || '').trim();
    if (cleanReason === '') throw new CancelReasonRequiredError();

    function decide(payment: CancellablePayment, order: CancellableOrder): CancellationPlan {
      return decideCancellation(payment, order, cleanReason, actor, today);
    }

    const orderId = await this.repository.cancelPayment(actor.tenantId, paymentId, decide);
    return this.getBilling(actor.tenantId, orderId, today);
  }
}
