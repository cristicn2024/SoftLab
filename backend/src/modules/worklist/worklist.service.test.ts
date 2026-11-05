import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../../common/app-error';
import { CriticalValueError, OrderNotFoundError } from './worklist.errors';
import type { WorklistRepository } from './worklist.repository';
import { WorklistService } from './worklist.service';
import type { OrderRecord, ParameterRecord, RangeRecord, SaveEntry } from './worklist.types';

const TODAY = new Date(2026, 10, 3);

function adultRange(gender: string, low: number, high: number): RangeRecord {
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

function glucose(id: number): ParameterRecord {
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

function order(id: number, gender: string, birthDate: Date): OrderRecord {
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

class FakeRepository implements WorklistRepository {
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

function setup() {
  const repository = new FakeRepository();
  repository.add(1, order(1, 'F', new Date(1988, 0, 15)));
  repository.add(1, order(2, 'M', new Date(2020, 5, 1)));
  repository.add(2, order(3, 'F', new Date(1990, 0, 1)));
  return { repository, service: new WorklistService(repository) };
}

test('la lista trae pendientes con el rango del paciente y avisa los que no tienen', async () => {
  const { service } = setup();
  const worklist = await service.getWorklist(1, TODAY);

  assert.equal(worklist.orders.length, 2);
  assert.equal(worklist.totalPending, 2);
  assert.equal(worklist.withoutRange, 1);

  const woman = worklist.orders[0].pending[0];
  assert.equal(woman.rangeText, '70 – 99');
  assert.equal(woman.previous, '98 (10 oct)');

  const child = worklist.orders[1].pending[0];
  assert.equal(child.rule, null);
  assert.equal(child.rangeText, null);
});

test('un laboratorio solo ve sus propias órdenes', async () => {
  const { service } = setup();
  const second = await service.getWorklist(2, TODAY);
  assert.equal(second.orders.length, 1);
  assert.equal(second.orders[0].orderId, 3);

  const empty = await service.getWorklist(99, TODAY);
  assert.equal(empty.orders.length, 0);
});

test('un laboratorio no puede abrir ni guardar en una orden de otro', async () => {
  const { service, repository } = setup();

  await assert.rejects(service.getOrder(2, 1, TODAY), OrderNotFoundError);
  await assert.rejects(
    service.saveOrderResults(2, 1, [{ orderItemId: 1000, parameterId: 7, value: '90' }], TODAY),
    OrderNotFoundError,
  );
  assert.equal(repository.saves.length, 0);
});

test('los estudios de laboratorio externo y los ya capturados no aparecen', async () => {
  const repository = new FakeRepository();
  const record = order(1, 'F', new Date(1988, 0, 15));
  record.items.push({
    id: 2000,
    testName: 'Cultivo',
    externalLab: 'Lab externo',
    parameters: [glucose(8)],
    capturedParameterIds: [],
  });
  record.items[0].capturedParameterIds = [7];
  repository.add(1, record);

  const worklist = await new WorklistService(repository).getWorklist(1, TODAY);
  assert.equal(worklist.orders.length, 0);

  const detail = await new WorklistService(repository).getOrder(1, 1, TODAY);
  assert.equal(detail.pending.length, 0);
  assert.equal(detail.capturedCount, 1);
});

test('la bandera la calcula el servidor y todo se guarda en una sola operación', async () => {
  const { service, repository } = setup();
  const saved = await service.saveOrderResults(1, 1, [{ orderItemId: 1000, parameterId: 7, value: '120' }], TODAY);

  assert.equal(saved[0].flag, 'H');
  assert.equal(repository.saves.length, 1);
  assert.equal(repository.saves[0].tenantId, 1);
  assert.equal(repository.saves[0].entries[0].flag, 'H');
});

test('un resultado sin rango se guarda sin interpretación', async () => {
  const { service } = setup();
  const saved = await service.saveOrderResults(1, 2, [{ orderItemId: 2000, parameterId: 7, value: '85' }], TODAY);
  assert.equal(saved[0].flag, '—');
});

test('un valor crítico no se guarda y no se guarda nada de la captura', async () => {
  const { service, repository } = setup();
  await assert.rejects(
    service.saveOrderResults(1, 1, [{ orderItemId: 1000, parameterId: 7, value: '600' }], TODAY),
    CriticalValueError,
  );
  assert.equal(repository.saves.length, 0);
});

test('rechaza captura vacía, texto en estudio numérico, parámetros ajenos y repetidos', async () => {
  const { service, repository } = setup();

  await assert.rejects(service.saveOrderResults(1, 1, [], TODAY), AppError);
  await assert.rejects(
    service.saveOrderResults(1, 1, [{ orderItemId: 1000, parameterId: 7, value: 'alto' }], TODAY),
    AppError,
  );
  await assert.rejects(
    service.saveOrderResults(1, 1, [{ orderItemId: 1000, parameterId: 999, value: '90' }], TODAY),
    AppError,
  );
  await assert.rejects(
    service.saveOrderResults(
      1,
      1,
      [
        { orderItemId: 1000, parameterId: 7, value: '90' },
        { orderItemId: 1000, parameterId: 7, value: '91' },
      ],
      TODAY,
    ),
    AppError,
  );
  assert.equal(repository.saves.length, 0);
});
