import type { OrderRecord, SaveEntry } from './worklist.types';

export interface WorklistRepository {
  findReadyOrders(tenantId: number, branchIds?: number[] | null): Promise<OrderRecord[]>;
  findReadyOrder(tenantId: number, orderId: number, branchIds?: number[] | null): Promise<OrderRecord | null>;
  saveResults(tenantId: number, entries: SaveEntry[], userId?: number | null): Promise<void>;
}
