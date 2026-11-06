import { ErrorDeDominio } from '../../../comun/errores';
import {
  BranchNotFoundError,
  CashCutFailedError,
  CashierNotFoundError,
  CutAlreadyClosedError,
  CutNotFoundError,
  NoBranchesError,
  ObservationRequiredError,
  TenantNotFoundError,
} from './corte-caja.errors';
import type { CorteCajaRepository } from './corte-caja.repository';
import {
  buildCsv,
  buildLiveSummary,
  buildSnapshot,
  defaultShiftFor,
  formatLocalDate,
  parseDateOnly,
  parseSnapshot,
  resolvePeriod,
  round2,
  SHIFT_CATALOG,
  SHIFT_VALUES,
  shiftForHour,
  UNASSIGNED_USER_NAME,
} from './corte-caja.rules';
import type {
  BranchRow,
  CashierRow,
  ClosePayload,
  LiveSummary,
  NamedUser,
  Scope,
  StoredCut,
} from './corte-caja.types';

export interface HistoryRowOut {
  id: number;
  branch: { id: number; name: string };
  cashier: NamedUser;
  shift: string;
  date: Date;
  status: string;
  expectedCash: number;
  countedCash: number | null;
  difference: number | null;
  observation: string | null;
  closedAt: Date | null;
  closedBy: NamedUser | null;
}

export class CorteCajaService {
  constructor(private readonly repository: CorteCajaRepository) {}

  private failure(error: unknown): never {
    if (error instanceof ErrorDeDominio) throw error;
    console.error(error);
    throw new CashCutFailedError();
  }

  async getContext(tenantId: number, now: Date) {
    try {
      const tenant = await this.repository.findTenant(tenantId);
      const branches = await this.repository.findBranches(tenantId);
      const users = await this.repository.findContextCashiers(tenantId);

      if (!tenant) throw new TenantNotFoundError();
      if (branches.length === 0) throw new NoBranchesError();

      const lastPayment = await this.repository.findLastCashierPayment(tenantId);
      const currentUser = await this.pickCurrentUser(tenantId, users, lastPayment?.cashierId);

      let cashiers: CashierRow[] = [];
      if (users.length > 0) cashiers = users;
      else if (currentUser) cashiers = [currentUser];

      const shifts = SHIFT_VALUES.map(function conConfiguracion(value) {
        return { value, ...SHIFT_CATALOG[value] };
      });

      const today = formatLocalDate(now);
      const paidToday = lastPayment !== null && formatLocalDate(lastPayment.createdAt) === today;

      return {
        tenant: { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain },
        currentUser,
        branches,
        cashiers,
        shifts,
        today,
        defaultShift: paidToday && lastPayment ? shiftForHour(lastPayment.createdAt.getHours()) : defaultShiftFor(now),
      };
    } catch (error) {
      return this.failure(error);
    }
  }

  private async pickCurrentUser(
    tenantId: number,
    users: CashierRow[],
    lastCashierId: number | null | undefined,
  ): Promise<CashierRow | null> {
    for (const user of users) {
      if (user.id === lastCashierId) return user;
    }
    for (const user of users) {
      if (user.role === 'receptionist') return user;
    }
    if (users.length > 0) return users[0];
    return this.repository.findAnyRealUser(tenantId);
  }

  private async scopeNames(scope: Scope): Promise<{ branch: BranchRow; cashier: NamedUser }> {
    const branch = await this.repository.findBranch(scope.tenantId, scope.branchId);
    let cashier: NamedUser | null = null;
    if (scope.cashierId === 0) cashier = { id: 0, fullName: UNASSIGNED_USER_NAME };
    else cashier = await this.repository.findUser(scope.tenantId, scope.cashierId);

    if (!branch) throw new BranchNotFoundError();
    if (!cashier) throw new CashierNotFoundError();
    return { branch, cashier };
  }

  private async liveSummary(scope: Scope): Promise<LiveSummary> {
    const { start, end } = resolvePeriod(scope.date, scope.shift);
    const orders = await this.repository.findLiveOrders(
      scope.tenantId,
      scope.branchId,
      scope.cashierId === 0 ? null : scope.cashierId,
      start,
      end,
    );
    return buildLiveSummary(orders, start, end);
  }

