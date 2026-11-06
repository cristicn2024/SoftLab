import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import templateRoutes from '../../routes/template.routes';
import reportRoutes from '../../routes/report.routes';
import { prisma } from '../../config/db';
import { buildApp, closeDatabase, createScreenFixture, headers, type ScreenFixture } from './support';

// Pantalla "Plantillas de informe" (HU-06)
// GET /templates/active · POST /templates · GET /templates
// Pantalla "Entrega de resultados" (HU-06)
// GET|POST /reports/orders/:orderId/pdf · GET /verify-report/:token

const app = buildApp(templateRoutes, reportRoutes);

describe('Pantalla de plantillas de informe', () => {
  let fixture: ScreenFixture;
  let firstTemplateId = 0;

  const templateBody = (suffix: string) => ({
    headerText: `Encabezado ${suffix} · Laboratorio QA`,
    disclaimer: `Aviso legal ${suffix}`,
    chemistName: `Q.F.B. ${suffix}`,
    chemistCedula: `CED-${suffix}`,
  });

  before(async () => {
    fixture = await createScreenFixture('plantillas');
  });

  after(async () => {
    await fixture.cleanup();
    await closeDatabase();
  });

  it('usa la plantilla de respaldo cuando el laboratorio no tiene una configurada', async () => {
    const res = await request(app).get('/api/templates/active').set(headers(fixture.tenantId));

    assert.equal(res.status, 200);
    assert.equal(res.body.version, 3);
    assert.equal(res.body.name, 'Biometría hemática · Clínica Central · v3 · Publicada');
    assert.equal(res.body.headerText, 'Logotipo · Laboratorio Santa Lucía · Clínica Central');
    assert.equal(res.body.chemistName, 'Laura Méndez');
    assert.equal(res.body.chemistCedula, '10458392');
  });

  it('guarda la primera versión y la marca como predeterminada', async () => {
    const res = await request(app)
      .post('/api/templates')
      .set(headers(fixture.tenantId))
      .send(templateBody('Primera'));

    assert.equal(res.status, 201);
    assert.equal(res.body.tenantId, fixture.tenantId);
    assert.equal(res.body.version, 1);
    assert.equal(res.body.name, 'Biometría hemática · v1');
    assert.equal(res.body.isDefault, true);
    assert.equal(res.body.headerText, 'Encabezado Primera · Laboratorio QA');
    assert.equal(res.body.disclaimer, 'Aviso legal Primera');
    assert.equal(res.body.chemistName, 'Q.F.B. Primera');
    assert.equal(res.body.chemistCedula, 'CED-Primera');
    assert.equal(res.body.primaryColor, '#0f766e');

    firstTemplateId = res.body.id;
  });

  it('crea una nueva versión y desmarca la anterior', async () => {
    const res = await request(app)
      .post('/api/templates')
      .set(headers(fixture.tenantId))
      .send(templateBody('Segunda'));

    assert.equal(res.status, 201);
    assert.equal(res.body.version, 2);
    assert.equal(res.body.name, 'Biometría hemática · v2');
    assert.equal(res.body.isDefault, true);

    const previous = await prisma.reportTemplate.findUniqueOrThrow({ where: { id: firstTemplateId } });
    assert.equal(previous.isDefault, false);
    assert.equal(previous.version, 1);
  });

  it('publica como vigente solo la última versión predeterminada', async () => {
    const res = await request(app).get('/api/templates/active').set(headers(fixture.tenantId));

    assert.equal(res.status, 200);
    assert.equal(res.body.version, 2);
    assert.equal(res.body.name, 'Biometría hemática · v2');
    assert.equal(res.body.headerText, 'Encabezado Segunda · Laboratorio QA');
    assert.equal(res.body.isDefault, true);

    const defaults = await prisma.reportTemplate.count({
      where: { tenantId: fixture.tenantId, isDefault: true },
    });
    assert.equal(defaults, 1);
  });

  it('entrega el historial de versiones de la más reciente a la más antigua', async () => {
    const res = await request(app).get('/api/templates').set(headers(fixture.tenantId));

    assert.equal(res.status, 200);
    assert.equal(res.body.length, 2);
    assert.deepEqual(
      res.body.map((template: { version: number }) => template.version),
      [2, 1],
    );
    assert.deepEqual(
      res.body.map((template: { isDefault: boolean }) => template.isDefault),
      [true, false],
    );
  });

  it('aísla las plantillas por laboratorio', async () => {
    const otherTenant = fixture.tenantId + 999999;

    const active = await request(app).get('/api/templates/active').set(headers(otherTenant));
    assert.equal(active.status, 200);
    assert.equal(active.body.version, 3);
    assert.equal(active.body.name, 'Biometría hemática · Clínica Central · v3 · Publicada');

    const history = await request(app).get('/api/templates').set(headers(otherTenant));
    assert.equal(history.status, 200);
    assert.deepEqual(history.body, []);
  });
});

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
