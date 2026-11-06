import type {
  BillingOrder,
  CancellableOrder,
  CancellablePayment,
  CancellationPlan,
  PayableOrder,
  PaymentsPlan,
} from './cobro.types';

export interface CobroRepository {
  findBillingOrder(tenantId: number, orderId: number): Promise<BillingOrder | null>;

  registerPayments(
    tenantId: number,
    orderId: number,
    decide: (order: PayableOrder) => PaymentsPlan,
  ): Promise<void>;

  cancelPayment(
    tenantId: number,
    paymentId: number,
    decide: (payment: CancellablePayment, order: CancellableOrder) => CancellationPlan,
  ): Promise<number>;
}
