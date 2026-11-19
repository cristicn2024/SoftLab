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
  /** Id del pago; se usa para ligar al corte solo los pagos que le pertenecen. */
  id?: number;
  method: PaymentMethodValue;
  amount: number;
  /** Corte al que ya quedó ligado el pago; nulo si el pago es posterior al cierre. */
  cashCutId?: number | null;
  /** Pago anulado desde cobro: ya no es dinero recibido y no entra al corte. */
  cancelled?: boolean;
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
  /**
   * Pagos del cajero y periodo del corte (HU 5.4 CA2/CA3): se atribuyen por la fecha y el cajero
   * del pago, no por los de la orden.
   */
  payments: LivePayment[];
  /**
   * Verdadero (o ausente) si la orden se creó en este periodo por este cajero. Una orden que solo
   * entra porque se cobró aquí no suma a órdenes, descuentos ni cancelaciones, para no contarla dos veces.
   */
  originatedHere?: boolean;
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

export interface PostCloseSummary {
  cashTotal: number;
  cardTotal: number;
  transferTotal: number;
  totalPaid: number;
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
  /** Pagos del corte (periodo y cajero); solo esos se ligan al cerrar. */
  paymentIds: number[];
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
