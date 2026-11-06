export type PaymentMethod = 'cash' | 'card' | 'transfer';

export interface BillingItem {
  code: string;
  name: string;
  price: number;
}

export interface BillingPayment {
  id: number;
  method: string;
  amount: number;
  reference: string | null;
  createdBy: string | null;
  createdAt: Date;
  cancelled: boolean;
  cancelReason: string | null;
}

export interface BillingLog {
  userName: string;
  action: string;
  detail: string;
  createdAt: Date;
}

export interface BillingOrder {
  id: number;
  status: string;
  patient: { id: number; firstName: string; lastName: string; birthDate: Date; gender: string };
  doctorName: string | null;
  branch: { id: number; name: string };
  items: BillingItem[];
  discountPercent: number;
  discountReason: string | null;
  discountAuthorizedBy: string | null;
  invoiceRfc: string | null;
  invoiceName: string | null;
  invoiceZip: string | null;
  invoiceUse: string | null;
  resultsDeliveredAt: Date | null;
  payments: BillingPayment[];
  logs: BillingLog[];
}

export interface PayableOrder {
  id: number;
  branchId: number;
  discountPercent: number;
  discountReason: string | null;
  discountAuthorizedBy: string | null;
  resultsDeliveredAt: Date | null;
  itemPrices: number[];
  payments: { amount: number; cancelled: boolean }[];
}

export interface InvoiceData {
  rfc: string;
  name: string;
  zip: string;
  use: string;
}

export interface PaymentsPlan {
  userName: string;
  order: {
    discountPercent: number;
    discountReason: string | null;
    discountAuthorizedBy: string | null;
    totalAmount: string;
    paidAmount: string;
    invoice: InvoiceData | null;
  };
  payments: { method: PaymentMethod; amount: string; reference: string | null; createdBy: string }[];
  logs: { action: string; detail: string }[];
}

export interface CancellablePayment {
  id: number;
  orderId: number;
  method: string;
  amount: number;
  cancelled: boolean;
}

export interface CancellableOrder {
  id: number;
  paidAmount: number;
  resultsDeliveredAt: Date | null;
}

export interface CancellationPlan {
  paymentId: number;
  orderId: number;
  reason: string;
  cancelledBy: string;
  cancelledAt: Date;
  newPaidAmount: string;
  log: { userName: string; action: string; detail: string };
}

export interface Actor {
  tenantId: number;
  name: string;
  isAdmin: boolean;
}

export interface RegisterPaymentsInput {
  payments?: unknown;
  cashReceived?: unknown;
  discount?: unknown;
  invoice?: unknown;
  leavePending?: unknown;
}

export interface Billing {
  id: number;
  folio: string;
  status: string;
  patient: { name: string; record: string; age: number; gender: string };
  doctorName: string | null;
  branch: { id: number; name: string };
  items: { code: string; name: string; price: string }[];
  discount: { percent: number; reason: string | null; authorizedBy: string | null };
  invoice: { rfc: string; name: string | null; zip: string | null; use: string | null } | null;
  subtotal: string;
  discountAmount: string;
  taxes: string;
  total: string;
  paid: string;
  balance: string;
  resultsDelivered: boolean;
  payments: {
    id: number;
    method: string;
    amount: string;
    reference: string | null;
    createdBy: string | null;
    createdAt: Date;
    cancelled: boolean;
    cancelReason: string | null;
  }[];
  logs: { userName: string; action: string; detail: string; createdAt: Date }[];
}
