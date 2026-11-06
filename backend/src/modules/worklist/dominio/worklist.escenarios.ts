import type { WorklistRepository } from './worklist.repository';
import type { OrderRecord, ParameterRecord, RangeRecord, SaveEntry } from './worklist.types';

export function adultRange(gender: string, low: number, high: number): RangeRecord {
  return {
    gender,
    minAgeYears: 18,
    maxAgeYears: 120,
    low,
    high,
    lowInclusive: true,
    highInclusive: true,
    criticalLow: 40,
    criticalHigh: 500,
    criticalLowInclusive: false,
    criticalHighInclusive: false,
    display: `${low} – ${high}`,
  };
}

export function glucose(id: number): ParameterRecord {
  return {
    id,
    name: 'Glucosa en ayuno',
    unit: 'mg/dL',
    qualitativeExpected: null,
    previousValue: '98',
    previousDate: '10 oct',
    ranges: [adultRange('F', 70, 99), adultRange('M', 70, 99)],
  };
}

export function order(id: number, gender: string, birthDate: Date): OrderRecord {
  return {
    id,
    folio: `SL-${id}`,
    patient: { id: id * 10, firstName: 'Paciente', lastName: `Orden ${id}`, patientCode: `P-${id}`, gender, birthDate },
    samples: [
      {
        id: id * 100,
        barcode: `BC-${id}`,
        description: 'Suero · tubo amarillo',
        equipment: 'AQ-2',
        capturedByName: 'Andrea Ruiz',
        receivedAt: new Date(2026, 10, 3, 9, 58),
      },
    ],
    items: [
      {
        id: id * 1000,
        testName: 'Glucosa en ayuno',
        externalLab: null,
        parameters: [glucose(7)],
        capturedParameterIds: [],
      },
    ],
  };
}

export class FakeRepository implements WorklistRepository {
  readonly saves: { tenantId: number; entries: SaveEntry[] }[] = [];
  private readonly byTenant = new Map<number, OrderRecord[]>();

  add(tenantId: number, record: OrderRecord) {
    const list = this.byTenant.get(tenantId) ?? [];
    list.push(record);
    this.byTenant.set(tenantId, list);
  }

  async findReadyOrders(tenantId: number): Promise<OrderRecord[]> {
    return this.byTenant.get(tenantId) ?? [];
  }

  async findReadyOrder(tenantId: number, orderId: number): Promise<OrderRecord | null> {
    for (const record of this.byTenant.get(tenantId) ?? []) {
      if (record.id === orderId) {
        return record;
      }
    }
    return null;
  }

  async saveResults(tenantId: number, entries: SaveEntry[]): Promise<void> {
    this.saves.push({ tenantId, entries });
  }
}
