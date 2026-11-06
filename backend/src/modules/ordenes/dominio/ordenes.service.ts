import { ErrorDeDominio } from '../../../comun/errores';
import {
  BranchRequiredError,
  ConceptSearchFailedError,
  DoctorRegistrationFailedError,
  DuplicateFolioError,
  OpenOrderLookupFailedError,
  OrderConfirmationFailedError,
  PatientRequiredError,
} from './ordenes.errors';
import type { OrdenesRepository } from './ordenes.repository';
import {
  buildConcepts,
  buildFolio,
  buildFolioPrefix,
  buildOrderItems,
  normalizeQuery,
  parseOpenOrderPatientId,
  startOfDay,
} from './ordenes.rules';
import type {
  Concept,
  CreatedOrder,
  Doctor,
  NewDoctorData,
  OpenOrderStatus,
  RawOrderInput,
} from './ordenes.types';

const TESTS_LIMIT = 10;
const PROFILES_LIMIT = 5;
const FOLIO_ATTEMPTS = 5;

export class OrdenesService {
  constructor(private readonly repository: OrdenesRepository) {}

  async searchConcepts(tenantId: number, rawQuery: unknown): Promise<Concept[]> {
    const query = normalizeQuery(rawQuery);
    if (!query) return [];

    try {
      const tests = await this.repository.findTests(tenantId, query, TESTS_LIMIT);
      const profiles = await this.repository.findActiveProfiles(tenantId, query, PROFILES_LIMIT);
      return buildConcepts(tests, profiles);
    } catch (error) {
      if (error instanceof ErrorDeDominio) throw error;
      console.error('Error en searchConcepts:', error);
      throw new ConceptSearchFailedError();
    }
  }

  async checkOpenOrder(tenantId: number, rawPatientId: unknown, now: Date): Promise<OpenOrderStatus> {
    const patientId = parseOpenOrderPatientId(rawPatientId);
    if (patientId === null) return { hasOpenOrder: false, orderId: null };

    try {
      const openOrder = await this.repository.findPendingOrderSince(tenantId, patientId, startOfDay(now));
      if (!openOrder) return { hasOpenOrder: false, orderId: null };
      return { hasOpenOrder: true, orderId: openOrder.id || null };
    } catch (error) {
      if (error instanceof ErrorDeDominio) throw error;
      console.error('Error en checkOpenOrderToday:', error);
      throw new OpenOrderLookupFailedError();
    }
  }

  async registerDoctor(data: NewDoctorData): Promise<Doctor> {
    try {
      return await this.repository.createDoctor(data);
    } catch (error) {
      if (error instanceof ErrorDeDominio) throw error;
      console.error('Error en createDoctorExpress:', error);
      throw new DoctorRegistrationFailedError();
    }
  }

  async createOrder(tenantId: number, input: RawOrderInput, now: Date): Promise<CreatedOrder> {
    const patientId = Number(input.patientId);
    const branchId = Number(input.branchId);
    const doctorId = input.doctorId ? Number(input.doctorId) : null;

    if (!patientId) throw new PatientRequiredError();
    if (!branchId) throw new BranchRequiredError();

    try {
      const countToday = await this.repository.countOrdersSince(tenantId, startOfDay(now));
      let folio = buildFolio(now, countToday);
      const items = buildOrderItems(input.items);
      const totalAmount = input.totalAmount ? Number(input.totalAmount) : 0;

      for (let attempt = 1; attempt <= FOLIO_ATTEMPTS; attempt++) {
        try {
          const created = await this.repository.createOrder({
            tenantId,
            branchId,
            patientId,
            doctorId,
            totalAmount,
            folio,
            items,
          });
          return { success: true, folio, orderId: created.id };
        } catch (error) {
          if (!(error instanceof DuplicateFolioError)) throw error;
          // El folio es único en toda la base: si ya lo tomó otra orden (otra sucursal,
          // otro laboratorio o una captura simultánea), se recalcula con el total del día.
          const takenToday = await this.repository.countFoliosWithPrefix(buildFolioPrefix(now));
          folio = buildFolio(now, takenToday + attempt - 1);
        }
      }
      throw new OrderConfirmationFailedError();
    } catch (error) {
      if (error instanceof ErrorDeDominio) throw error;
      console.error('Error en createOrder:', error);
      throw new OrderConfirmationFailedError();
    }
  }
}
