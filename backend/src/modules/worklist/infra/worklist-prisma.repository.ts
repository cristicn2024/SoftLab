import { selectReference, type ReferenceRule } from '../../referencias/referencias.rules';
import { ConflictException, Injectable } from '@nestjs/common';
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

  async findReadyOrders(tenantId: number, branchId?: number): Promise<OrderRecord[]> {
    const rows = await this.prisma.order.findMany({
      where: { tenantId, branchId, samples: { some: { status: { in: READY_SAMPLE_STATUSES } } } },
      orderBy: { createdAt: 'asc' },
      include: ORDER_INCLUDE,
    });

    const records: OrderRecord[] = [];
    for (const row of rows) {
      records.push(await this.withReferences(row));
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
    return this.withReferences(row);
  }

  private async withReferences(row: OrderRow): Promise<OrderRecord> {
    const record = toOrderRecord(row);
    const at = row.processedAt ?? new Date();
    record.processedAt = at;
    const condition=row.processedAt ? row.referenceCondition ?? '' : row.patient.specialCondition ?? '';
    const weeks=row.processedAt ? row.referenceWeeks : row.patient.pregnancyWeeks;
    record.referenceContext={processedAt:row.processedAt,condition,weeks};
    const versions = await this.prisma.referenceVersion.findMany({where:{tenantId:row.tenantId,effectiveFrom:{lte:at}},orderBy:{effectiveFrom:'desc'}});
    for (const item of record.items) for (const parameter of item.parameters) {
      const version=versions.find(v=>v.parameterId===parameter.id);
      if (!version) continue;
      const r=selectReference(version.rules as unknown as ReferenceRule[],row.patient.birthDate,at,row.patient.gender,condition,weeks);
      parameter.qualitativeExpected=null;
      parameter.ranges=r?[{gender:null,minAgeYears:null,maxAgeYears:null,low:r.low,high:r.high,criticalLow:r.criticalLow,criticalHigh:r.criticalHigh,lowInclusive:true,highInclusive:true,criticalLowInclusive:false,criticalHighInclusive:false,display:r.display,unit:r.unit,type:r.type,expected:r.expected,versionId:version.id,method:r.method}]:[];
    }
    return record;
  }

  async saveResults(tenantId: number, entries: SaveEntry[], userId: number | null = null): Promise<void> {
    try {
      await this.prisma.$transaction(async tx => {
        const items = await tx.orderItem.findMany({where:{id:{in:entries.map(e=>e.orderItemId)},order:{tenantId}},select:{id:true,orderId:true}});
        const branchByOrder = new Map<number, number>();
        for (const orderId of [...new Set(items.map(i=>i.orderId))].sort((a,b)=>a-b)) {
          await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} AND tenant_id = ${tenantId} FOR UPDATE`;
          const order = await tx.order.findFirst({where:{id:orderId,tenantId}});
          if(order) branchByOrder.set(orderId, order.branchId);
          if(!order || order.resultsDeliveredAt || await tx.orderReport.count({where:{orderId,tenantId}})) throw new ConflictException('No se pueden cambiar resultados de un informe emitido');
          const entry=entries.find(e=>items.some(i=>i.id===e.orderItemId&&i.orderId===orderId))!;
          const snapshot=entry.referenceSnapshot ? JSON.parse(entry.referenceSnapshot) : null;
          if(snapshot && order.processedAt && (order.processedAt.toISOString()!==snapshot.processedAt || (order.referenceCondition??'')!==snapshot.condition || order.referenceWeeks!==snapshot.weeks)) throw new ConflictException('El contexto cambió. Recarga la orden antes de guardar');
          if(snapshot && !order.processedAt) await tx.order.update({where:{id:orderId},data:{processedAt:new Date(snapshot.processedAt),referenceCondition:snapshot.condition,referenceWeeks:snapshot.weeks}});
        }
        for (const entry of entries) {
          const result = await tx.testResult.create({data:{tenantId,orderItemId:entry.orderItemId,parameterId:entry.parameterId,resultValue:entry.value,flag:entry.flag,referenceSnapshot:entry.referenceSnapshot,isAlert:entry.flag!=='Normal'&&entry.flag!=='—'}});
          if (entry.notification) {
            // HU 6.2 CA5: queda registrado a quién, cuándo y por qué medio se avisó del valor crítico.
            const orderId = items.find(i=>i.id===entry.orderItemId)!.orderId;
            await tx.criticalNotification.create({data:{tenantId,resultId:result.id,userId,branchId:branchByOrder.get(orderId)!,recipient:entry.notification.recipient,recipientName:entry.notification.recipientName,contactMethod:entry.notification.contactMethod,notifiedAt:entry.notification.notifiedAt}});
          }
        }
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ResultAlreadyCapturedError();
      throw error;
    }
  }
}
