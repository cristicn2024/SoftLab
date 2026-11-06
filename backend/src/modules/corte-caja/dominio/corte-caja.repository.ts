import type {
  BranchRow,
  CashierRow,
  ExportCut,
  HistoryRow,
  LiveOrder,
  LastPayment,
  NamedUser,
  SaveCutInput,
  SavedCut,
  ShiftValue,
  StoredCut,
  TenantRow,
} from './corte-caja.types';

export interface CorteCajaRepository {
  findTenant(tenantId: number): Promise<TenantRow | null>;
  findBranches(tenantId: number): Promise<BranchRow[]>;
  findBranch(tenantId: number, branchId: number): Promise<BranchRow | null>;
  findContextCashiers(tenantId: number): Promise<CashierRow[]>;
  findLastCashierPayment(tenantId: number): Promise<LastPayment | null>;
  findAnyRealUser(tenantId: number): Promise<CashierRow | null>;
  findUser(tenantId: number, userId: number): Promise<NamedUser | null>;
  findUnassignedUserId(tenantId: number): Promise<number | null>;
  ensureUnassignedUser(tenantId: number): Promise<number>;
  findLiveOrders(tenantId: number, branchId: number, cashierId: number | null, start: Date, end: Date): Promise<LiveOrder[]>;
  findCut(tenantId: number, branchId: number, cashierId: number, cutDate: Date, shift: ShiftValue): Promise<StoredCut | null>;
  saveClosedCut(input: SaveCutInput): Promise<SavedCut>;
  listCuts(tenantId: number): Promise<HistoryRow[]>;
  findCutForExport(tenantId: number, cutId: number): Promise<ExportCut | null>;
}
