import type { CorteCajaRepository } from './corte-caja.repository';
import { UNASSIGNED_EMAIL_SUFFIX, UNASSIGNED_USER_NAME } from './corte-caja.rules';
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
} from './corte-caja.types';

export interface FakeUser {
  id: number;
  tenantId: number;
  fullName: string;
  email: string;
  role: string;
  branchId: number | null;
}

export interface FakeOrder {
  tenantId: number;
  branchId: number;
  cashierId: number | null;
  order: LiveOrder;
  paymentCreatedAt: Date;
  cashCutId: number | null;
}

export interface FakeCut {
  id: number;
  input: SaveCutInput;
  status: string;
  closedAt: Date | null;
  observation: string | null;
}

export class FakeRepository implements CorteCajaRepository {
  readonly tenants: TenantRow[] = [];
  readonly branches: BranchRow[] = [];
  readonly users: FakeUser[] = [];
  readonly orders: FakeOrder[] = [];
  readonly cuts: FakeCut[] = [];
  failWith: Error | null = null;
  private nextUserId = 100;
  private nextCutId = 1;

  addTenant(id: number, name = `Laboratorio ${id}`): TenantRow {
    const tenant = { id, name, subdomain: `lab-${id}` };
    this.tenants.push(tenant);
    return tenant;
  }

  addBranch(tenantId: number, id: number, name = `Sucursal ${id}`): BranchRow {
    const branch: BranchRow = { id, tenantId, name, address: null, phone: null, createdAt: new Date(2026, 0, 1) };
    this.branches.push(branch);
    return branch;
  }

  addUser(tenantId: number, id: number, fullName: string, role = 'receptionist'): FakeUser {
    const user: FakeUser = { id, tenantId, fullName, email: `u${id}@lab.test`, role, branchId: null };
    this.users.push(user);
    return user;
  }

  addOrder(
    tenantId: number,
    branchId: number,
    cashierId: number | null,
    createdAt: Date,
    overrides: Partial<LiveOrder> = {},
  ): FakeOrder {
    const id = this.orders.length + 1;
    const payments: LivePayment[] = overrides.payments ?? [];
    const fake: FakeOrder = {
      tenantId,
      branchId,
      cashierId,
      paymentCreatedAt: createdAt,
      cashCutId: null,
      order: {
        id,
        createdAt,
        folio: `F-${id}`,
        status: 'completed',
        totalAmount: 0,
        discountAmount: 0,
        patientFirstName: 'Ana',
        patientLastName: 'López',
        ...overrides,
        payments,
      },
    };
    this.orders.push(fake);
    return fake;
  }

  private check(): void {
    if (this.failWith) throw this.failWith;
  }

  private realUsers(tenantId: number): FakeUser[] {
    const result: FakeUser[] = [];
    for (const user of this.users) {
      if (user.tenantId === tenantId && !user.email.endsWith(UNASSIGNED_EMAIL_SUFFIX)) result.push(user);
    }
    return result;
  }

  private toCashier(user: FakeUser): CashierRow {
    return { id: user.id, fullName: user.fullName, role: user.role, branchId: user.branchId };
  }

  async findTenant(tenantId: number): Promise<TenantRow | null> {
    this.check();
    for (const tenant of this.tenants) {
      if (tenant.id === tenantId) return tenant;
    }
    return null;
  }

  async findBranches(tenantId: number): Promise<BranchRow[]> {
    this.check();
    const result: BranchRow[] = [];
    for (const branch of this.branches) {
      if (branch.tenantId === tenantId) result.push(branch);
    }
    result.sort(function porNombre(a, b) {
      return a.name.localeCompare(b.name);
    });
    return result;
  }

  async findBranch(tenantId: number, branchId: number): Promise<BranchRow | null> {
    this.check();
    for (const branch of this.branches) {
      if (branch.id === branchId && branch.tenantId === tenantId) return branch;
    }
    return null;
  }

  async findContextCashiers(tenantId: number): Promise<CashierRow[]> {
    this.check();
    const result: CashierRow[] = [];
    for (const user of this.realUsers(tenantId)) {
      if (user.role === 'admin' || user.role === 'receptionist') result.push(this.toCashier(user));
    }
    result.sort(function porNombre(a, b) {
      return a.fullName.localeCompare(b.fullName);
    });
    return result;
  }

  async findLastCashierPayment(tenantId: number): Promise<LastPayment | null> {
    this.check();
    let last: LastPayment | null = null;
    for (const fake of this.orders) {
      if (fake.tenantId !== tenantId || fake.cashierId === null || fake.order.payments.length === 0) continue;
      if (last === null || fake.paymentCreatedAt.getTime() > last.createdAt.getTime()) {
        last = { cashierId: fake.cashierId, createdAt: fake.paymentCreatedAt };
      }
    }
    return last;
  }

  async findAnyRealUser(tenantId: number): Promise<CashierRow | null> {
    this.check();
    const users = this.realUsers(tenantId);
    if (users.length === 0) return null;
    return this.toCashier(users[0]);
  }

  async findUser(tenantId: number, userId: number): Promise<NamedUser | null> {
    this.check();
    for (const user of this.users) {
      if (user.id === userId && user.tenantId === tenantId) return { id: user.id, fullName: user.fullName };
    }
    return null;
  }

  private findUnassigned(tenantId: number): FakeUser | null {
    for (const user of this.users) {
      if (user.email === `sin-asignar-${tenantId}${UNASSIGNED_EMAIL_SUFFIX}`) return user;
    }
    return null;
  }

  async findUnassignedUserId(tenantId: number): Promise<number | null> {
    this.check();
    const user = this.findUnassigned(tenantId);
    if (!user) return null;
    return user.id;
  }

