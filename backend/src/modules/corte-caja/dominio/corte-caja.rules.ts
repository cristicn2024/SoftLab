import { InvalidDateError, InvalidShiftError } from './corte-caja.errors';
import type {
  CashCutMovement,
  CashCutSnapshot,
  CashCutSummary,
  ExportCut,
  LiveOrder,
  LivePayment,
  LiveSummary,
  MovementMethod,
  PaymentMethodValue,
  Scope,
  ShiftConfig,
  ShiftValue,
} from './corte-caja.types';

export const SHIFT_CATALOG: Record<ShiftValue, ShiftConfig> = {
  matutino: { label: 'Matutino', schedule: '08:00 – 15:00', startHour: 8, endHour: 15 },
  vespertino: { label: 'Vespertino', schedule: '15:00 – 22:00', startHour: 15, endHour: 22 },
  nocturno: { label: 'Nocturno', schedule: '22:00 – 08:00', startHour: 22, endHour: 8 },
};

export const SHIFT_VALUES: ShiftValue[] = ['matutino', 'vespertino', 'nocturno'];

const METHOD_LABEL: Record<PaymentMethodValue, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
};

export const UNASSIGNED_USER_NAME = 'Sin asignar';
export const UNASSIGNED_EMAIL_SUFFIX = '@sistema.local';

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function datePieces(dateStr: string): number[] {
  const pieces: number[] = [];
  for (const piece of dateStr.split('-')) pieces.push(Number(piece));
  return pieces;
}

export function parseDateOnly(dateStr: string): Date {
  const [year, month, day] = datePieces(dateStr);
  if (!year || !month || !day) {
    throw new InvalidDateError();
  }
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new InvalidDateError();
  }
  return candidate;
}

export function resolvePeriod(dateStr: string, shift: ShiftValue) {
  const [year, month, day] = datePieces(dateStr);
  const config = SHIFT_CATALOG[shift];
  if (!config) throw new InvalidShiftError();

  const start = new Date(year, month - 1, day, config.startHour, 0, 0, 0);
  const end = new Date(year, month - 1, day, config.endHour, 0, 0, 0);
  if (config.endHour <= config.startHour) {
    end.setDate(end.getDate() + 1);
  }
  return { start, end, config };
}

export function shiftForHour(hour: number): ShiftValue {
  if (hour >= 8 && hour < 15) return 'matutino';
  if (hour >= 15 && hour < 22) return 'vespertino';
  return 'nocturno';
}

export function defaultShiftFor(date: Date): ShiftValue {
  return shiftForHour(date.getHours());
}

export function activePayments(payments: LivePayment[]): LivePayment[] {
  const active: LivePayment[] = [];
  for (const payment of payments) {
    if (!payment.cancelled) active.push(payment);
  }
  return active;
}

export function methodForOrder(status: string, payments: LivePayment[]): { method: MovementMethod; label: string } {
  if (status === 'cancelled') return { method: 'cancelled', label: 'Cancelado' };
  if (payments.length === 0) return { method: 'pending', label: 'Pendiente' };

  const methods = new Set<PaymentMethodValue>();
  for (const payment of payments) methods.add(payment.method);

  if (methods.size === 1) {
    const only = payments[0].method;
    return { method: only, label: METHOD_LABEL[only] };
  }

  if (methods.has('cash') && methods.has('card') && methods.size === 2) {
    return { method: 'mixed', label: 'Efectivo + tarjeta' };
  }
  return { method: 'mixed', label: 'Mixto' };
}

export function buildLiveSummary(orders: LiveOrder[], start: Date, end: Date): LiveSummary {
  const summary: CashCutSummary = {
    cashTotal: 0,
    cardTotal: 0,
    transferTotal: 0,
    ordersCount: orders.length,
    discountsTotal: 0,
    cancellationsCount: 0,
    totalPaid: 0,
    expectedCash: 0,
  };

  const movements: CashCutMovement[] = [];
  for (const order of orders) {
    const payments: CashCutMovement['payments'] = [];
    const received = activePayments(order.payments);
    for (const payment of received) {
      payments.push({ method: payment.method, label: METHOD_LABEL[payment.method], amount: payment.amount });
      if (payment.method === 'cash') summary.cashTotal += payment.amount;
      if (payment.method === 'card') summary.cardTotal += payment.amount;
      if (payment.method === 'transfer') summary.transferTotal += payment.amount;
      summary.totalPaid += payment.amount;
    }

    summary.discountsTotal += order.discountAmount;
    if (order.status === 'cancelled') summary.cancellationsCount += 1;

    const { method, label } = methodForOrder(order.status, received);
    movements.push({
      id: order.id,
      time: order.createdAt.toISOString(),
      folio: order.folio ?? `ORD-${String(order.id).padStart(6, '0')}`,
      patient: `${order.patientFirstName} ${order.patientLastName}`.trim(),
      method,
      methodLabel: label,
      amount: order.totalAmount,
      status: order.status,
      payments,
    });
  }

  summary.cashTotal = round2(summary.cashTotal);
  summary.cardTotal = round2(summary.cardTotal);
  summary.transferTotal = round2(summary.transferTotal);
  summary.discountsTotal = round2(summary.discountsTotal);
  summary.totalPaid = round2(summary.totalPaid);
  summary.expectedCash = summary.cashTotal;

  return { summary, movements, period: { start, end } };
}

export function buildSnapshot(
  scope: Scope,
  branchName: string,
  cashierName: string,
  live: LiveSummary,
  generatedAt: Date,
): CashCutSnapshot {
  return {
    scope: {
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      branchName,
      cashierId: scope.cashierId,
      cashierName,
      shift: scope.shift,
      date: scope.date,
      periodStart: live.period.start.toISOString(),
      periodEnd: live.period.end.toISOString(),
    },
    summary: live.summary,
    movements: live.movements,
    generatedAt: generatedAt.toISOString(),
  };
}

export function parseSnapshot(value: string | null): CashCutSnapshot | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as CashCutSnapshot;
  } catch {
    return null;
  }
}

function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function csvRow(cells: (string | number | null | undefined)[]): string {
  const escaped: string[] = [];
  for (const cell of cells) escaped.push(csvCell(cell));
  return escaped.join(',');
}

export function buildCsv(cut: ExportCut): string {
  const movements = parseSnapshot(cut.snapshotJson)?.movements ?? [];

  const lines: string[] = [];
  lines.push(
    csvRow(['Reporte', 'Corte de caja']),
    csvRow(['Sucursal', cut.branchName]),
    csvRow(['Cajero', cut.cashierName]),
    csvRow(['Turno', cut.shift]),
    csvRow(['Fecha', cut.cutDate.toISOString().slice(0, 10)]),
    csvRow(['Estado', cut.status]),
    csvRow(['Efectivo esperado', cut.expectedCash]),
    csvRow(['Efectivo contado', cut.countedCash !== null ? cut.countedCash : '']),
    csvRow(['Diferencia', cut.difference !== null ? cut.difference : 0]),
    csvRow(['Observación', cut.observation ?? '']),
    csvRow(['Cerrado por', cut.closedByName ?? '']),
    csvRow(['Cerrado el', cut.closedAt ? cut.closedAt.toISOString() : '']),
    '',
  );
  lines.push(csvRow(['HORA', 'FOLIO', 'PACIENTE', 'MÉTODO', 'MONTO']));

  for (const movement of movements) {
    lines.push(
      csvRow([
        new Date(movement.time).toLocaleTimeString('es-MX', { hour12: false }),
        movement.folio,
        movement.patient,
        movement.methodLabel,
        movement.amount,
      ]),
    );
  }

  return lines.join('\r\n');
}
