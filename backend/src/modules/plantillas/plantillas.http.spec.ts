import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configurarApp } from '../../configurar-app';
import { FakeRepository } from './dominio/plantillas.escenarios';
import { PlantillasModule } from './plantillas.module';
import { PLANTILLAS_REPOSITORY } from './plantillas.tokens';

const TENANT = { 'x-tenant-id': '1' };

describe('API de plantillas de informe', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const modulo = await Test.createTestingModule({ imports: [PlantillasModule] })
      .overrideProvider(PLANTILLAS_REPOSITORY)
      .useValue(new FakeRepository())
      .compile();
    app = modulo.createNestApplication();
    configurarApp(app as never);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('exige el encabezado x-tenant-id', async () => {
    const res = await request(app.getHttpServer()).get('/api/templates');
    expect(res.status).toBe(400);
    expect(res.body.error.mensaje).toBe('Falta el encabezado x-tenant-id con el id del laboratorio.');
  });

  it('usa la plantilla de respaldo cuando no hay ninguna', async () => {
    const res = await request(app.getHttpServer()).get('/api/templates/active').set(TENANT);
    expect(res.status).toBe(200);
    expect(res.body.version).toBe(3);
    expect(res.body.chemistName).toBe('Laura Méndez');
  });

  it('guarda versiones, publica la última y lista el historial', async () => {
    const primera = await request(app.getHttpServer())
      .post('/api/templates')
      .set(TENANT)
      .send({ headerText: 'Encabezado 1', disclaimer: 'Aviso 1', chemistName: 'QFB 1', chemistCedula: 'C1' });
    expect(primera.status).toBe(201);
    expect(primera.body.version).toBe(1);
    expect(primera.body.isDefault).toBe(true);

    const segunda = await request(app.getHttpServer()).post('/api/templates').set(TENANT).send({ headerText: 'Encabezado 2' });
    expect(segunda.status).toBe(201);
    expect(segunda.body.name).toBe('Biometría hemática · v2');

    const activa = await request(app.getHttpServer()).get('/api/templates/active').set(TENANT);
    expect(activa.body.version).toBe(2);

    const historial = await request(app.getHttpServer()).get('/api/templates').set(TENANT);
    expect(historial.status).toBe(200);
    expect(historial.body.map((item: { version: number }) => item.version)).toEqual([2, 1]);
    expect(historial.body.map((item: { isDefault: boolean }) => item.isDefault)).toEqual([true, false]);
  });

  it('aísla las plantillas por laboratorio', async () => {
    await request(app.getHttpServer()).post('/api/templates').set(TENANT).send({ headerText: 'Solo del 1' });
    const otro = await request(app.getHttpServer()).get('/api/templates').set({ 'x-tenant-id': '2' });
    expect(otro.status).toBe(200);
    expect(otro.body).toEqual([]);
  });

  it('rechaza campos que no son texto o que no existen con 400', async () => {
    const tipo = await request(app.getHttpServer()).post('/api/templates').set(TENANT).send({ headerText: 123 });
    expect(tipo.status).toBe(400);
    expect(tipo.body.error.mensaje).toContain('headerText debe ser texto.');

    const extra = await request(app.getHttpServer()).post('/api/templates').set(TENANT).send({ headerText: 'x', otro: 1 });
    expect(extra.status).toBe(400);
  });
});
