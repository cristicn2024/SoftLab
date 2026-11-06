import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CorteCajaRepository } from '../dominio/corte-caja.repository';
import { UNASSIGNED_EMAIL_SUFFIX, UNASSIGNED_USER_NAME } from '../dominio/corte-caja.rules';
import type {
  BranchRow,
  CashierRow,
  ExportCut,
  HistoryRow,
  LastPayment,
  LiveOrder,
  LivePayment,
  NamedUser,
  SaveCutInput,
  SavedCut,
  ShiftValue,
  StoredCut,
  TenantRow,
} from '../dominio/corte-caja.types';

function unassignedEmail(tenantId: number): string {
  return `sin-asignar-${tenantId}${UNASSIGNED_EMAIL_SUFFIX}`;
}

function toNumberOrNull(value: { toString(): string } | null): number | null {
  if (value === null) return null;
  return Number(value);
}

@Injectable()
export class CorteCajaPrismaRepository implements CorteCajaRepository {
  constructor(private readonly prisma: PrismaService) {}

  findTenant(tenantId: number): Promise<TenantRow | null> {
    return this.prisma.tenant.findUnique({ where: { id: tenantId } });
  }

  findBranches(tenantId: number): Promise<BranchRow[]> {
    return this.prisma.branch.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
  }

  findBranch(tenantId: number, branchId: number): Promise<BranchRow | null> {
    return this.prisma.branch.findFirst({ where: { id: branchId, tenantId } });
  }

