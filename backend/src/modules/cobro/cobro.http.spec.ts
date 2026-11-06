import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configurarApp } from '../../configurar-app';
import { FakeRepository, order } from './dominio/cobro.escenarios';
import { CobroModule } from './cobro.module';
import { COBRO_REPOSITORY } from './cobro.tokens';

const ADMIN = { 'x-tenant-id': '1', 'x-user-name': 'Administradora QA', 'x-user-role': 'admin' };
const RECEPCION = { 'x-tenant-id': '1', 'x-user-name': 'Recepcionista QA', 'x-user-role': 'receptionist' };

describe('API de cobro', () => {
  let app: INestApplication;
  let repositorio: FakeRepository;

  beforeEach(async () => {
    repositorio = new FakeRepository();
    repositorio.add(1, order(1));
    repositorio.add(1, order(2));
    repositorio.add(1, order(3, { payments: [{ method: 'cash', amount: 100, reference: 'Caja 1' }] }));
    repositorio.add(1, order(4, { resultsDeliveredAt: new Date(2026, 10, 1) }));
    repositorio.add(2, order(5));

    const modulo = await Test.createTestingModule({ imports: [CobroModule] })
      .overrideProvider(COBRO_REPOSITORY)
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
    const res = await request(app.getHttpServer()).get('/api/orders/1/billing');
    expect(res.status).toBe(400);
    expect(res.body.error.mensaje).toBe('Falta el encabezado x-tenant-id con el id del laboratorio.');
  });

  it('muestra el cobro de la orden y responde 404 si es de otro laboratorio', async () => {
    const ok = await request(app.getHttpServer()).get('/api/orders/1/billing').set(ADMIN);
    expect(ok.status).toBe(200);
    expect(ok.body.folio).toBe('SL-000001');
    expect(ok.body.total).toBe('250.00');
    expect(ok.body.balance).toBe('250.00');

    const ajena = await request(app.getHttpServer()).get('/api/orders/5/billing').set(ADMIN);
    expect(ajena.status).toBe(404);
    expect(ajena.body.error.mensaje).toBe('La orden no existe');
  });

  it('rechaza ids inválidos con 400', async () => {
    const orden = await request(app.getHttpServer()).get('/api/orders/abc/billing').set(ADMIN);
    expect(orden.status).toBe(400);
    expect(orden.body.error.mensaje).toBe('El id de la orden no es válido.');

    const pago = await request(app.getHttpServer()).post('/api/payments/0/cancel').set(ADMIN).send({ reason: 'x' });
    expect(pago.status).toBe(400);
    expect(pago.body.error.mensaje).toBe('El id del pago no es válido.');
  });

  it('registra un pago y responde 201 con el cobro actualizado', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/orders/1/payments')
      .set(ADMIN)
      .send({ payments: [{ method: 'cash', amount: 250 }], cashReceived: 300 });
    expect(res.status).toBe(201);
    expect(res.body.paid).toBe('250.00');
    expect(res.body.balance).toBe('0.00');
    expect(res.body.logs[0].detail).toContain('cambio $50.00');
  });

  it('traduce las reglas de pago a 403, 409 y 422', async () => {
    const sinPermiso = await request(app.getHttpServer())
      .post('/api/orders/1/payments')
      .set(RECEPCION)
      .send({ leavePending: true, discount: { percent: 10, reason: 'Convenio' } });
    expect(sinPermiso.status).toBe(403);
    expect(sinPermiso.body.error.mensaje).toBe('Tu rol no tiene permiso para aplicar descuentos.');

    const entregada = await request(app.getHttpServer())
      .post('/api/orders/4/payments')
      .set(ADMIN)
      .send({ payments: [{ method: 'cash', amount: 10 }] });
    expect(entregada.status).toBe(409);

    const referencia = await request(app.getHttpServer())
      .post('/api/orders/1/payments')
      .set(ADMIN)
      .send({ payments: [{ method: 'card', amount: 10 }] });
    expect(referencia.status).toBe(422);
    expect(referencia.body.error.mensaje).toBe('Falta la referencia del pago con tarjeta.');
  });

  it('acepta el cuerpo vacío al registrar y pide un monto', async () => {
    const res = await request(app.getHttpServer()).post('/api/orders/2/payments').set(ADMIN);
    expect(res.status).toBe(422);
    expect(res.body.error.mensaje).toBe('Captura al menos un monto para registrar el pago.');
  });

  it('cancela un pago solo siendo administrador y con motivo', async () => {
    const sinPermiso = await request(app.getHttpServer())
      .post('/api/payments/301/cancel')
      .set(RECEPCION)
      .send({ reason: 'Error' });
    expect(sinPermiso.status).toBe(403);
    expect(sinPermiso.body.error.mensaje).toBe('Tu rol no tiene permiso especial para cancelar pagos.');

    const sinMotivo = await request(app.getHttpServer()).post('/api/payments/301/cancel').set(ADMIN).send({ reason: '   ' });
    expect(sinMotivo.status).toBe(422);

    const ok = await request(app.getHttpServer())
      .post('/api/payments/301/cancel')
      .set(ADMIN)
      .send({ reason: 'Error de captura' });
    expect(ok.status).toBe(200);
    expect(ok.body.payments[0].cancelled).toBe(true);
    expect(ok.body.paid).toBe('0.00');

    const repetido = await request(app.getHttpServer())
      .post('/api/payments/301/cancel')
      .set(ADMIN)
      .send({ reason: 'Otra vez' });
    expect(repetido.status).toBe(409);
    expect(repetido.body.error.mensaje).toBe('El pago ya estaba cancelado.');

    const inexistente = await request(app.getHttpServer())
      .post('/api/payments/999999/cancel')
      .set(ADMIN)
      .send({ reason: 'No existe' });
    expect(inexistente.status).toBe(404);
    expect(inexistente.body.error.mensaje).toBe('El pago no existe');
  });
});