  async getSummary(scope: Scope) {
    try {
      const { branch, cashier } = await this.scopeNames(scope);
      const cutDate = parseDateOnly(scope.date);
      const config = SHIFT_CATALOG[scope.shift];
      const { start, end } = resolvePeriod(scope.date, scope.shift);

      let storageCashierId: number | null = scope.cashierId;
      if (scope.cashierId === 0) storageCashierId = await this.repository.findUnassignedUserId(scope.tenantId);

      let existingCut: StoredCut | null = null;
      if (storageCashierId !== null) {
        existingCut = await this.repository.findCut(scope.tenantId, scope.branchId, storageCashierId, cutDate, scope.shift);
      }

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
        periodEnd: end.toISOString(),
      };

      if (existingCut && existingCut.status === 'closed') {
        const snapshot = parseSnapshot(existingCut.snapshotJson);
        return {
          scope: scopeInfo,
          status: 'closed' as const,
          cutId: existingCut.id as number | null,
          closedAt: existingCut.closedAt,
          closedBy: existingCut.closedBy,
          countedCash: existingCut.countedCash,
          difference: existingCut.difference !== null ? existingCut.difference : 0,
          observation: existingCut.observation as string | null,
          summary: {
            cashTotal: existingCut.cashTotal,
            cardTotal: existingCut.cardTotal,
            transferTotal: existingCut.transferTotal,
            ordersCount: existingCut.ordersCount,
            discountsTotal: existingCut.discountsTotal,
            cancellationsCount: existingCut.cancellationsCount,
            totalPaid: round2(existingCut.cashTotal + existingCut.cardTotal + existingCut.transferTotal),
            expectedCash: existingCut.expectedCash,
          },
          movements: snapshot ? snapshot.movements : [],
        };
      }

      const live = await this.liveSummary(scope);
      return {
        scope: scopeInfo,
        status: 'open' as const,
        cutId: existingCut ? existingCut.id : null,
        closedAt: null,
        closedBy: null,
        countedCash: null,
        difference: null,
        observation: '' as string | null,
        summary: live.summary,
        movements: live.movements,
      };
    } catch (error) {
      return this.failure(error);
    }
  }

  async closeCut(scope: Scope, payload: ClosePayload, now: Date) {
    try {
      const { branch, cashier } = await this.scopeNames(scope);
      const cutDate = parseDateOnly(scope.date);
      const { start, end } = resolvePeriod(scope.date, scope.shift);

      let realCashierId = scope.cashierId;
      if (scope.cashierId === 0) realCashierId = await this.repository.ensureUnassignedUser(scope.tenantId);

      const existing = await this.repository.findCut(scope.tenantId, scope.branchId, realCashierId, cutDate, scope.shift);
      if (existing && existing.status === 'closed') throw new CutAlreadyClosedError();

      const live = await this.liveSummary(scope);
      const countedCash = round2(Number(payload.countedCash));
      const difference = round2(countedCash - live.summary.expectedCash);
      const observation = (payload.observation ?? '').trim();

      if (difference !== 0 && observation.length === 0) throw new ObservationRequiredError();

      const snapshot = buildSnapshot(scope, branch.name, cashier.fullName, live, now);
      const orderIds: number[] = [];
      for (const movement of live.movements) orderIds.push(movement.id);

      const saved = await this.repository.saveClosedCut({
        existingId: existing ? existing.id : null,
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        cashierId: realCashierId,
        shift: scope.shift,
        cutDate,
        periodStart: start,
        periodEnd: end,
        summary: live.summary,
        countedCash,
        difference,
        observation: observation || null,
        snapshotJson: JSON.stringify(snapshot),
        closedById: payload.closedById,
        closedAt: now,
        orderIds,
      });

      return {
        cutId: saved.id,
        status: saved.status,
        closedAt: saved.closedAt,
        countedCash,
        difference,
        observation: saved.observation,
        summary: live.summary,
        movements: live.movements,
        branch: branch.name,
        cashier: cashier.fullName,
      };
    } catch (error) {
      return this.failure(error);
    }
  }

  async getHistory(tenantId: number) {
    try {
      const cuts = await this.repository.listCuts(tenantId);
      const rows: HistoryRowOut[] = [];
      for (const cut of cuts) {
        rows.push({
          id: cut.id,
          branch: cut.branch,
          cashier: cut.cashier,
          shift: cut.shift,
          date: cut.cutDate,
          status: cut.status,
          expectedCash: cut.expectedCash,
          countedCash: cut.countedCash,
          difference: cut.difference,
          observation: cut.observation,
          closedAt: cut.closedAt,
          closedBy: cut.closedBy,
        });
      }
      return rows;
    } catch (error) {
      return this.failure(error);
    }
  }

  async getCsv(tenantId: number, cutId: number): Promise<string> {
    try {
      const cut = await this.repository.findCutForExport(tenantId, cutId);
      if (!cut) throw new CutNotFoundError();
      return buildCsv(cut);
    } catch (error) {
      return this.failure(error);
    }
  }
}
