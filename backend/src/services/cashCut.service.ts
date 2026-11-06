import { CashCutShift, PaymentMethod, Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { CashCutShiftValue } from '../dtos/cashCut.dto';

export const SHIFT_CATALOG: Record<
  CashCutShiftValue,
  { label: string; schedule: string; startHour: number; endHour: number }
> = {
  matutino: { label: 'Matutino', schedule: '08:00 – 15:00', startHour: 8, endHour: 15 },
  vespertino: { label: 'Vespertino', schedule: '15:00 – 22:00', startHour: 15, endHour: 22 },
  nocturno: { label: 'Nocturno', schedule: '22:00 – 08:00', startHour: 22, endHour: 8 }
};

const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia'
};

export type MovementMethod = 'cash' | 'card' | 'transfer' | 'mixed' | 'pending' | 'cancelled';

export interface CashCutMovement {
  id: number;
  time: string;
  folio: string;
  patient: string;
  method: MovementMethod;
  methodLabel: string;
  amount: number;
  status: string;
  payments: { method: PaymentMethod; label: string; amount: number }[];
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

export interface CashCutSnapshot {
  scope: {
    tenantId: number;
    branchId: number;
    branchName: string;
    cashierId: number;
    cashierName: string;
    shift: CashCutShiftValue;
    date: string;
    periodStart: string;
    periodEnd: string;
  };
  summary: CashCutSummary;
  movements: CashCutMovement[];
  generatedAt: string;
}

export class CashCutValidationError extends Error {
  status = 400;
}
export class CashCutConflictError extends Error {
  status = 409;
}
export class CashCutNotFoundError extends Error {
  status = 404;
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateOnly(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) {
    throw new CashCutValidationError('Fecha inválida');
  }
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new CashCutValidationError('Fecha inválida');
  }
  return candidate;
}

export function resolvePeriod(dateStr: string, shift: CashCutShiftValue) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const config = SHIFT_CATALOG[shift];
  if (!config) throw new CashCutValidationError('Turno inválido');

  const start = new Date(year, month - 1, day, config.startHour, 0, 0, 0);
  const end = new Date(year, month - 1, day, config.endHour, 0, 0, 0);
  if (config.endHour <= config.startHour) {
    end.setDate(end.getDate() + 1);
  }
  return { start, end, config };
}

export function defaultShiftFor(date = new Date()): CashCutShiftValue {
  return shiftForHour(date.getHours());
}

export function shiftForHour(hour: number): CashCutShiftValue {
  if (hour >= 8 && hour < 15) return 'matutino';
  if (hour >= 15 && hour < 22) return 'vespertino';
  return 'nocturno';
}

function methodForOrder(
  status: string,
  payments: { method: PaymentMethod; amount: Prisma.Decimal }[]
): { method: MovementMethod; label: string } {
  if (status === 'cancelled') return { method: 'cancelled', label: 'Cancelado' };
  if (payments.length === 0) return { method: 'pending', label: 'Pendiente' };

  const methods = new Set(payments.map(p => p.method));
  if (methods.size === 1) {
    const only = [...methods][0];
    return { method: only, label: METHOD_LABEL[only] };
  }

  if (methods.has('cash') && methods.has('card') && methods.size === 2) {
    return { method: 'mixed', label: 'Efectivo + tarjeta' };
  }
  return { method: 'mixed', label: 'Mixto' };
}

interface ScopeInput {
  tenantId: number;
  branchId: number;
  cashierId: number;
  shift: CashCutShiftValue;
  date: string;
}

export async function getCashCutContext(tenantId: number) {
  const [tenant, branches, users] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    prisma.branch.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
    prisma.user.findMany({
      where: { tenantId, role: { in: ['admin', 'receptionist'] } },
      orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true, role: true, branchId: true }
    })
  ]);

  if (!tenant) throw new CashCutNotFoundError('Laboratorio no encontrado');
  if (branches.length === 0) throw new CashCutNotFoundError('No hay sucursales registradas');

  // El cajero por defecto es quien registró el último pago; si no hay actividad,
  // se usa el primer recepcionista disponible.
  const lastPayment = await prisma.payment.findFirst({
    where: { tenantId, cashierId: { not: null } },
    orderBy: { createdAt: 'desc' },
    select: { cashierId: true, createdAt: true }
  });

  const currentUser =
    users.find(u => u.id === lastPayment?.cashierId) ??
    users.find(u => u.role === 'receptionist') ??
    users[0] ??
    (await prisma.user.findFirst({
      where: { tenantId },
      select: { id: true, fullName: true, role: true, branchId: true }
    }));



  return {
    tenant: { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain },
    currentUser,
    branches,
    cashiers: users.length > 0 ? users : currentUser ? [currentUser] : [],
    shifts: (Object.keys(SHIFT_CATALOG) as CashCutShiftValue[]).map(value => ({
      value,
      ...SHIFT_CATALOG[value]
    })),
    today: formatLocalDate(new Date()),
    defaultShift:
      lastPayment && formatLocalDate(lastPayment.createdAt) === formatLocalDate(new Date())
        ? shiftForHour(lastPayment.createdAt.getHours())
        : defaultShiftFor()
  };
}

