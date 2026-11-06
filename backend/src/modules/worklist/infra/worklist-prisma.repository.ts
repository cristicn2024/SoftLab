import { Injectable } from '@nestjs/common';
import type { Prisma, ReferenceRange, SampleStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ResultAlreadyCapturedError } from '../dominio/worklist.errors';
import type { WorklistRepository } from '../dominio/worklist.repository';
import type {
  ItemRecord,
  OrderRecord,
  ParameterRecord,
  RangeRecord,
  SampleRecord,
  SaveEntry,
} from '../dominio/worklist.types';

const READY_SAMPLE_STATUSES: SampleStatus[] = ['received'];

const ORDER_INCLUDE = {
  patient: true,
  samples: { where: { status: { in: READY_SAMPLE_STATUSES } } },
  items: {
    include: {
      test: {
        include: {
          parameters: { include: { ranges: true }, orderBy: { sortOrder: 'asc' } },
        },
      },
      testResults: true,
    },
  },
} satisfies Prisma.OrderInclude;

type OrderRow = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

type DecimalLike = { toNumber(): number } | null;

function toNumber(value: DecimalLike): number | null {
  if (value === null) {
    return null;
  }
  return value.toNumber();
}

function toRangeRecord(range: ReferenceRange): RangeRecord {
  return {
    gender: range.gender,
    minAgeYears: range.minAgeYears,
    maxAgeYears: range.maxAgeYears,
    low: toNumber(range.low),
    high: toNumber(range.high),
    lowInclusive: range.lowInclusive,
    highInclusive: range.highInclusive,
    criticalLow: toNumber(range.criticalLow),
    criticalHigh: toNumber(range.criticalHigh),
    criticalLowInclusive: range.criticalLowInclusive,
    criticalHighInclusive: range.criticalHighInclusive,
    display: range.display,
  };
}

function toOrderRecord(row: OrderRow): OrderRecord {
  const samples: SampleRecord[] = [];
  for (const sample of row.samples) {
    samples.push({
      id: sample.id,
      barcode: sample.barcode,
      description: sample.sampleDescription,
      equipment: sample.equipment,
      capturedByName: sample.capturedByName,
      receivedAt: sample.receivedAt,
    });
  }

  const items: ItemRecord[] = [];
  for (const item of row.items) {
    if (!item.test) {
      continue;
    }

    const parameters: ParameterRecord[] = [];
    for (const parameter of item.test.parameters) {
      const ranges: RangeRecord[] = [];
      for (const range of parameter.ranges) {
        ranges.push(toRangeRecord(range));
      }
      parameters.push({
        id: parameter.id,
        name: parameter.name,
        unit: parameter.unit,
        qualitativeExpected: parameter.qualitativeExpected,
        previousValue: parameter.previousValue,
        previousDate: parameter.previousDate,
        ranges,
      });
    }

    const capturedParameterIds: number[] = [];
    for (const result of item.testResults) {
      if (result.parameterId !== null) {
        capturedParameterIds.push(result.parameterId);
      }
    }

    items.push({
      id: item.id,
      testName: item.test.name,
      externalLab: item.test.externalLab,
      parameters,
      capturedParameterIds,
    });
  }

  return {
    id: row.id,
    folio: row.folio,
    patient: {
      id: row.patient.id,
      firstName: row.patient.firstName,
      lastName: row.patient.lastName,
      patientCode: row.patient.patientCode,
      gender: row.patient.gender,
      birthDate: row.patient.birthDate,
    },
    samples,
    items,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
}

@Injectable()
export class WorklistPrismaRepository implements WorklistRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findReadyOrders(tenantId: number): Promise<OrderRecord[]> {
    const rows = await this.prisma.order.findMany({
      where: { tenantId, samples: { some: { status: { in: READY_SAMPLE_STATUSES } } } },
      orderBy: { createdAt: 'asc' },
      include: ORDER_INCLUDE,
    });

    const records: OrderRecord[] = [];
    for (const row of rows) {
      records.push(toOrderRecord(row));
    }
    return records;
  }

  async findReadyOrder(tenantId: number, orderId: number): Promise<OrderRecord | null> {
    const row = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId, samples: { some: { status: { in: READY_SAMPLE_STATUSES } } } },
      include: ORDER_INCLUDE,
    });

    if (row === null) {
      return null;
    }
    return toOrderRecord(row);
  }

  async saveResults(tenantId: number, entries: SaveEntry[]): Promise<void> {
    const operations: Prisma.PrismaPromise<unknown>[] = [];
    for (const entry of entries) {
      operations.push(
        this.prisma.testResult.create({
          data: {
            tenantId,
            orderItemId: entry.orderItemId,
            parameterId: entry.parameterId,
            resultValue: entry.value,
            flag: entry.flag,
            isAlert: entry.flag !== 'Normal' && entry.flag !== '—',
          },
        }),
      );
    }

    try {
      await this.prisma.$transaction(operations);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ResultAlreadyCapturedError();
      }
      throw error;
    }
  }
}
