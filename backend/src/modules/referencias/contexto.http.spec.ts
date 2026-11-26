import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ReferenciasModule } from './referencias.module';
import { PrismaService } from '../../prisma/prisma.service';
import { configurarApp } from '../../__tests__/sesion-de-prueba';

describe('Contexto de referencia de una orden', () => {
  let app: INestApplication;
  let order: any;
  let captured: number;
  let issued: number;
  let audits: any[];
  const headers = { 'x-tenant-id': '1', 'x-user-name': 'QA', 'x-user-role': 'admin' };
  const body = { processedAt: '2026-01-15T12:00:00.000Z', condition: 'Embarazo', weeks: 20 };
  beforeEach(async () => {
    order = { id: 9, tenantId: 1, status: 'pending', resultsDeliveredAt: null, processedAt: null, referenceCondition: null, referenceWeeks: null, patient: { birthDate: new Date('1990-01-01') } };
    captured = issued = 0; audits = [];
    const tx = {
      $queryRaw: async () => [],
      order: {
        findFirst: async ({ where }: any) => where.id === order.id && where.tenantId === order.tenantId ? order : null,
        update: async ({ data }: any) => (order = { ...order, ...data }),
      },
      testResult: { count: async () => captured },
      orderReport: { count: async () => issued },
      catalogAudit: { create: async ({ data }: any) => { audits.push(data); return data; } },
    };
    const m = await Test.createTestingModule({ imports: [ReferenciasModule] }).overrideProvider(PrismaService).useValue({ ...tx, $transaction: async (fn: any) => fn(tx) }).compile();
    app = m.createNestApplication(); configurarApp(app as never); await app.init();
  });
  afterEach(async () => { await app.close(); });
  const path = '/api/referencias/ordenes/9/contexto';
  it('guarda y audita la fecha histórica y el contexto normalizado', async () => {
    await request(app.getHttpServer()).post(path).set(headers).send(body).expect(201);
    expect(order.processedAt.toISOString()).toBe(body.processedAt);
    expect(order.referenceCondition).toBe('embarazo'); expect(order.referenceWeeks).toBe(20);
    expect(audits[0].userName).toBe('QA'); expect(audits[0].before.processedAt).toBeNull(); expect(audits[0].after.condition).toBe('embarazo');
  });
  it.each(['receptionist', 'doctor', ''])('bloquea al rol %s', async role => {
    await request(app.getHttpServer()).post(path).set({ ...headers, 'x-user-role': role }).send(body).expect(403);
    expect(audits).toHaveLength(0);
  });
  it('impide acceder a otra organización', async () => {
    await request(app.getHttpServer()).post(path).set({ ...headers, 'x-tenant-id': '2' }).send(body).expect(404);
  });
  it('rechaza fechas futuras, inválidas, sin zona y anteriores al nacimiento', async () => {
    for (const processedAt of ['invalida', '2026-01-01T12:00', '1989-01-01T00:00:00Z', new Date(Date.now() + 60000).toISOString()]) await request(app.getHttpServer()).post(path).set(headers).send({ ...body, processedAt }).expect(400);
  });
  it('valida semanas y condición y permite contexto general', async () => {
    for (const patch of [{ weeks: -1 }, { weeks: 46 }, { weeks: 1.5 }, { weeks: '20' }, { condition: '' }]) await request(app.getHttpServer()).post(path).set(headers).send({ ...body, ...patch }).expect(400);
    await request(app.getHttpServer()).post(path).set(headers).send({ ...body, condition: '', weeks: null }).expect(201);
  });
  it('bloquea cambios después de capturar un resultado', async () => {
    captured = 1; await request(app.getHttpServer()).post(path).set(headers).send(body).expect(409); expect(audits).toHaveLength(0);
  });
  it('bloquea cambios después de emitir el informe', async () => {
    issued = 1; await request(app.getHttpServer()).post(path).set(headers).send(body).expect(409);
  });
});
