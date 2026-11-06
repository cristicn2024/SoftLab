export type ShiftValue = 'matutino' | 'vespertino' | 'nocturno';

export type PaymentMethodValue = 'cash' | 'card' | 'transfer';

export type MovementMethod = PaymentMethodValue | 'mixed' | 'pending' | 'cancelled';

export interface ShiftConfig {
  label: string;
  schedule: string;
  startHour: number;
  endHour: number;
}

export interface Scope {
  tenantId: number;
  branchId: number;
  cashierId: number;
  shift: ShiftValue;
  date: string;
}

export interface BranchRow {
  id: number;
  tenantId: number;
  name: string;
  address: string | null;
  phone: string | null;
  createdAt: Date;
}

export interface TenantRow {
  id: number;
  name: string;
  subdomain: string;
}

export interface CashierRow {
  id: number;
  fullName: string;
  role: string;
  branchId: number | null;
}

export interface NamedUser {
  id: number;
  fullName: string;
}

export interface LastPayment {
  cashierId: number | null;
  createdAt: Date;
}

export interface LivePayment {
  method: PaymentMethodValue;
  amount: number;
}

export interface LiveOrder {
  id: number;
  createdAt: Date;
  folio: string | null;
  status: string;
  totalAmount: number;
  discountAmount: number;
  patientFirstName: string;
  patientLastName: string;
  payments: LivePayment[];
}

export interface CashCutMovement {
  id: number;
  time: string;
  folio: string;
  patient: string;
  method: MovementMethod;
  methodLabel: string;
  amount: number;
  status: string;
  payments: { method: PaymentMethodValue; label: string; amount: number }[];
}

export interface CashCutSummary {
  cashTotal: number;
  cardTotal: number;
  transferTotal: number;
  ordersCount: number;
  discountsTotal: number;
  cancellationsCount: number;
  totalPaid: number;
  expectedCash: number;
}

export interface LiveSummary {
  summary: CashCutSummary;
  movements: CashCutMovement[];
  period: { start: Date; end: Date };
}

export interface CashCutSnapshot {
  scope: {
    tenantId: number;
    branchId: number;
    branchName: string;
    cashierId: number;
    cashierName: string;
    shift: ShiftValue;
    date: string;
    periodStart: string;
    periodEnd: string;
  };
  summary: CashCutSummary;
  movements: CashCutMovement[];
  generatedAt: string;
}

export interface StoredCut {
  id: number;
  status: string;
  closedAt: Date | null;
  closedBy: NamedUser | null;
  countedCash: number | null;
  difference: number | null;
  observation: string | null;
  cashTotal: number;
  cardTotal: number;
  transferTotal: number;
  ordersCount: number;
  discountsTotal: number;
  cancellationsCount: number;
  expectedCash: number;
  snapshotJson: string | null;
}

export interface SaveCutInput {
  existingId: number | null;
  tenantId: number;
  branchId: number;
  cashierId: number;
  shift: ShiftValue;
  cutDate: Date;
  periodStart: Date;
  periodEnd: Date;
  summary: CashCutSummary;
  countedCash: number;
  difference: number;
  observation: string | null;
  snapshotJson: string;
  closedById: number | null;
  closedAt: Date;
  orderIds: number[];
}

export interface SavedCut {
  id: number;
  status: string;
  closedAt: Date | null;
  observation: string | null;
}

export interface HistoryRow {
  id: number;
  branch: { id: number; name: string };
  cashier: NamedUser;
  shift: string;
  cutDate: Date;
  status: string;
  expectedCash: number;
  countedCash: number | null;
  difference: number | null;
  observation: string | null;
  closedAt: Date | null;
  closedBy: NamedUser | null;
}

export interface ExportCut {
  branchName: string;
  cashierName: string;
  shift: string;
  cutDate: Date;
  status: string;
  expectedCash: number;
  countedCash: number | null;
  difference: number | null;
  observation: string | null;
  closedByName: string | null;
  closedAt: Date | null;
  snapshotJson: string | null;
}

export interface ClosePayload {
  countedCash: number;
  observation?: string;
  closedById: number | null;
}
