import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorklistPrismaRepository } from '../worklist/infra/worklist-prisma.repository';
import { ReportesPrismaRepository } from '../reportes/infra/reportes-prisma.repository';
import { ReportesService, buildPdfData } from '../reportes/dominio/reportes.service';
import { FakeRepository, FakeRenderer, releaseOrder, TEMPLATE } from '../reportes/dominio/reportes.escenarios';

const rule = { type: 'numeric', gender: 'F', ageUnit: 'years', minAge: 0, maxAge: null, condition: 'embarazo', minWeeks: 0, maxWeeks: 43, low: 3.5, high: 5, criticalLow: 2, criticalHigh: 7, expected: null, display: '3.5 - 5', unit: 'mmol/L', method: 'Método A' };

test('selección histórica utiliza fecha de procesamiento, condición y semanas de la orden', async () => {
  const at = new Date('2026-01-15T12:00:00Z');
  let query: any;
  const row: any = { tenantId: 1, processedAt: at, referenceCondition: 'embarazo', referenceWeeks: 20, id: 9, folio: 'QA', patient: { id: 1, firstName: 'A', lastName: 'B', birthDate: new Date('1990-01-01'), gender: 'F', specialCondition: '', pregnancyWeeks: null }, samples: [], items: [{ id: 2, test: { name: 'QA', externalLab: null, parameters: [{ id: 7, name: 'QA', unit: null, qualitativeExpected: null, previousValue: null, previousDate: null, ranges: [] }] }, testResults: [] }] };
  const repo = new WorklistPrismaRepository({ order: { findFirst: async () => row }, referenceVersion: { findMany: async (q: any) => { query = q; return [{ id: 1, parameterId: 7, rules: [rule] }]; } } } as never);
  const result = await repo.findReadyOrder(1, 9);
  assert.equal(query.where.effectiveFrom.lte.toISOString(), at.toISOString());
  assert.equal(result?.items[0].parameters[0].ranges[0].unit, 'mmol/L');
  assert.equal(result?.items[0].parameters[0].ranges[0].versionId, 1);
  row.referenceWeeks = 44;
  assert.equal((await repo.findReadyOrder(1, 9))?.items[0].parameters[0].ranges.length, 0);
});

test('informe conserva todos los parámetros, unidades y referencias capturadas', async () => {
  const order: any = { id: 1, createdAt: new Date(), tenant: { name: 'QA', subdomain: 'qa' }, patient: { id: 1, firstName: 'A', lastName: 'B', birthDate: new Date('1990-01-01'), gender: 'F' }, items: [{ test: { name: 'Panel', referenceRange: 'RANGO MODIFICADO' }, testResults: [
    { parameter: { name: 'Sodio', unit: 'UNIDAD MODIFICADA' }, resultValue: '135', flag: 'L', isAlert: true, referenceSnapshot: JSON.stringify({ display: '136 - 145', unit: 'mmol/L' }) },
    { parameter: { name: 'Observación' }, resultValue: 'Sin hallazgos', flag: '—', isAlert: false, referenceSnapshot: JSON.stringify({ display: 'Texto libre', unit: '' }) },
  ] }] };
  const tx = { $queryRaw: async () => [], order: { findFirst: async () => order } };
  const repo = new ReportesPrismaRepository({ $transaction: async (fn: any) => fn(tx) } as never);
  const report = await repo.transaction(1, 1, u => u.findReportOrder()); assert.ok(report);
  const pdf = buildPdfData(report, TEMPLATE, 'qa', new Date());
  const items = pdf.resultsByArea[0].items;
  assert.equal(items.length, 2); assert.equal(items[0].testName, 'Panel · Sodio');
  assert.equal(items[0].units, 'mmol/L'); assert.equal(items[0].referenceRange, '136 - 145'); assert.equal(items[0].flag, 'LOW');
  assert.equal(items[1].units, ''); assert.equal(items[1].resultValue, 'Sin hallazgos');
});

test('volver a descargar conserva los bytes emitidos aunque cambien plantilla y rangos', async () => {
  const repo = new FakeRepository(); repo.add(1, releaseOrder(1, { payments: [{ amount: 100, cancelled: false }] }));
  const renderer = new FakeRenderer();
  renderer.render = async data => { renderer.received.push(data); return Buffer.from(JSON.stringify(data)); };
  const service = new ReportesService(repo, renderer);
  const actor = { tenantId: 1, name: 'QA', isAdmin: true };
  const first = await service.release(actor, 1, 'counter', undefined, new Date('2026-01-15'));
  const stored = repo.stored(1, 1)!; stored.report.items[0].referenceRange = 'REFERENCIA CAMBIADA'; stored.report.items[0].resultValue = '200'; repo.template = null;
  const second = await service.release(actor, 1, 'print', undefined, new Date('2026-11-16'));
  assert.equal(first.kind, 'released'); assert.equal(second.kind, 'released');
  if (first.kind === 'released' && second.kind === 'released') assert.deepEqual(first.buffer, second.buffer);
  assert.equal(renderer.received.length, 1);
  stored.release.payments = [];
  assert.equal((await service.release({ ...actor, isAdmin: false }, 1, 'print', undefined)).kind, 'blocked');
});
