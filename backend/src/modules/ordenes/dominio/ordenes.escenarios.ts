import type { OrdenesRepository } from './ordenes.repository';
import type {
  CatalogProfile,
  CatalogTest,
  Doctor,
  NewDoctorData,
  NewOrderData,
} from './ordenes.types';

export interface StoredOrder {
  id: number;
  data: NewOrderData;
  status: string;
  createdAt: Date;
}

export function catalogTest(id: number, overrides: Partial<CatalogTest> = {}): CatalogTest {
  return { id, code: `T-${id}`, name: `Estudio ${id}`, price: 100, genderRestriction: null, ...overrides };
}

export function catalogProfile(id: number, includedTestIds: number[], overrides: Partial<CatalogProfile> = {}): CatalogProfile {
  return { id, code: `P-${id}`, name: `Perfil ${id}`, price: 300, includedTestIds, ...overrides };
}

export class FakeRepository implements OrdenesRepository {
  readonly orders: StoredOrder[] = [];
  readonly doctors: Doctor[] = [];
  failWith: Error | null = null;
  private readonly tests: { tenantId: number; test: CatalogTest }[] = [];
  private readonly profiles: { tenantId: number; profile: CatalogProfile; active: boolean }[] = [];
  private nextOrderId = 1;
  private nextDoctorId = 1;

  addTest(tenantId: number, test: CatalogTest): void {
    this.tests.push({ tenantId, test });
  }

  addProfile(tenantId: number, profile: CatalogProfile, active = true): void {
    this.profiles.push({ tenantId, profile, active });
  }

  addOrder(tenantId: number, patientId: number, status: string, createdAt: Date): StoredOrder {
    const order: StoredOrder = {
      id: this.nextOrderId++,
      data: { tenantId, branchId: 1, patientId, doctorId: null, totalAmount: 0, items: [] },
      status,
      createdAt,
    };
    this.orders.push(order);
    return order;
  }

  private check(): void {
    if (this.failWith) throw this.failWith;
  }

  async findTests(tenantId: number, query: string, limit: number): Promise<CatalogTest[]> {
    this.check();
    const found: CatalogTest[] = [];
    for (const row of this.tests) {
      if (row.tenantId !== tenantId) continue;
      if (row.test.code.includes(query) || row.test.name.includes(query)) found.push(row.test);
    }
    return found.slice(0, limit);
  }

  async findActiveProfiles(tenantId: number, query: string, limit: number): Promise<CatalogProfile[]> {
    this.check();
    const found: CatalogProfile[] = [];
    for (const row of this.profiles) {
      if (row.tenantId !== tenantId || !row.active) continue;
      if (row.profile.code.includes(query) || row.profile.name.includes(query)) found.push(row.profile);
    }
    return found.slice(0, limit);
  }

  async findPendingOrderSince(tenantId: number, patientId: number, since: Date): Promise<{ id: number } | null> {
    this.check();
    for (const order of this.orders) {
      const same = order.data.tenantId === tenantId && order.data.patientId === patientId;
      if (same && order.status === 'pending' && order.createdAt >= since) return { id: order.id };
    }
    return null;
  }

  async createDoctor(data: NewDoctorData): Promise<Doctor> {
    this.check();
    const doctor: Doctor = {
      id: this.nextDoctorId++,
      tenantId: data.tenantId,
      name: data.name,
      cedula: data.cedula ?? null,
      specialty: data.specialty ?? null,
      phone: null,
      email: null,
      createdAt: new Date(2026, 10, 3, 9, 0),
    };
    this.doctors.push(doctor);
    return doctor;
  }

  async countOrdersSince(tenantId: number, since: Date): Promise<number> {
    this.check();
    let count = 0;
    for (const order of this.orders) {
      if (order.data.tenantId === tenantId && order.createdAt >= since) count++;
    }
    return count;
  }

  async createOrder(data: NewOrderData): Promise<{ id: number }> {
    this.check();
    for (const item of data.items) {
      if (Number.isNaN(item.price) || Number.isNaN(item.testId) || Number.isNaN(item.profileId)) {
        throw new Error('Argument items: Invalid value provided. Expected Int, provided NaN');
      }
    }
    if (Number.isNaN(data.doctorId) || Number.isNaN(data.totalAmount)) {
      throw new Error('Invalid value provided');
    }
    const order: StoredOrder = { id: this.nextOrderId++, data, status: 'pending', createdAt: new Date() };
    this.orders.push(order);
    return { id: order.id };
  }
}
