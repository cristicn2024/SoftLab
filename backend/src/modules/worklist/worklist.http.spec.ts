import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configurarApp } from '../../configurar-app';
import { FakeRepository, order } from './dominio/worklist.escenarios';
import { WorklistModule } from './worklist.module';
import { WORKLIST_REPOSITORY } from './worklist.tokens';

describe('API de la lista de trabajo', () => {
  let app: INestApplication;
  let repositorio: FakeRepository;

  beforeEach(async () => {
    repositorio = new FakeRepository();
    repositorio.add(1, order(1, 'F', new Date(1988, 0, 15)));
    repositorio.add(1, order(2, 'M', new Date(2020, 5, 1)));
    repositorio.add(2, order(3, 'F', new Date(1990, 0, 1)));

    const modulo = await Test.createTestingModule({ imports: [WorklistModule] })
      .overrideProvider(WORKLIST_REPOSITORY)
      .useValue(repositorio)
      .compile();
    app = modulo.createNestApplication();
    configurarApp(app as never);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('exige el encabezado x-tenant-id', async () => {
    const res = await request(app.getHttpServer()).get('/api/worklist');
    expect(res.status).toBe(400);
    expect(res.body.error.mensaje).toBe('Falta el encabezado x-tenant-id con el id del laboratorio.');
  });

  it('lista solo las órdenes del laboratorio', async () => {
    const res = await request(app.getHttpServer()).get('/api/worklist').set('x-tenant-id', '2');
    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(1);
    expect(res.body.orders[0].orderId).toBe(3);
    expect(res.body.totalPending).toBe(1);
  });

  it('abre una orden y responde 404 si es de otro laboratorio', async () => {
    const ok = await request(app.getHttpServer()).get('/api/worklist/orders/1').set('x-tenant-id', '1');
    expect(ok.status).toBe(200);
    expect(ok.body.orderId).toBe(1);

    const otro = await request(app.getHttpServer()).get('/api/worklist/orders/1').set('x-tenant-id', '2');
    expect(otro.status).toBe(404);
    expect(otro.body.error.tipo).toBe('OrderNotFoundError');
  });

  it('rechaza un id de orden inválido con 400', async () => {
    for (const id of ['abc', '0', '-3', '1.5']) {
      const res = await request(app.getHttpServer()).get(`/api/worklist/orders/${id}`).set('x-tenant-id', '1');
      expect(res.status).toBe(400);
      expect(res.body.error.mensaje).toBe('El id de la orden no es válido.');
    }
  });

  it('guarda resultados y responde 201 con lo guardado', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/worklist/orders/1/results')
      .set('x-tenant-id', '1')
      .send({ results: [{ orderItemId: 1000, parameterId: 7, value: '90,5' }] });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ saved: [{ orderItemId: 1000, parameterId: 7, value: '90.5', flag: 'Normal' }] });
    expect(repositorio.saves).toHaveLength(1);
  });

  it('valida la forma del cuerpo con 400', async () => {
    const sinLista = await request(app.getHttpServer())
      .post('/api/worklist/orders/1/results')
      .set('x-tenant-id', '1')
      .send({});
    expect(sinLista.status).toBe(400);
    expect(sinLista.body.error.mensaje).toContain('Manda la lista de resultados en "results".');

    const objetoEnLugarDeLista = await request(app.getHttpServer())
      .post('/api/worklist/orders/1/results')
      .set('x-tenant-id', '1')
      .send({ results: {} });
    expect(objetoEnLugarDeLista.status).toBe(400);
    expect(objetoEnLugarDeLista.body.error.mensaje).toContain('Manda la lista de resultados en "results".');

    const incompleta = await request(app.getHttpServer())
      .post('/api/worklist/orders/1/results')
      .set('x-tenant-id', '1')
      .send({ results: [{ orderItemId: 1000, value: '90' }] });
    expect(incompleta.status).toBe(400);
    expect(incompleta.body.error.mensaje).toContain('Cada resultado necesita orderItemId, parameterId y value (texto).');
  });

  it('traduce los errores de dominio a 422 y 409', async () => {
    const vacia = await request(app.getHttpServer())
      .post('/api/worklist/orders/1/results')
      .set('x-tenant-id', '1')
      .send({ results: [] });
    expect(vacia.status).toBe(422);
    expect(vacia.body.error.tipo).toBe('EmptyCaptureError');

    const critico = await request(app.getHttpServer())
      .post('/api/worklist/orders/1/results')
      .set('x-tenant-id', '1')
      .send({ results: [{ orderItemId: 1000, parameterId: 7, value: '600' }] });
    expect(critico.status).toBe(422);
    expect(critico.body.error.tipo).toBe('CriticalValueError');

    const noPendiente = await request(app.getHttpServer())
      .post('/api/worklist/orders/1/results')
      .set('x-tenant-id', '1')
      .send({ results: [{ orderItemId: 1000, parameterId: 99, value: '90' }] });
    expect(noPendiente.status).toBe(409);
    expect(noPendiente.body.error.tipo).toBe('ParameterNotPendingError');
  });
});