export async function getScopeNames(scope: ScopeInput, allowUnassigned = false) {
  const [branch, cashier] = await Promise.all([
    prisma.branch.findFirst({ where: { id: scope.branchId, tenantId: scope.tenantId } }),
    allowUnassigned && scope.cashierId === 0 ? { id: 0, fullName: 'Sin asignar' } : prisma.user.findFirst({
      where: { id: scope.cashierId, tenantId: scope.tenantId },
      select: { id: true, fullName: true, role: true }
    })
  ]);

  if (!branch) throw new CashCutNotFoundError('Sucursal no encontrada');
  if (!cashier) throw new CashCutNotFoundError('Cajero no encontrado');

  return { branch, cashier };
}

export async function computeLiveSummary(scope: ScopeInput) {
  const { start, end } = resolvePeriod(scope.date, scope.shift);

  const orders = await prisma.order.findMany({
    where: {
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      cashierId: scope.cashierId === 0 ? null : scope.cashierId,
      createdAt: { gte: start, lt: end }
    },
    include: {
      patient: true,
      payments: true
    },
    orderBy: { createdAt: 'asc' }
  });

  const summary: CashCutSummary = {
    cashTotal: 0,
    cardTotal: 0,
    transferTotal: 0,
    ordersCount: orders.length,
    discountsTotal: 0,
    cancellationsCount: 0,
    totalPaid: 0,
    expectedCash: 0
  };

  const movements: CashCutMovement[] = orders.map(order => {
    const payments = order.payments.map(payment => ({
      method: payment.method,
      label: METHOD_LABEL[payment.method],
      amount: Number(payment.amount)
    }));

    for (const payment of order.payments) {
      const amount = Number(payment.amount);
      if (payment.method === 'cash') summary.cashTotal += amount;
      if (payment.method === 'card') summary.cardTotal += amount;
      if (payment.method === 'transfer') summary.transferTotal += amount;
      summary.totalPaid += amount;
    }

    summary.discountsTotal += Number(order.discountAmount);
    if (order.status === 'cancelled') summary.cancellationsCount += 1;

    const { method, label } = methodForOrder(order.status, order.payments);

    return {
      id: order.id,
      time: order.createdAt.toISOString(),
      folio: order.folio ?? `ORD-${String(order.id).padStart(6, '0')}`,
      patient: `${order.patient.firstName} ${order.patient.lastName}`.trim(),
      method,
      methodLabel: label,
      amount: Number(order.totalAmount),
      status: order.status,
      payments
    };
  });

  summary.cashTotal = round2(summary.cashTotal);
  summary.cardTotal = round2(summary.cardTotal);
  summary.transferTotal = round2(summary.transferTotal);
  summary.discountsTotal = round2(summary.discountsTotal);
  summary.totalPaid = round2(summary.totalPaid);
  summary.expectedCash = summary.cashTotal;

  return { orders, summary, movements, period: { start, end } };
}

function buildSnapshot(
  scope: ScopeInput,
  names: { branch: { name: string }; cashier: { fullName: string } },
  live: Awaited<ReturnType<typeof computeLiveSummary>>
): CashCutSnapshot {
  return {
    scope: {
      tenantId: scope.tenantId,
      branchId: scope.branchId,
      branchName: names.branch.name,
      cashierId: scope.cashierId,
      cashierName: names.cashier.fullName,
      shift: scope.shift,
      date: scope.date,
      periodStart: live.period.start.toISOString(),
      periodEnd: live.period.end.toISOString()
    },
    summary: live.summary,
    movements: live.movements,
    generatedAt: new Date().toISOString()
  };
}

function serializeSnapshot(snapshot: CashCutSnapshot) {
  return JSON.stringify(snapshot);
}