  async ensureUnassignedUser(tenantId: number): Promise<number> {
    this.check();
    const existing = this.findUnassigned(tenantId);
    if (existing) return existing.id;
    const user: FakeUser = {
      id: this.nextUserId++,
      tenantId,
      fullName: UNASSIGNED_USER_NAME,
      email: `sin-asignar-${tenantId}${UNASSIGNED_EMAIL_SUFFIX}`,
      role: 'receptionist',
      branchId: null,
    };
    this.users.push(user);
    return user.id;
  }

  async findLiveOrders(
    tenantId: number,
    branchId: number,
    cashierId: number | null,
    start: Date,
    end: Date,
  ): Promise<LiveOrder[]> {
    this.check();
    const result: LiveOrder[] = [];
    for (const fake of this.orders) {
      if (fake.tenantId !== tenantId || fake.branchId !== branchId || fake.cashierId !== cashierId) continue;
      const time = fake.order.createdAt.getTime();
      if (time >= start.getTime() && time < end.getTime()) result.push(fake.order);
    }
    result.sort(function porFecha(a, b) {
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
    return result;
  }

  private userName(userId: number | null): NamedUser | null {
    if (userId === null) return null;
    for (const user of this.users) {
      if (user.id === userId) return { id: user.id, fullName: user.fullName };
    }
    return null;
  }

  private findStored(tenantId: number, branchId: number, cashierId: number, cutDate: Date, shift: ShiftValue): FakeCut | null {
    for (const cut of this.cuts) {
      const input = cut.input;
      if (
        input.tenantId === tenantId &&
        input.branchId === branchId &&
        input.cashierId === cashierId &&
        input.shift === shift &&
        input.cutDate.getTime() === cutDate.getTime()
      ) {
        return cut;
      }
    }
    return null;
  }

  async findCut(
    tenantId: number,
    branchId: number,
    cashierId: number,
    cutDate: Date,
    shift: ShiftValue,
  ): Promise<StoredCut | null> {
    this.check();
    const cut = this.findStored(tenantId, branchId, cashierId, cutDate, shift);
    if (!cut) return null;
    const input = cut.input;
    return {
      id: cut.id,
      status: cut.status,
      closedAt: cut.closedAt,
      closedBy: this.userName(input.closedById),
      countedCash: input.countedCash,
      difference: input.difference,
      observation: cut.observation,
      cashTotal: input.summary.cashTotal,
      cardTotal: input.summary.cardTotal,
      transferTotal: input.summary.transferTotal,
      ordersCount: input.summary.ordersCount,
      discountsTotal: input.summary.discountsTotal,
      cancellationsCount: input.summary.cancellationsCount,
      expectedCash: input.summary.expectedCash,
      snapshotJson: input.snapshotJson,
    };
  }

  async saveClosedCut(input: SaveCutInput): Promise<SavedCut> {
    this.check();
    let cut: FakeCut | null = null;
    for (const stored of this.cuts) {
      if (stored.id === input.existingId) cut = stored;
    }
    if (cut) {
      cut.input = input;
      cut.status = 'closed';
      cut.closedAt = input.closedAt;
      cut.observation = input.observation;
    } else {
      cut = { id: this.nextCutId++, input, status: 'closed', closedAt: input.closedAt, observation: input.observation };
      this.cuts.push(cut);
    }
    for (const fake of this.orders) {
      const inScope = fake.tenantId === input.tenantId && fake.branchId === input.branchId;
      if (inScope && input.orderIds.includes(fake.order.id) && fake.cashCutId === null) fake.cashCutId = cut.id;
    }
    return { id: cut.id, status: cut.status, closedAt: cut.closedAt, observation: cut.observation };
  }

  async listCuts(tenantId: number): Promise<HistoryRow[]> {
    this.check();
    const rows: HistoryRow[] = [];
    for (const cut of this.cuts) {
      const input = cut.input;
      if (input.tenantId !== tenantId) continue;
      const branch = { id: input.branchId, name: this.branchName(input.branchId) };
      const cashier = this.userName(input.cashierId) ?? { id: input.cashierId, fullName: '' };
      rows.push({
        id: cut.id,
        branch,
        cashier,
        shift: input.shift,
        cutDate: input.cutDate,
        status: cut.status,
        expectedCash: input.summary.expectedCash,
        countedCash: input.countedCash,
        difference: input.difference,
        observation: cut.observation,
        closedAt: cut.closedAt,
        closedBy: this.userName(input.closedById),
      });
    }
    rows.sort(function recientesPrimero(a, b) {
      return b.cutDate.getTime() - a.cutDate.getTime() || b.id - a.id;
    });
    return rows.slice(0, 50);
  }

  private branchName(branchId: number): string {
    for (const branch of this.branches) {
      if (branch.id === branchId) return branch.name;
    }
    return '';
  }

  async findCutForExport(tenantId: number, cutId: number): Promise<ExportCut | null> {
    this.check();
    for (const cut of this.cuts) {
      if (cut.id !== cutId || cut.input.tenantId !== tenantId) continue;
      const input = cut.input;
      const closedBy = this.userName(input.closedById);
      const cashier = this.userName(input.cashierId);
      return {
        branchName: this.branchName(input.branchId),
        cashierName: cashier ? cashier.fullName : '',
        shift: input.shift,
        cutDate: input.cutDate,
        status: cut.status,
        expectedCash: input.summary.expectedCash,
        countedCash: input.countedCash,
        difference: input.difference,
        observation: cut.observation,
        closedByName: closedBy ? closedBy.fullName : null,
        closedAt: cut.closedAt,
        snapshotJson: input.snapshotJson,
      };
    }
    return null;
  }
}
