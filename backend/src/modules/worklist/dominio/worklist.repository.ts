import type { OrderRecord, SaveEntry } from './worklist.types';

export interface WorklistRepository {
  findReadyOrders(tenantId: number, branchId?: number): Promise<OrderRecord[]>;
  findReadyOrder(tenantId: number, orderId: number): Promise<OrderRecord | null>;
  saveResults(tenantId: number, entries: SaveEntry[], userId?: number | null): Promise<void>;
}
