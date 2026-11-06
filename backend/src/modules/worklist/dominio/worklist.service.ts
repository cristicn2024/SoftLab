import {
  CriticalValueError,
  EmptyCaptureError,
  InvalidResultError,
  OrderNotFoundError,
  ParameterNotPendingError,
} from './worklist.errors';
import type { WorklistRepository } from './worklist.repository';
import {
  buildFolio,
  buildRule,
  calculateAge,
  describePrevious,
  describeRange,
  interpretValue,
  pickRange,
  prepareValue,
} from './worklist.rules';
import type {
  OrderRecord,
  PendingParameter,
  ResultEntry,
  SaveEntry,
  SavedResult,
  Worklist,
  WorklistOrder,
} from './worklist.types';

function hasResult(capturedParameterIds: number[], parameterId: number): boolean {
  return capturedParameterIds.includes(parameterId);
}

function buildOrder(record: OrderRecord, today: Date): WorklistOrder {
  const ageYears = calculateAge(record.patient.birthDate, today);
  const pending: PendingParameter[] = [];
  let capturedCount = 0;

  for (const item of record.items) {
    capturedCount = capturedCount + item.capturedParameterIds.length;
    if (item.externalLab !== null) {
      continue;
    }

    for (const parameter of item.parameters) {
      if (hasResult(item.capturedParameterIds, parameter.id)) {
        continue;
      }

      const range = pickRange(parameter.ranges, record.patient.gender, ageYears);
      pending.push({
        orderItemId: item.id,
        parameterId: parameter.id,
        testName: item.testName,
        parameterName: parameter.name,
        unit: parameter.unit,
        rangeText: describeRange(range, parameter.qualitativeExpected),
        previous: describePrevious(parameter.previousValue, parameter.previousDate),
        rule: buildRule(range, parameter.qualitativeExpected),
      });
    }
  }

  const samples: WorklistOrder['samples'] = [];
  let receivedAt: Date | null = null;
  for (const sample of record.samples) {
    samples.push({
      id: sample.id,
      barcode: sample.barcode,
      description: sample.description,
      equipment: sample.equipment,
      capturedByName: sample.capturedByName,
    });
    if (sample.receivedAt !== null && (receivedAt === null || sample.receivedAt < receivedAt)) {
      receivedAt = sample.receivedAt;
    }
  }

  return {
    orderId: record.id,
    folio: buildFolio(record.folio, record.id),
    receivedAt,
    capturedCount,
    samples,
    patient: {
      id: record.patient.id,
      fullName: `${record.patient.firstName} ${record.patient.lastName}`,
      patientCode: record.patient.patientCode,
      gender: record.patient.gender,
      ageYears,
    },
    pending,
  };
}

function findPending(pending: PendingParameter[], entry: ResultEntry): PendingParameter | null {
  for (const parameter of pending) {
    if (parameter.orderItemId === entry.orderItemId && parameter.parameterId === entry.parameterId) {
      return parameter;
    }
  }
  return null;
}

function isRepeated(entries: ResultEntry[], index: number): boolean {
  const current = entries[index];
  for (let before = 0; before < index; before++) {
    if (entries[before].orderItemId === current.orderItemId && entries[before].parameterId === current.parameterId) {
      return true;
    }
  }
  return false;
}

export class WorklistService {
  constructor(private readonly repository: WorklistRepository) {}

  async getWorklist(tenantId: number, today: Date = new Date()): Promise<Worklist> {
    const records = await this.repository.findReadyOrders(tenantId);
    const worklist: Worklist = { totalPending: 0, withoutRange: 0, orders: [] };

    for (const record of records) {
      const order = buildOrder(record, today);
      if (order.pending.length === 0) {
        continue;
      }

      for (const parameter of order.pending) {
        worklist.totalPending = worklist.totalPending + 1;
        if (parameter.rule === null) {
          worklist.withoutRange = worklist.withoutRange + 1;
        }
      }
      worklist.orders.push(order);
    }

    return worklist;
  }

  async getOrder(tenantId: number, orderId: number, today: Date = new Date()): Promise<WorklistOrder> {
    const record = await this.repository.findReadyOrder(tenantId, orderId);
    if (record === null) {
      throw new OrderNotFoundError(orderId);
    }
    return buildOrder(record, today);
  }

  async saveOrderResults(
    tenantId: number,
    orderId: number,
    entries: ResultEntry[],
    today: Date = new Date(),
  ): Promise<SavedResult[]> {
    if (entries.length === 0) {
      throw new EmptyCaptureError();
    }

    const order = await this.getOrder(tenantId, orderId, today);
    const toSave: SaveEntry[] = [];

    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index];
      const parameter = findPending(order.pending, entry);
      if (parameter === null) {
        throw new ParameterNotPendingError(entry.parameterId);
      }
      if (isRepeated(entries, index)) {
        throw new InvalidResultError(parameter.parameterName, 'viene repetido en la captura.');
      }

      const prepared = prepareValue(entry.value, parameter.rule);
      if (!prepared.ok) {
        throw new InvalidResultError(parameter.parameterName, prepared.message);
      }

      const flag = interpretValue(prepared.value, parameter.rule);
      if (flag === 'HH' || flag === 'LL') {
        throw new CriticalValueError(parameter.parameterName, flag);
      }

      toSave.push({
        orderItemId: parameter.orderItemId,
        parameterId: parameter.parameterId,
        value: prepared.value,
        flag,
      });
    }

    await this.repository.saveResults(tenantId, toSave);

    const saved: SavedResult[] = [];
    for (const entry of toSave) {
      saved.push({ orderItemId: entry.orderItemId, parameterId: entry.parameterId, value: entry.value, flag: entry.flag });
    }
    return saved;
  }
}
