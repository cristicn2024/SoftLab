import type { OrderRecord, SaveEntry } from './worklist.types';

export interface WorklistRepository {
  findReadyOrders(tenantId: number): Promise<OrderRecord[]>;
  findReadyOrder(tenantId: number, orderId: number): Promise<OrderRecord | null>;
  saveResults(tenantId: number, entries: SaveEntry[]): Promise<void>;
}
