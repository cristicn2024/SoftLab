import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { prisma } from '../../config/db';
import { closeDatabase, createScreenFixture, headers, type ScreenFixture } from './support';
import { construirAppNest } from './support-nest';

jest.setTimeout(30000);

// Pantalla "Entrega de resultados" (HU-06)
// GET|POST /reports/orders/:orderId/pdf · GET /verify-report/:token

describe('Pantalla de entrega de informes PDF', () => {
  let app: INestApplication;
  let fixture: ScreenFixture;
  let unpaidOrder: Awaited<ReturnType<ScreenFixture['createOrder']>>;
  let cancelledOrder: Awaited<ReturnType<ScreenFixture['createOrder']>>;
  let paidOrder: Awaited<ReturnType<ScreenFixture['createOrder']>>;
  let verifiedOrder: Awaited<ReturnType<ScreenFixture['createOrder']>>;
  const qrToken = 'qa-token-verificacion-0001';

  beforeAll(async () => {
    app = await construirAppNest();
    // Este laboratorio se queda sin plantilla a propósito para probar el bloqueo de emisión.
    fixture = await createScreenFixture('entrega');

    unpaidOrder = await fixture.createOrder({
      items: [{ price: 150 }, { price: 100 }],
    });
    cancelledOrder = await fixture.createOrder({
      status: 'cancelled',
      items: [{ price: 200 }],
    });
    paidOrder = await fixture.createOrder({
      items: [{ price: 250 }],
      payments: [{ method: 'cash', amount: 250 }],
    });
    verifiedOrder = await fixture.createOrder({
      items: [{ price: 120 }],
      payments: [{ method: 'cash', amount: 120 }],
    });
  });

  afterAll(async () => {
    await app.close();
    await fixture.cleanup();
    await closeDatabase();
  });

  it('valida el identificador de la orden', async () => {
    const notNumber = await request(app.getHttpServer())
      .get('/api/reports/orders/abc/pdf')
      .set(headers(fixture.tenantId));
    expect(notNumber.status).toBe(400);
    expect(notNumber.body.error.mensaje).toBe('Orden o laboratorio no válido');

    const zero = await request(app.getHttpServer())
      .get('/api/reports/orders/0/pdf')
      .set(headers(fixture.tenantId));
    expect(zero.status).toBe(400);
    expect(zero.body.error.mensaje).toBe('Orden o laboratorio no válido');
  });

  it('valida el canal de entrega', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/reports/orders/${paidOrder.id}/pdf?channel=fax`)
      .set(headers(fixture.tenantId));

    expect(res.status).toBe(422);
    expect(res.body.error.mensaje).toBe('Canal de entrega no válido');
  });

  it('responde 404 cuando la orden no existe', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/reports/orders/999999999/pdf')
      .set(headers(fixture.tenantId));

    expect(res.status).toBe(404);
    expect(res.body.error.mensaje).toBe('La orden no existe');
  });

  it('bloquea la entrega con saldo pendiente en cualquier canal', async () => {
    const getRes = await request(app.getHttpServer())
      .get(`/api/reports/orders/${unpaidOrder.id}/pdf?channel=portal`)
      .set(headers(fixture.tenantId));

    expect(getRes.status).toBe(409);
    expect(getRes.body.code).toBe('PAYMENT_REQUIRED');
    expect(getRes.body.balance).toBe('250.00');
    expect(getRes.body.paymentUrl).toBe(`/ordenes/cobro?orden=${unpaidOrder.id}`);
    expect(getRes.body.error).toMatch(/Saldo pendiente: \$250\.00/);
    expect(String(getRes.headers['cache-control'])).toMatch(/no-store/);

    const postRes = await request(app.getHttpServer())
      .post(`/api/reports/orders/${unpaidOrder.id}/pdf`)
      .set(headers(fixture.tenantId, { 'x-user-name': 'Recepción QA', 'x-user-role': 'receptionist' }))
      .send({ channel: 'email' });

    expect(postRes.status).toBe(409);
    expect(postRes.body.code).toBe('PAYMENT_REQUIRED');

    const logs = await prisma.paymentLog.findMany({
      where: { tenantId: fixture.tenantId, orderId: unpaidOrder.id },
    });
    expect(logs.some((log) => log.action === 'Entrega bloqueada' && log.detail.includes('Canal: email'))).toBe(true);
  });

  it('no libera el informe sin motivo aunque el usuario sea administrador', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/reports/orders/${unpaidOrder.id}/pdf`)
      .set(headers(fixture.tenantId, { 'x-user-name': 'Administradora QA', 'x-user-role': 'Administradora' }))
      .send({ channel: 'counter', reason: '   ' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PAYMENT_REQUIRED');
  });

  it('no entrega informes de una orden cancelada', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/reports/orders/${cancelledOrder.id}/pdf`)
      .set(headers(fixture.tenantId));

    expect(res.status).toBe(409);
    expect(res.body.error.mensaje).toBe('La orden está cancelada');
  });

  it('exige una plantilla predeterminada para emitir el informe', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/reports/orders/${paidOrder.id}/pdf`)
      .set(headers(fixture.tenantId))
      .send({ channel: 'counter' });

    expect(res.status).toBe(500);
    expect(res.body.error.mensaje).toBe('Error al generar informe PDF');

    const report = await prisma.orderReport.findFirst({ where: { orderId: paidOrder.id } });
    expect(report).toBeNull();
    const stored = await prisma.order.findUniqueOrThrow({ where: { id: paidOrder.id } });
    expect(stored.resultsDeliveredAt).toBeNull();
  });

  it('valida un informe emitido con su token QR', async () => {
    const template = await prisma.reportTemplate.create({
      data: {
        tenantId: fixture.tenantId,
        name: 'Biometría hemática · v1',
        version: 1,
        isDefault: true,
      },
    });
    await prisma.orderReport.create({
      data: {
        tenantId: fixture.tenantId,
        orderId: verifiedOrder.id,
        templateId: template.id,
        qrToken,
      },
    });

    const res = await request(app.getHttpServer()).get(`/api/verify-report/${qrToken}`);

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.laboratory).toBe('Laboratorio QA entrega');
    expect(res.body.patient).toBe('Paciente entrega');
    expect(res.body.issuedAt).toBeTruthy();
  });

  it('marca como no auténtico un token desconocido', async () => {
    const res = await request(app.getHttpServer()).get('/api/verify-report/token-inexistente');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ valid: false, message: 'Documento no auténtico' });
  });
});
