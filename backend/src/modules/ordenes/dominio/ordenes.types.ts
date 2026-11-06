export type ConceptType = 'TEST' | 'PROFILE';

export interface CatalogTest {
  id: number;
  code: string;
  name: string;
  price: number;
  genderRestriction: string | null;
}

export interface CatalogProfile {
  id: number;
  code: string;
  name: string;
  price: number;
  includedTestIds: number[];
}

export interface Concept {
  id: number;
  type: ConceptType;
  code: string;
  name: string;
  price: number;
  genderRestriction: string;
  includedTestIds: number[];
}

export interface OpenOrderStatus {
  hasOpenOrder: boolean;
  orderId: number | null;
}

export interface NewDoctorData {
  tenantId: number;
  name: string;
  cedula?: string | null;
  specialty?: string | null;
}

export interface Doctor {
  id: number;
  tenantId: number;
  name: string;
  cedula: string | null;
  specialty: string | null;
  phone: string | null;
  email: string | null;
  createdAt: Date;
}

export interface NewOrderItem {
  price: number;
  testId?: number;
  profileId?: number;
}

export interface NewOrderData {
  tenantId: number;
  branchId: number;
  patientId: number;
  doctorId: number | null;
  totalAmount: number;
  folio: string;
  items: NewOrderItem[];
}

export interface RawOrderInput {
  patientId?: unknown;
  branchId?: unknown;
  doctorId?: unknown;
  items?: unknown;
  totalAmount?: unknown;
}

export interface CreatedOrder {
  success: true;
  folio: string;
  orderId: number;
}
