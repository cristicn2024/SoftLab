import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import paymentRoutes from '../../routes/payment.routes';
import { prisma } from '../../config/db';
import { buildApp, closeDatabase, createScreenFixture, headers, type ScreenFixture } from './support';

// Pantalla "Cobro de la orden" (HU 5.3)
// GET /orders/:id/billing · POST /orders/:id/payments · POST /payments/:id/cancel

const app = buildApp(paymentRoutes);
const ADMIN = { 'x-user-name': 'Administradora QA', 'x-user-role': 'admin' };
const RECEPCION = { 'x-user-name': 'Recepcionista QA', 'x-user-role': 'receptionist' };

describe('Pantalla de cobro', () => {
  let fixture: ScreenFixture;
  let billingOrder: Awaited<ReturnType<ScreenFixture['createOrder']>>;
  let paymentOrder: Awaited<ReturnType<ScreenFixture['createOrder']>>;
  let partialOrder: Awaited<ReturnType<ScreenFixture['createOrder']>>;
  let discountOrder: Awaited<ReturnType<ScreenFixture['createOrder']>>;
  let invoiceOrder: Awaited<ReturnType<ScreenFixture['createOrder']>>;
  let cancelOrder: Awaited<ReturnType<ScreenFixture['createOrder']>>;
  let pendingOrder: Awaited<ReturnType<ScreenFixture['createOrder']>>;
  let deliveredOrder: Awaited<ReturnType<ScreenFixture['createOrder']>>;
  let deliveredPaidOrder: Awaited<ReturnType<ScreenFixture['createOrder']>>;

  before(async () => {
    fixture = await createScreenFixture('cobro');
    const items = [{ price: 150 }, { price: 100 }];

    billingOrder = await fixture.createOrder({ items });
    paymentOrder = await fixture.createOrder({ items });
    partialOrder = await fixture.createOrder({ items });
    discountOrder = await fixture.createOrder({ items });
    invoiceOrder = await fixture.createOrder({ items });
    pendingOrder = await fixture.createOrder({ items });
    cancelOrder = await fixture.createOrder({
      items,
      payments: [{ method: 'cash', amount: 100, reference: 'Caja 1' }],
    });
    deliveredOrder = await fixture.createOrder({ items, resultsDeliveredAt: new Date() });
    deliveredPaidOrder = await fixture.createOrder({
      items,
      resultsDeliveredAt: new Date(),
      payments: [{ method: 'cash', amount: 250 }],
    });
  });

  after(async () => {
    await fixture.cleanup();
    await closeDatabase();
  });

  it('muestra el total, el saldo y los conceptos de la orden', async () => {
    const res = await request(app).get(`/api/orders/${billingOrder.id}/billing`).set(headers(fixture.tenantId));

    assert.equal(res.status, 200);
    assert.equal(res.body.folio, `SL-${String(billingOrder.id).padStart(6, '0')}`);
    assert.equal(res.body.patient.name, `Paciente cobro`);
    assert.equal(res.body.patient.record, `P-${String(fixture.patient.id).padStart(6, '0')}`);
    assert.equal(res.body.patient.gender, 'Mujer');
    assert.equal(res.body.items.length, 2);
    assert.equal(res.body.subtotal, '250.00');
    assert.equal(res.body.total, '250.00');
    assert.equal(res.body.paid, '0.00');
    assert.equal(res.body.balance, '250.00');
    assert.equal(res.body.resultsDelivered, false);
    assert.deepEqual(res.body.payments, []);
  });

  it('responde 404 cuando la orden no existe', async () => {
    const res = await request(app).get('/api/orders/999999999/billing').set(headers(fixture.tenantId));
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'La orden no existe');
  });

  it('registra un pago en efectivo, calcula el cambio y deja saldo cero', async () => {
    const res = await request(app)
      .post(`/api/orders/${paymentOrder.id}/payments`)
      .set(headers(fixture.tenantId, ADMIN))
      .send({ payments: [{ method: 'cash', amount: 250 }], cashReceived: 300 });

    assert.equal(res.status, 201);
    assert.equal(res.body.paid, '250.00');
    assert.equal(res.body.balance, '0.00');
    assert.equal(res.body.payments.length, 1);
    assert.equal(res.body.payments[0].method, 'cash');
    assert.equal(res.body.logs[0].action, 'Registró pago');
    assert.match(res.body.logs[0].detail, /cambio \$50\.00/);

    const finalBalanceCheck = await request(app)
      .post(`/api/orders/${paymentOrder.id}/payments`)
      .set(headers(fixture.tenantId, ADMIN))
      .send({ payments: [{ method: 'cash', amount: 1 }] });
    assert.equal(finalBalanceCheck.status, 400);
    assert.equal(finalBalanceCheck.body.error, 'Los pagos superan el saldo por cobrar.');
  });

  it('acumula pagos parciales hasta liquidar la orden', async () => {
    const first = await request(app)
      .post(`/api/orders/${partialOrder.id}/payments`)
      .set(headers(fixture.tenantId, ADMIN))
      .send({ payments: [{ method: 'cash', amount: 100 }] });

    assert.equal(first.status, 201);
    assert.equal(first.body.paid, '100.00');
    assert.equal(first.body.balance, '150.00');

    const second = await request(app)
      .post(`/api/orders/${partialOrder.id}/payments`)
      .set(headers(fixture.tenantId, ADMIN))
      .send({ payments: [{ method: 'card', amount: 150, reference: 'AUTH-123' }] });

    assert.equal(second.status, 201);
    assert.equal(second.body.paid, '250.00');
    assert.equal(second.body.balance, '0.00');
    assert.equal(second.body.payments[1].method, 'card');
    assert.equal(second.body.payments[1].reference, 'AUTH-123');
  });

  it('exige referencia en pagos con tarjeta o transferencia', async () => {
    const res = await request(app)
      .post(`/api/orders/${billingOrder.id}/payments`)
      .set(headers(fixture.tenantId, ADMIN))
      .send({ payments: [{ method: 'card', amount: 10 }] });

    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Falta la referencia del pago con tarjeta.');
  });

  it('permite dejar la orden pendiente sin capturar montos', async () => {
    const res = await request(app)
      .post(`/api/orders/${pendingOrder.id}/payments`)
      .set(headers(fixture.tenantId, ADMIN))
      .send({ leavePending: true });

    assert.equal(res.status, 201);
    assert.equal(res.body.balance, '250.00');
    assert.ok(res.body.logs.some((log: { action: string }) => log.action === 'Orden pendiente de pago'));
  });

  it('solo un administrador puede aplicar descuentos y siempre requiere motivo', async () => {
    const forbidden = await request(app)
      .post(`/api/orders/${discountOrder.id}/payments`)
      .set(headers(fixture.tenantId, RECEPCION))
      .send({ leavePending: true, discount: { percent: 10, reason: 'Convenio' } });

    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.error, 'Tu rol no tiene permiso para aplicar descuentos.');

    const withoutReason = await request(app)
      .post(`/api/orders/${discountOrder.id}/payments`)
      .set(headers(fixture.tenantId, ADMIN))
      .send({ leavePending: true, discount: { percent: 10 } });

    assert.equal(withoutReason.status, 400);
    assert.equal(withoutReason.body.error, 'El descuento requiere un motivo.');

    const invalidPercent = await request(app)
      .post(`/api/orders/${discountOrder.id}/payments`)
      .set(headers(fixture.tenantId, ADMIN))
      .send({ leavePending: true, discount: { percent: 7, reason: 'Convenio' } });

    assert.equal(invalidPercent.status, 400);
    assert.equal(invalidPercent.body.error, 'Porcentaje de descuento no válido.');

    const applied = await request(app)
      .post(`/api/orders/${discountOrder.id}/payments`)
      .set(headers(fixture.tenantId, ADMIN))
      .send({ leavePending: true, discount: { percent: 10, reason: 'Convenio' } });

    assert.equal(applied.status, 201);
    assert.equal(applied.body.discount.percent, 10);
    assert.equal(applied.body.discount.reason, 'Convenio');
    assert.equal(applied.body.discount.authorizedBy, 'Administradora QA');
    assert.equal(applied.body.total, '225.00');
    assert.ok(applied.body.logs.some((log: { action: string }) => log.action === 'Aplicó descuento'));
  });

  it('rechaza pagos que superan el saldo después del descuento', async () => {
    const res = await request(app)
      .post(`/api/orders/${discountOrder.id}/payments`)
      .set(headers(fixture.tenantId, ADMIN))
      .send({ payments: [{ method: 'cash', amount: 300 }] });

    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Los pagos superan el saldo por cobrar.');
  });

  it('no permite que un descuento deje el total por debajo de lo ya pagado', async () => {
    const res = await request(app)
      .post(`/api/orders/${paymentOrder.id}/payments`)
      .set(headers(fixture.tenantId, ADMIN))
      .send({ leavePending: true, discount: { percent: 20, reason: 'Ajuste' } });

    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Con ese descuento lo ya pagado supera el total de la orden.');
  });

  it('valida y guarda los datos de facturación', async () => {
    const invalid = await request(app)
      .post(`/api/orders/${invoiceOrder.id}/payments`)
      .set(headers(fixture.tenantId, ADMIN))
      .send({
        leavePending: true,
        invoice: { rfc: 'NO-ES-RFC', name: 'Cliente QA', zip: '01000', use: 'G03' },
      });

    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error, 'El RFC no tiene un formato válido.');

    const saved = await request(app)
      .post(`/api/orders/${invoiceOrder.id}/payments`)
      .set(headers(fixture.tenantId, ADMIN))
      .send({
        leavePending: true,
        invoice: { rfc: 'abc010101ab1', name: 'Cliente QA', zip: '01000', use: 'G03' },
      });

    assert.equal(saved.status, 201);
    assert.equal(saved.body.invoice.rfc, 'ABC010101AB1');
    assert.equal(saved.body.invoice.name, 'Cliente QA');
    assert.equal(saved.body.invoice.zip, '01000');
    assert.ok(saved.body.logs.some((log: { action: string }) => log.action === 'Capturó datos de facturación'));
  });

  it('bloquea pagos cuando los resultados ya fueron entregados', async () => {
    const res = await request(app)
      .post(`/api/orders/${deliveredOrder.id}/payments`)
      .set(headers(fixture.tenantId, ADMIN))
      .send({ payments: [{ method: 'cash', amount: 10 }] });

    assert.equal(res.status, 409);
    assert.match(res.body.error, /ya se entregaron/);
  });

  it('solo un administrador puede cancelar un pago y el motivo es obligatorio', async () => {
    const forbidden = await request(app)
      .post(`/api/payments/${cancelOrder.payments[0].id}/cancel`)
      .set(headers(fixture.tenantId, RECEPCION))
      .send({ reason: 'Error de captura' });

    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.error, 'Tu rol no tiene permiso especial para cancelar pagos.');

    const withoutReason = await request(app)
      .post(`/api/payments/${cancelOrder.payments[0].id}/cancel`)
      .set(headers(fixture.tenantId, ADMIN))
      .send({ reason: '   ' });

    assert.equal(withoutReason.status, 400);
    assert.equal(withoutReason.body.error, 'El motivo de la cancelación es obligatorio.');

    const cancelled = await request(app)
      .post(`/api/payments/${cancelOrder.payments[0].id}/cancel`)
      .set(headers(fixture.tenantId, ADMIN))
      .send({ reason: 'Error de captura' });

    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.payments[0].cancelled, true);
    assert.equal(cancelled.body.paid, '0.00');
    assert.equal(cancelled.body.balance, '250.00');
    assert.equal(cancelled.body.logs[0].action, 'Canceló pago');
    assert.match(cancelled.body.logs[0].detail, /Error de captura/);

    const repeated = await request(app)
      .post(`/api/payments/${cancelOrder.payments[0].id}/cancel`)
      .set(headers(fixture.tenantId, ADMIN))
      .send({ reason: 'Otra vez' });

    assert.equal(repeated.status, 409);
    assert.equal(repeated.body.error, 'El pago ya estaba cancelado.');

    const unknown = await request(app)
      .post('/api/payments/999999999/cancel')
      .set(headers(fixture.tenantId, ADMIN))
      .send({ reason: 'No existe' });

    assert.equal(unknown.status, 404);
    assert.equal(unknown.body.error, 'El pago no existe');
  });

  it('no cancela pagos después de entregar resultados', async () => {
    const res = await request(app)
      .post(`/api/payments/${deliveredPaidOrder.payments[0].id}/cancel`)
      .set(headers(fixture.tenantId, ADMIN))
      .send({ reason: 'Tarde' });

    assert.equal(res.status, 409);
    assert.match(res.body.error, /después de entregar resultados/);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: deliveredPaidOrder.payments[0].id } });
    assert.equal(payment.cancelled, false);
  });
});
