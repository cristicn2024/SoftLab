import type {
  CatalogProfile,
  CatalogTest,
  Doctor,
  NewDoctorData,
  NewOrderData,
} from './ordenes.types';

export interface OrdenesRepository {
  findTests(tenantId: number, query: string, limit: number): Promise<CatalogTest[]>;
  findActiveProfiles(tenantId: number, query: string, limit: number): Promise<CatalogProfile[]>;
  findPendingOrderSince(tenantId: number, patientId: number, since: Date, branchId?: number): Promise<{ id: number } | null>;
  createDoctor(data: NewDoctorData): Promise<Doctor>;
  findDoctors(tenantId: number): Promise<Doctor[]>;
  countOrdersSince(tenantId: number, since: Date): Promise<number>;
  countFoliosWithPrefix(prefix: string): Promise<number>;
  /** Lanza DuplicateFolioError si el folio ya existe (el folio es único en toda la base). */
  createOrder(data: NewOrderData): Promise<{ id: number; shipmentFolios?: string[] }>;
}