  findContextCashiers(tenantId: number): Promise<CashierRow[]> {
    return this.prisma.user.findMany({
      where: {
        tenantId,
        role: { in: ['admin', 'receptionist'] },
        email: { not: { endsWith: UNASSIGNED_EMAIL_SUFFIX } },
      },
      orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true, role: true, branchId: true },
    });
  }

  findLastCashierPayment(tenantId: number): Promise<LastPayment | null> {
    return this.prisma.payment.findFirst({
      where: { tenantId, cashierId: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { cashierId: true, createdAt: true },
    });
  }

  findAnyRealUser(tenantId: number): Promise<CashierRow | null> {
    return this.prisma.user.findFirst({
      where: { tenantId, email: { not: { endsWith: UNASSIGNED_EMAIL_SUFFIX } } },
      select: { id: true, fullName: true, role: true, branchId: true },
    });
  }

  findUser(tenantId: number, userId: number): Promise<NamedUser | null> {
    return this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { id: true, fullName: true },
    });
  }

  async findUnassignedUserId(tenantId: number): Promise<number | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: unassignedEmail(tenantId) },
      select: { id: true },
    });
    if (!user) return null;
    return user.id;
  }

  async ensureUnassignedUser(tenantId: number): Promise<number> {
    const user = await this.prisma.user.upsert({
      where: { email: unassignedEmail(tenantId) },
      update: {},
      create: {
        tenantId,
        branchId: null,
        fullName: UNASSIGNED_USER_NAME,
        email: unassignedEmail(tenantId),
        passwordHash: '!',
        role: 'receptionist',
      },
    });
    return user.id;
  }

  async findLiveOrders(
    tenantId: number,
    branchId: number,
    cashierId: number | null,
    start: Date,
    end: Date,
  ): Promise<LiveOrder[]> {
    const orders = await this.prisma.order.findMany({
      where: { tenantId, branchId, cashierId, createdAt: { gte: start, lt: end } },
      include: { patient: true, payments: true },
      orderBy: { createdAt: 'asc' },
    });

    const result: LiveOrder[] = [];
    for (const order of orders) {
      const payments: LivePayment[] = [];
      for (const payment of order.payments) {
        payments.push({ method: payment.method, amount: Number(payment.amount) });
      }
      result.push({
        id: order.id,
        createdAt: order.createdAt,
        folio: order.folio,
        status: order.status,
        totalAmount: Number(order.totalAmount),
        discountAmount: Number(order.discountAmount),
        patientFirstName: order.patient.firstName,
        patientLastName: order.patient.lastName,
        payments,
      });
    }
    return result;
  }

  async findCut(
    tenantId: number,
    branchId: number,
    cashierId: number,
    cutDate: Date,
    shift: ShiftValue,
  ): Promise<StoredCut | null> {
    const cut = await this.prisma.cashCut.findFirst({
      where: { tenantId, branchId, cashierId, cutDate, shift },
      include: { closedBy: { select: { id: true, fullName: true } } },
    });
    if (!cut) return null;
    return {
      id: cut.id,
      status: cut.status,
      closedAt: cut.closedAt,
      closedBy: cut.closedBy,
      countedCash: toNumberOrNull(cut.countedCash),
      difference: toNumberOrNull(cut.difference),
      observation: cut.observation,
      cashTotal: Number(cut.cashTotal),
      cardTotal: Number(cut.cardTotal),
      transferTotal: Number(cut.transferTotal),
      ordersCount: cut.ordersCount,
      discountsTotal: Number(cut.discountsTotal),
      cancellationsCount: cut.cancellationsCount,
      expectedCash: Number(cut.expectedCash),
      snapshotJson: cut.snapshotJson,
    };
  }

  saveClosedCut(input: SaveCutInput): Promise<SavedCut> {
    const totals = {
      status: 'closed' as const,
      cashTotal: input.summary.cashTotal,
      cardTotal: input.summary.cardTotal,
      transferTotal: input.summary.transferTotal,
      discountsTotal: input.summary.discountsTotal,
      ordersCount: input.summary.ordersCount,
      cancellationsCount: input.summary.cancellationsCount,
      expectedCash: input.summary.expectedCash,
      countedCash: input.countedCash,
      difference: input.difference,
      observation: input.observation,
      snapshotJson: input.snapshotJson,
      closedById: input.closedById,
      closedAt: input.closedAt,
    };

    return this.prisma.$transaction(async (tx) => {
      let saved;
      if (input.existingId !== null) {
        saved = await tx.cashCut.update({ where: { id: input.existingId }, data: totals });
      } else {
        saved = await tx.cashCut.create({
          data: {
            tenantId: input.tenantId,
            branchId: input.branchId,
            cashierId: input.cashierId,
            shift: input.shift,
            cutDate: input.cutDate,
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
            ...totals,
          },
        });
      }

      if (input.orderIds.length > 0) {
        await tx.payment.updateMany({
          where: {
            tenantId: input.tenantId,
            branchId: input.branchId,
            orderId: { in: input.orderIds },
            cashCutId: null,
          },
          data: { cashCutId: saved.id },
        });
      }

      return { id: saved.id, status: saved.status, closedAt: saved.closedAt, observation: saved.observation };
    });
  }

  async listCuts(tenantId: number): Promise<HistoryRow[]> {
    const cuts = await this.prisma.cashCut.findMany({
      where: { tenantId },
      include: {
        branch: { select: { id: true, name: true } },
        cashier: { select: { id: true, fullName: true } },
        closedBy: { select: { id: true, fullName: true } },
      },
      orderBy: [{ cutDate: 'desc' }, { createdAt: 'desc' }],
      take: 50,
    });

    const rows: HistoryRow[] = [];
    for (const cut of cuts) {
      rows.push({
        id: cut.id,
        branch: cut.branch,
        cashier: cut.cashier,
        shift: cut.shift,
        cutDate: cut.cutDate,
        status: cut.status,
        expectedCash: Number(cut.expectedCash),
        countedCash: toNumberOrNull(cut.countedCash),
        difference: toNumberOrNull(cut.difference),
        observation: cut.observation,
        closedAt: cut.closedAt,
        closedBy: cut.closedBy,
      });
    }
    return rows;
  }

  async findCutForExport(tenantId: number, cutId: number): Promise<ExportCut | null> {
    const cut = await this.prisma.cashCut.findFirst({
      where: { id: cutId, tenantId },
      include: {
        branch: { select: { name: true } },
        cashier: { select: { fullName: true } },
        closedBy: { select: { fullName: true } },
      },
    });
    if (!cut) return null;
    let closedByName: string | null = null;
    if (cut.closedBy) closedByName = cut.closedBy.fullName;
    return {
      branchName: cut.branch.name,
      cashierName: cut.cashier.fullName,
      shift: cut.shift,
      cutDate: cut.cutDate,
      status: cut.status,
      expectedCash: Number(cut.expectedCash),
      countedCash: toNumberOrNull(cut.countedCash),
      difference: toNumberOrNull(cut.difference),
      observation: cut.observation,
      closedByName,
      closedAt: cut.closedAt,
      snapshotJson: cut.snapshotJson,
    };
  }
}