function parseSnapshot(value: string | null): CashCutSnapshot | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as CashCutSnapshot;
  } catch {
    return null;
  }
}

export async function getCashCutSummary(scope: ScopeInput) {
  const { branch, cashier } = await getScopeNames(scope, true);
  const cutDate = parseDateOnly(scope.date);
  const config = SHIFT_CATALOG[scope.shift];
  const { start, end } = resolvePeriod(scope.date, scope.shift);

  const existingCut = scope.cashierId === 0 ? null : await prisma.cashCut.findUnique({
    where: {
      uq_cash_cut_scope: {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        cashierId: scope.cashierId,
        cutDate,
        shift: scope.shift as CashCutShift
      }
    },
    include: { closedBy: { select: { id: true, fullName: true } } }
  });

  const scopeInfo = {
    branchId: branch.id,
    branchName: branch.name,
    cashierId: cashier.id,
    cashierName: cashier.fullName,
    shift: scope.shift,
    shiftLabel: config.label,
    schedule: config.schedule,
    date: scope.date,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString()
  };

  if (existingCut?.status === 'closed') {
    const snapshot = parseSnapshot(existingCut.snapshotJson);
    return {
      scope: scopeInfo,
      status: 'closed' as const,
      cutId: existingCut.id,
      closedAt: existingCut.closedAt,
      closedBy: existingCut.closedBy,
      countedCash:
        existingCut.countedCash !== null ? Number(existingCut.countedCash) : null,
      difference: existingCut.difference !== null ? Number(existingCut.difference) : 0,
      observation: existingCut.observation,
      summary: {
        cashTotal: Number(existingCut.cashTotal),
        cardTotal: Number(existingCut.cardTotal),
        transferTotal: Number(existingCut.transferTotal),
        ordersCount: existingCut.ordersCount,
        discountsTotal: Number(existingCut.discountsTotal),
        cancellationsCount: existingCut.cancellationsCount,
        totalPaid: round2(
          Number(existingCut.cashTotal) +
            Number(existingCut.cardTotal) +
            Number(existingCut.transferTotal)
        ),
        expectedCash: Number(existingCut.expectedCash)
      },
      movements: snapshot?.movements ?? []
    };
  }

  const live = await computeLiveSummary(scope);

  return {
    scope: scopeInfo,
    status: 'open' as const,
    cutId: existingCut?.id ?? null,
    closedAt: null,
    closedBy: null,
    countedCash: null,
    difference: null,
    observation: '',
    summary: live.summary,
    movements: live.movements
  };
}

export async function closeCashCut(
  scope: ScopeInput,
  payload: { countedCash: number; observation?: string; closedById: number }
) {
  const { branch, cashier } = await getScopeNames(scope);
  const cutDate = parseDateOnly(scope.date);
  const { start, end } = resolvePeriod(scope.date, scope.shift);

  const existing = await prisma.cashCut.findUnique({
    where: {
      uq_cash_cut_scope: {
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        cashierId: scope.cashierId,
        cutDate,
        shift: scope.shift as CashCutShift
      }
    }
  });

  if (existing?.status === 'closed') {
    throw new CashCutConflictError('El corte de caja ya está cerrado y no puede modificarse');
  }

  const live = await computeLiveSummary(scope);
  const countedCash = round2(Number(payload.countedCash));
  const difference = round2(countedCash - live.summary.expectedCash);
  const observation = (payload.observation ?? '').trim();

  if (difference !== 0 && observation.length === 0) {
    throw new CashCutValidationError(
      'La observación es obligatoria cuando el efectivo contado presenta una diferencia'
    );
  }

  const snapshot = buildSnapshot(scope, { branch, cashier }, live);
  const closedAt = new Date();

  const cut = await prisma.$transaction(async tx => {
    const saved = existing
      ? await tx.cashCut.update({
          where: { id: existing.id },
          data: {
            status: 'closed',
            cashTotal: live.summary.cashTotal,
            cardTotal: live.summary.cardTotal,
            transferTotal: live.summary.transferTotal,
            discountsTotal: live.summary.discountsTotal,
            ordersCount: live.summary.ordersCount,
            cancellationsCount: live.summary.cancellationsCount,
            expectedCash: live.summary.expectedCash,
            countedCash,
            difference,
            observation: difference === 0 ? observation || null : observation,
            snapshotJson: serializeSnapshot(snapshot),
            closedById: payload.closedById,
            closedAt
          }
        })
      : await tx.cashCut.create({
          data: {
            tenantId: scope.tenantId,
            branchId: scope.branchId,
            cashierId: scope.cashierId,
            shift: scope.shift as CashCutShift,
            cutDate,
            periodStart: start,
            periodEnd: end,
            status: 'closed',
            cashTotal: live.summary.cashTotal,
            cardTotal: live.summary.cardTotal,
            transferTotal: live.summary.transferTotal,
            discountsTotal: live.summary.discountsTotal,
            ordersCount: live.summary.ordersCount,
            cancellationsCount: live.summary.cancellationsCount,
            expectedCash: live.summary.expectedCash,
            countedCash,
            difference,
            observation: observation || null,
            snapshotJson: serializeSnapshot(snapshot),
            closedById: payload.closedById,
            closedAt
          }
        });

    if (live.movements.length > 0) {
      await tx.payment.updateMany({
        where: {
          tenantId: scope.tenantId,
          branchId: scope.branchId,
          orderId: { in: live.movements.map(m => m.id) },
          cashCutId: null
        },
        data: { cashCutId: saved.id }
      });
    }

    return saved;
  });

  return {
    cutId: cut.id,
    status: cut.status,
    closedAt: cut.closedAt,
    countedCash,
    difference,
    observation: cut.observation,
    summary: live.summary,
    movements: live.movements,
    branch: branch.name,
    cashier: cashier.fullName
  };
}

