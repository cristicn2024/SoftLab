import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import reportRoutes from '../../routes/report.routes';
import { prisma } from '../../config/db';
import { buildApp, closeDatabase, createScreenFixture, headers, type ScreenFixture } from './support';

// Pantalla "Entrega de resultados" (HU-06)
// GET|POST /reports/orders/:orderId/pdf · GET /verify-report/:token

const app = buildApp(reportRoutes);

describe('Pantalla de entrega de informes PDF', () => {
  let fixture: ScreenFixture;
  let unpaidOrder: Awaited<ReturnType<ScreenFixture['createOrder']>>;
  let cancelledOrder: Awaited<ReturnType<ScreenFixture['createOrder']>>;
  let paidOrder: Awaited<ReturnType<ScreenFixture['createOrder']>>;
  let verifiedOrder: Awaited<ReturnType<ScreenFixture['createOrder']>>;
  const qrToken = 'qa-token-verificacion-0001';

  before(async () => {
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

  after(async () => {
    await fixture.cleanup();
    await closeDatabase();
  });

  it('valida el identificador de la orden', async () => {
    const notNumber = await request(app)
      .get('/api/reports/orders/abc/pdf')
      .set(headers(fixture.tenantId));
    assert.equal(notNumber.status, 400);
    assert.equal(notNumber.body.error, 'Orden o laboratorio no válido');

    const zero = await request(app)
      .get('/api/reports/orders/0/pdf')
      .set(headers(fixture.tenantId));
    assert.equal(zero.status, 400);
    assert.equal(zero.body.error, 'Orden o laboratorio no válido');
  });

  it('valida el canal de entrega', async () => {
    const res = await request(app)
      .get(`/api/reports/orders/${paidOrder.id}/pdf?channel=fax`)
      .set(headers(fixture.tenantId));

    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Canal de entrega no válido');
  });

  it('responde 404 cuando la orden no existe', async () => {
    const res = await request(app)
      .get('/api/reports/orders/999999999/pdf')
      .set(headers(fixture.tenantId));

    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'La orden no existe');
  });

  it('bloquea la entrega con saldo pendiente en cualquier canal', async () => {
    const getRes = await request(app)
      .get(`/api/reports/orders/${unpaidOrder.id}/pdf?channel=portal`)
      .set(headers(fixture.tenantId));

    assert.equal(getRes.status, 409);
    assert.equal(getRes.body.code, 'PAYMENT_REQUIRED');
    assert.equal(getRes.body.balance, '250.00');
    assert.equal(getRes.body.paymentUrl, `/ordenes/cobro?orden=${unpaidOrder.id}`);
    assert.match(getRes.body.error, /Saldo pendiente: \$250\.00/);
    assert.match(String(getRes.headers['cache-control']), /no-store/);

    const postRes = await request(app)
      .post(`/api/reports/orders/${unpaidOrder.id}/pdf`)
      .set(headers(fixture.tenantId, { 'x-user-name': 'Recepción QA', 'x-user-role': 'receptionist' }))
      .send({ channel: 'email' });

    assert.equal(postRes.status, 409);
    assert.equal(postRes.body.code, 'PAYMENT_REQUIRED');

    const logs = await prisma.paymentLog.findMany({
      where: { tenantId: fixture.tenantId, orderId: unpaidOrder.id },
    });
    assert.ok(logs.some(log => log.action === 'Entrega bloqueada' && log.detail.includes('Canal: email')));
  });

  it('no libera el informe sin motivo aunque el usuario sea administrador', async () => {
    const res = await request(app)
      .post(`/api/reports/orders/${unpaidOrder.id}/pdf`)
      .set(headers(fixture.tenantId, { 'x-user-name': 'Administradora QA', 'x-user-role': 'Administradora' }))
      .send({ channel: 'counter', reason: '   ' });

    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'PAYMENT_REQUIRED');
  });

  it('no entrega informes de una orden cancelada', async () => {
    const res = await request(app)
      .get(`/api/reports/orders/${cancelledOrder.id}/pdf`)
      .set(headers(fixture.tenantId));

    assert.equal(res.status, 409);
    assert.equal(res.body.error, 'La orden está cancelada');
  });

  it('exige una plantilla predeterminada para emitir el informe', async () => {
    const res = await request(app)
      .post(`/api/reports/orders/${paidOrder.id}/pdf`)
      .set(headers(fixture.tenantId))
      .send({ channel: 'counter' });

    assert.equal(res.status, 500);
    assert.equal(res.body.error, 'Error al generar informe PDF');

    const report = await prisma.orderReport.findFirst({ where: { orderId: paidOrder.id } });
    assert.equal(report, null);
    const stored = await prisma.order.findUniqueOrThrow({ where: { id: paidOrder.id } });
    assert.equal(stored.resultsDeliveredAt, null);
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

    const res = await request(app).get(`/api/verify-report/${qrToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.valid, true);
    assert.equal(res.body.laboratory, 'Laboratorio QA entrega');
    assert.equal(res.body.patient, 'Paciente entrega');
    assert.ok(res.body.issuedAt);
  });

  it('marca como no auténtico un token desconocido', async () => {
    const res = await request(app).get('/api/verify-report/token-inexistente');

    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { valid: false, message: 'Documento no auténtico' });
  });
});
