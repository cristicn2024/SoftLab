import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configurarApp } from '../../configurar-app';
import { FakeRenderer, FakeRepository, releaseOrder } from './dominio/reportes.escenarios';
import { ReportesModule } from './reportes.module';
import { REPORTES_PDF_RENDERER, REPORTES_REPOSITORY } from './reportes.tokens';

const TENANT = { 'x-tenant-id': '1' };
const ADMIN = { ...TENANT, 'x-user-name': 'Administradora QA', 'x-user-role': 'Administradora' };
const RECEPCION = { ...TENANT, 'x-user-name': 'Recepción QA', 'x-user-role': 'receptionist' };

function binario(res: request.Response, done: (error: Error | null, body: Buffer) => void) {
  const trozos: Buffer[] = [];
  res.on('data', (trozo: Buffer) => trozos.push(trozo));
  res.on('end', () => done(null, Buffer.concat(trozos)));
}

describe('API de entrega de informes', () => {
  let app: INestApplication;
  let repositorio: FakeRepository;

  beforeEach(async () => {
    repositorio = new FakeRepository();
    repositorio.add(1, releaseOrder(1));
    repositorio.add(1, releaseOrder(2, { payments: [{ amount: 100, cancelled: false }] }));
    repositorio.add(1, releaseOrder(3, { status: 'cancelled' }));
    repositorio.verified.set('qa-token', { laboratory: 'Laboratorio QA', patient: 'Paciente QA', issuedAt: new Date(2026, 10, 3) });

    const modulo = await Test.createTestingModule({ imports: [ReportesModule] })
      .overrideProvider(REPORTES_REPOSITORY)
      .useValue(repositorio)
      .overrideProvider(REPORTES_PDF_RENDERER)
      .useValue(new FakeRenderer())
      .compile();
    app = modulo.createNestApplication();
    configurarApp(app as never);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('exige el encabezado x-tenant-id para obtener el informe', async () => {
    const res = await request(app.getHttpServer()).get('/api/reports/orders/2/pdf');
    expect(res.status).toBe(400);
    expect(res.body.error.mensaje).toBe('Falta el encabezado x-tenant-id con el id del laboratorio.');
  });

  it('valida el identificador de la orden y el canal', async () => {
    for (const id of ['abc', '0', '-1', '1.5', '99999999999999999999']) {
      const res = await request(app.getHttpServer()).get(`/api/reports/orders/${id}/pdf`).set(TENANT);
      expect(res.status).toBe(400);
      expect(res.body.error.mensaje).toBe('Orden o laboratorio no válido');
    }
    const canal = await request(app.getHttpServer()).get('/api/reports/orders/2/pdf?channel=fax').set(TENANT);
    expect(canal.status).toBe(422);
    expect(canal.body.error.mensaje).toBe('Canal de entrega no válido');
  });

  it('responde 404 si la orden no existe y 409 si está cancelada', async () => {
    const inexistente = await request(app.getHttpServer()).get('/api/reports/orders/99/pdf').set(TENANT);
    expect(inexistente.status).toBe(404);
    expect(inexistente.body.error.mensaje).toBe('La orden no existe');
    expect(String(inexistente.headers['cache-control'])).toContain('no-store');

    const cancelada = await request(app.getHttpServer()).get('/api/reports/orders/3/pdf').set(TENANT);
    expect(cancelada.status).toBe(409);
    expect(cancelada.body.error.mensaje).toBe('La orden está cancelada');
  });

  it('bloquea con saldo pendiente y conserva el cuerpo que usa el front', async () => {
    const res = await request(app.getHttpServer()).get('/api/reports/orders/1/pdf?channel=portal').set(TENANT);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      status: 409,
      code: 'PAYMENT_REQUIRED',
      error: 'Entrega bloqueada. Saldo pendiente: $100.00.',
      balance: '100.00',
      paymentUrl: '/ordenes/cobro?orden=1',
    });
    expect(String(res.headers['cache-control'])).toContain('no-store');

    const post = await request(app.getHttpServer()).post('/api/reports/orders/1/pdf').set(RECEPCION).send({ channel: 'email' });
    expect(post.status).toBe(409);
    expect(post.body.code).toBe('PAYMENT_REQUIRED');
    expect(repositorio.logs.some((log) => log.action === 'Entrega bloqueada' && log.detail.includes('Canal: email'))).toBe(true);
  });

  it('no libera sin motivo aunque sea administrador y sí con motivo', async () => {
    const sinMotivo = await request(app.getHttpServer())
      .post('/api/reports/orders/1/pdf')
      .set(ADMIN)
      .send({ channel: 'counter', reason: '   ' });
    expect(sinMotivo.status).toBe(409);

    const conMotivo = await request(app.getHttpServer())
      .post('/api/reports/orders/1/pdf')
      .set(ADMIN)
      .send({ channel: 'counter', reason: 'Urgencia' })
      .buffer(true)
      .parse(binario);
    expect(conMotivo.status).toBe(200);
    expect(repositorio.logs.some((log) => log.action === 'Excepción de entrega autorizada')).toBe(true);
  });

  it('entrega el PDF de una orden liquidada con GET y con POST', async () => {
    const get = await request(app.getHttpServer()).get('/api/reports/orders/2/pdf').set(TENANT).buffer(true).parse(binario);
    expect(get.status).toBe(200);
    expect(get.headers['content-type']).toContain('application/pdf');
    expect(get.headers['content-disposition']).toBe('inline; filename=Informe_Orden_2.pdf');
    expect(String(get.headers['cache-control'])).toContain('no-store');
    expect(Buffer.isBuffer(get.body)).toBe(true);
    expect(get.body.toString()).toBe('pdf');

    const post = await request(app.getHttpServer())
      .post('/api/reports/orders/2/pdf')
      .set(TENANT)
      .send({ channel: 'print' })
      .buffer(true)
      .parse(binario);
    expect(post.status).toBe(200);
    expect(post.headers['content-type']).toContain('application/pdf');
  });

  it('verifica un informe sin pedir encabezados y marca como no auténtico el desconocido', async () => {
    const ok = await request(app.getHttpServer()).get('/api/verify-report/qa-token');
    expect(ok.status).toBe(200);
    expect(ok.body.valid).toBe(true);
    expect(ok.body.laboratory).toBe('Laboratorio QA');
    expect(ok.body.patient).toBe('Paciente QA');
    expect(ok.body.issuedAt).toBeTruthy();

    const falso = await request(app.getHttpServer()).get('/api/verify-report/token-inexistente');
    expect(falso.status).toBe(404);
    expect(falso.body).toEqual({ valid: false, message: 'Documento no auténtico' });
  });
});