export async function getCashCutHistory(tenantId: number) {
  const cuts = await prisma.cashCut.findMany({
    where: { tenantId },
    include: {
      branch: { select: { id: true, name: true } },
      cashier: { select: { id: true, fullName: true } },
      closedBy: { select: { id: true, fullName: true } }
    },
    orderBy: [{ cutDate: 'desc' }, { createdAt: 'desc' }],
    take: 50
  });

  return cuts.map(cut => ({
    id: cut.id,
    branch: cut.branch,
    cashier: cut.cashier,
    shift: cut.shift,
    date: cut.cutDate,
    status: cut.status,
    expectedCash: Number(cut.expectedCash),
    countedCash: cut.countedCash !== null ? Number(cut.countedCash) : null,
    difference: cut.difference !== null ? Number(cut.difference) : null,
    observation: cut.observation,
    closedAt: cut.closedAt,
    closedBy: cut.closedBy
  }));
}

export async function getCashCutCsv(tenantId: number, cutId: number) {
  const cut = await prisma.cashCut.findFirst({
    where: { id: cutId, tenantId },
    include: {
      branch: { select: { name: true } },
      cashier: { select: { fullName: true } },
      closedBy: { select: { fullName: true } }
    }
  });

  if (!cut) throw new CashCutNotFoundError('Corte de caja no encontrado');

  const snapshot = parseSnapshot(cut.snapshotJson);
  const movements = snapshot?.movements ?? [];

  const escape = (value: string | number | null | undefined) => {
    const text = value === null || value === undefined ? '' : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };

  const lines: string[] = [];
  lines.push(
    ['Reporte', 'Corte de caja'].map(escape).join(','),
    ['Sucursal', cut.branch.name].map(escape).join(','),
    ['Cajero', cut.cashier.fullName].map(escape).join(','),
    ['Turno', cut.shift].map(escape).join(','),
    ['Fecha', cut.cutDate.toISOString().slice(0, 10)].map(escape).join(','),
    ['Estado', cut.status].map(escape).join(','),
    ['Efectivo esperado', Number(cut.expectedCash)].map(escape).join(','),
    ['Efectivo contado', cut.countedCash !== null ? Number(cut.countedCash) : ''].map(escape).join(','),
    ['Diferencia', cut.difference !== null ? Number(cut.difference) : 0].map(escape).join(','),
    ['Observación', cut.observation ?? ''].map(escape).join(','),
    ['Cerrado por', cut.closedBy?.fullName ?? ''].map(escape).join(','),
    ['Cerrado el', cut.closedAt ? cut.closedAt.toISOString() : ''].map(escape).join(','),
    ''
  );
  lines.push(['HORA', 'FOLIO', 'PACIENTE', 'MÉTODO', 'MONTO'].map(escape).join(','));

  for (const movement of movements) {
    lines.push(
      [
        new Date(movement.time).toLocaleTimeString('es-MX', { hour12: false }),
        movement.folio,
        movement.patient,
        movement.methodLabel,
        movement.amount
      ]
        .map(escape)
        .join(',')
    );
  }

  return lines.join('\r\n');
}
