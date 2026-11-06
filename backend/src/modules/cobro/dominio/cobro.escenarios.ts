import { BillingOrderNotFoundError, PaymentNotFoundError } from './cobro.errors';
import type { CobroRepository } from './cobro.repository';
import type {
  BillingItem,
  BillingOrder,
  BillingPayment,
  CancellableOrder,
  CancellablePayment,
  CancellationPlan,
  PayableOrder,
  PaymentsPlan,
} from './cobro.types';

export interface OrderOptions {
  prices?: number[];
  discountPercent?: number;
  resultsDeliveredAt?: Date | null;
  payments?: { method: string; amount: number; reference?: string }[];
  birthDate?: Date;
}

export function order(id: number, options: OrderOptions = {}): BillingOrder {
  const prices = options.prices ?? [150, 100];
  const items: BillingItem[] = [];
  for (let i = 0; i < prices.length; i++) {
    items.push({ code: `EST-${i + 1}`, name: `Estudio ${i + 1}`, price: prices[i] });
  }
  const payments: BillingPayment[] = [];
  const given = options.payments ?? [];
  for (let i = 0; i < given.length; i++) {
    payments.push({
      id: id * 100 + i + 1,
      method: given[i].method,
      amount: given[i].amount,
      reference: given[i].reference ?? null,
      createdBy: 'Cajero QA',
      createdAt: new Date(2026, 10, 3, 9, 0),
      cancelled: false,
      cancelReason: null,
    });
  }
  return {
    id,
    status: 'pending',
    patient: {
      id: id * 10,
      firstName: 'Paciente',
      lastName: `Orden ${id}`,
      birthDate: options.birthDate ?? new Date(1990, 0, 1),
      gender: 'F',
    },
    doctorName: null,
    branch: { id: 1, name: 'Sucursal QA' },
    items,
    discountPercent: options.discountPercent ?? 0,
    discountReason: null,
    discountAuthorizedBy: null,
    invoiceRfc: null,
    invoiceName: null,
    invoiceZip: null,
    invoiceUse: null,
    resultsDeliveredAt: options.resultsDeliveredAt ?? null,
    payments,
    logs: [],
  };
}

export class FakeRepository implements CobroRepository {
  private readonly byTenant = new Map<number, BillingOrder[]>();
  private nextPaymentId = 9000;
  private nextLogTime = 0;

  add(tenantId: number, record: BillingOrder) {
    const list = this.byTenant.get(tenantId) ?? [];
    list.push(record);
    this.byTenant.set(tenantId, list);
  }

  find(tenantId: number, orderId: number): BillingOrder | undefined {
    const list = this.byTenant.get(tenantId) ?? [];
    for (const record of list) {
      if (record.id === orderId) return record;
    }
    return undefined;
  }

  async findBillingOrder(tenantId: number, orderId: number): Promise<BillingOrder | null> {
    return this.find(tenantId, orderId) ?? null;
  }

  async registerPayments(
    tenantId: number,
    orderId: number,
    decide: (order: PayableOrder) => PaymentsPlan,
  ): Promise<void> {
    const record = this.find(tenantId, orderId);
    if (!record) throw new BillingOrderNotFoundError();

    const itemPrices: number[] = [];
    for (const item of record.items) itemPrices.push(item.price);
    const payments: { amount: number; cancelled: boolean }[] = [];
    for (const payment of record.payments) payments.push({ amount: payment.amount, cancelled: payment.cancelled });

    const plan = decide({
      id: record.id,
      branchId: record.branch.id,
      discountPercent: record.discountPercent,
      discountReason: record.discountReason,
      discountAuthorizedBy: record.discountAuthorizedBy,
      resultsDeliveredAt: record.resultsDeliveredAt,
      itemPrices,
      payments,
    });

    record.discountPercent = plan.order.discountPercent;
    record.discountReason = plan.order.discountReason;
    record.discountAuthorizedBy = plan.order.discountAuthorizedBy;
    if (plan.order.invoice) {
      record.invoiceRfc = plan.order.invoice.rfc;
      record.invoiceName = plan.order.invoice.name;
      record.invoiceZip = plan.order.invoice.zip;
      record.invoiceUse = plan.order.invoice.use;
    }
    for (const payment of plan.payments) {
      this.nextPaymentId += 1;
      record.payments.push({
        id: this.nextPaymentId,
        method: payment.method,
        amount: Number(payment.amount),
        reference: payment.reference,
        createdBy: payment.createdBy,
        createdAt: new Date(2026, 10, 3, 10, 0),
        cancelled: false,
        cancelReason: null,
      });
    }
    for (const log of plan.logs) {
      this.nextLogTime += 1;
      record.logs.unshift({
        userName: plan.userName,
        action: log.action,
        detail: log.detail,
        createdAt: new Date(2026, 10, 3, 10, 0, this.nextLogTime),
      });
    }
  }

  async cancelPayment(
    tenantId: number,
    paymentId: number,
    decide: (payment: CancellablePayment, order: CancellableOrder) => CancellationPlan,
  ): Promise<number> {
    const list = this.byTenant.get(tenantId) ?? [];
    for (const record of list) {
      for (const payment of record.payments) {
        if (payment.id !== paymentId) continue;
        let paid = 0;
        for (const other of record.payments) {
          if (!other.cancelled) paid += other.amount;
        }
        const plan = decide(
          { id: payment.id, orderId: record.id, method: payment.method, amount: payment.amount, cancelled: payment.cancelled },
          { id: record.id, paidAmount: paid, resultsDeliveredAt: record.resultsDeliveredAt },
        );
        payment.cancelled = true;
        payment.cancelReason = plan.reason;
        this.nextLogTime += 1;
        record.logs.unshift({
          userName: plan.log.userName,
          action: plan.log.action,
          detail: plan.log.detail,
          createdAt: new Date(2026, 10, 3, 10, 0, this.nextLogTime),
        });
        return record.id;
      }
    }
    throw new PaymentNotFoundError();
  }
}
