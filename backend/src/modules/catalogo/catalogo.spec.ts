import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CatalogoModule } from './catalogo.module';
import { PrismaService } from '../../prisma/prisma.service';
import { configurarApp } from '../../configurar-app';
import type { INestApplication } from '@nestjs/common';

describe('Catálogo', () => {
  let app: INestApplication;
  let studies: any[];
  let audits: any[];
  const valid = { code: 'GLU', name: 'Glucosa', department: 'Química', sampleType: 'Sangre', price: 120, status: true };
  beforeEach(async () => {
    studies = [];
    audits = [];
    const tx: any = {
      $queryRaw: async () => [{ id: 1 }],
      testCatalog: {
        findMany: async () => studies,
        findFirst: async ({ where }: any) => studies.find(s => s.id === where.id && s.tenantId === where.tenantId),
        create: async ({ data }: any) => { const row = { id: 1, ...data }; studies.push(row); return row; },
        update: async ({ data }: any) => { studies[0] = { ...studies[0], ...data }; return studies[0]; },
      },
      profileCatalog: {
        findMany: async () => [],
        create: async ({ data }: any) => ({ id: 2, ...data }),
      },
      catalogAudit: { create: async ({ data }: any) => { audits.push(data); return data; } },
    };
    const module = await Test.createTestingModule({ imports: [CatalogoModule], providers: [{ provide: PrismaService, useValue: tx }] })
      .overrideProvider(PrismaService).useValue({ ...tx, $transaction: async (fn: any) => fn(tx) }).compile();
    app = module.createNestApplication();
    configurarApp(app as never);
    await app.init();
  });
  afterEach(async () => { await app.close(); });
  const headers = { 'x-tenant-id': '1', 'x-user-name': 'Admin', 'x-user-role': 'admin' };
  it('registra creación y desactivación con valores anteriores', async () => {
    await request(app.getHttpServer()).post('/api/catalogo/studies').set(headers).send(valid).expect(201);
    await request(app.getHttpServer()).put('/api/catalogo/studies/1').set(headers).send({ ...valid, status: false }).expect(200);
    expect(studies).toHaveLength(1);
    expect(audits[1].before.status).toBe(true);
    expect(audits[1].after.status).toBe(false);
    expect(audits[1].userName).toBe('Admin');
  });
  it('rechaza duplicados ignorando mayúsculas y espacios', async () => {
    studies.push({ id: 9, tenantId: 1, ...valid });
    await request(app.getHttpServer()).post('/api/catalogo/studies').set(headers).send({ ...valid, code: 'OTRA', name: ' glucosa ' }).expect(409);
    expect(audits).toHaveLength(0);
  });
  it('rechaza perfiles vacíos y estudios de otro laboratorio', async () => {
    await request(app.getHttpServer()).post('/api/catalogo/profiles').set(headers).send({ ...valid, testIds: [] }).expect(400);
    await request(app.getHttpServer()).post('/api/catalogo/profiles').set(headers).send({ ...valid, testIds: [99] }).expect(400);
  });
  it('solo permite modificaciones a administradores', async () => {
    await request(app.getHttpServer()).post('/api/catalogo/studies').set({ ...headers, 'x-user-role': 'receptionist' }).send(valid).expect(403);
  });
  it('crea perfiles con estudios existentes y registra su composición', async () => {
    studies.push({ id: 1, tenantId: 1, ...valid, status: false });
    await request(app.getHttpServer()).post('/api/catalogo/profiles').set(headers)
      .send({ code: 'CHECK', name: 'Check-up básico', price: 200, status: true, testIds: [1] }).expect(201);
    expect(audits[0].kind).toBe('profiles');
    expect(audits[0].after.tests.create).toEqual([{ testId: 1 }]);
    const list = await request(app.getHttpServer()).get('/api/catalogo').set(headers).expect(200);
    expect(list.body.studies[0].status).toBe(false);
  });
});
