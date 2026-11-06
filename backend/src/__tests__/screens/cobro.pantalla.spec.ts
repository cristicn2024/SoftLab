import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { prisma } from '../../config/db';
import { closeDatabase, createScreenFixture, headers, type ScreenFixture } from './support';
import { construirAppNest } from './support-nest';

// Pantalla "Cobro de la orden" (HU 5.3)
// GET /orders/:id/billing · POST /orders/:id/payments · POST /payments/:id/cancel

jest.setTimeout(30000);

const ADMIN = { 'x-user-name': 'Administradora QA', 'x-user-role': 'admin' };
const RECEPCION = { 'x-user-name': 'Recepcionista QA', 'x-user-role': 'receptionist' };

describe('Pantalla de cobro', () => {
  let app: INestApplication;
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

  beforeAll(async () => {
    app = await construirAppNest();
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

  afterAll(async () => {
    await app.close();
    await fixture.cleanup();
    await closeDatabase();
  });

  it('muestra el total, el saldo y los conceptos de la orden', async () => {
    const res = await request(app.getHttpServer()).get(`/api/orders/${billingOrder.id}/billing`).set(headers(fixture.tenantId));

    expect(res.status).toBe(200);
    expect(res.body.folio).toBe(`SL-${String(billingOrder.id).padStart(6, '0')}`);
    expect(res.body.patient.name).toBe(`Paciente cobro`);
    expect(res.body.patient.record).toBe(`P-${String(fixture.patient.id).padStart(6, '0')}`);
    expect(res.body.patient.gender).toBe('Mujer');
    expect(res.body.items.length).toBe(2);
    expect(res.body.subtotal).toBe('250.00');
    expect(res.body.total).toBe('250.00');
    expect(res.body.paid).toBe('0.00');
    expect(res.body.balance).toBe('250.00');
    expect(res.body.resultsDelivered).toBe(false);
    expect(res.body.payments).toEqual([]);
  });

  it('responde 404 cuando la orden no existe', async () => {
    const res = await request(app.getHttpServer()).get('/api/orders/999999999/billing').set(headers(fixture.tenantId));
    expect(res.status).toBe(404);
    expect(res.body.error.mensaje).toBe('La orden no existe');
  });

  it('registra un pago en efectivo, calcula el cambio y deja saldo cero', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/orders/${paymentOrder.id}/payments`)
      .set(headers(fixture.tenantId, ADMIN))
      .send({ payments: [{ method: 'cash', amount: 250 }], cashReceived: 300 });

    expect(res.status).toBe(201);
    expect(res.body.paid).toBe('250.00');
    expect(res.body.balance).toBe('0.00');
    expect(res.body.payments.length).toBe(1);
    expect(res.body.payments[0].method).toBe('cash');
    expect(res.body.logs[0].action).toBe('Registró pago');
    expect(res.body.logs[0].detail).toMatch(/cambio \$50\.00/);

    const finalBalanceCheck = await request(app.getHttpServer())
      .post(`/api/orders/${paymentOrder.id}/payments`)
      .set(headers(fixture.tenantId, ADMIN))
      .send({ payments: [{ method: 'cash', amount: 1 }] });
    expect(finalBalanceCheck.status).toBe(422);
    expect(finalBalanceCheck.body.error.mensaje).toBe('Los pagos superan el saldo por cobrar.');
  });

  it('acumula pagos parciales hasta liquidar la orden', async () => {
    const first = await request(app.getHttpServer())
      .post(`/api/orders/${partialOrder.id}/payments`)
      .set(headers(fixture.tenantId, ADMIN))
      .send({ payments: [{ method: 'cash', amount: 100 }] });

    expect(first.status).toBe(201);
    expect(first.body.paid).toBe('100.00');
    expect(first.body.balance).toBe('150.00');

    const second = await request(app.getHttpServer())
      .post(`/api/orders/${partialOrder.id}/payments`)
      .set(headers(fixture.tenantId, ADMIN))
      .send({ payments: [{ method: 'card', amount: 150, reference: 'AUTH-123' }] });

    expect(second.status).toBe(201);
    expect(second.body.paid).toBe('250.00');
    expect(second.body.balance).toBe('0.00');
    expect(second.body.payments[1].method).toBe('card');
    expect(second.body.payments[1].reference).toBe('AUTH-123');
  });

  it('exige referencia en pagos con tarjeta o transferencia', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/orders/${billingOrder.id}/payments`)
      .set(headers(fixture.tenantId, ADMIN))
      .send({ payments: [{ method: 'card', amount: 10 }] });

    expect(res.status).toBe(422);
    expect(res.body.error.mensaje).toBe('Falta la referencia del pago con tarjeta.');
  });

  it('permite dejar la orden pendiente sin capturar montos', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/orders/${pendingOrder.id}/payments`)
      .set(headers(fixture.tenantId, ADMIN))
      .send({ leavePending: true });

    expect(res.status).toBe(201);
    expect(res.body.balance).toBe('250.00');
    expect(res.body.logs.some((log: { action: string }) => log.action === 'Orden pendiente de pago')).toBeTruthy();
  });

  it('solo un administrador puede aplicar descuentos y siempre requiere motivo', async () => {
    const forbidden = await request(app.getHttpServer())
      .post(`/api/orders/${discountOrder.id}/payments`)
      .set(headers(fixture.tenantId, RECEPCION))
      .send({ leavePending: true, discount: { percent: 10, reason: 'Convenio' } });

    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.mensaje).toBe('Tu rol no tiene permiso para aplicar descuentos.');

    const withoutReason = await request(app.getHttpServer())
      .post(`/api/orders/${discountOrder.id}/payments`)
      .set(headers(fixture.tenantId, ADMIN))
      .send({ leavePending: true, discount: { percent: 10 } });

    expect(withoutReason.status).toBe(422);
    expect(withoutReason.body.error.mensaje).toBe('El descuento requiere un motivo.');

    const invalidPercent = await request(app.getHttpServer())
      .post(`/api/orders/${discountOrder.id}/payments`)
      .set(headers(fixture.tenantId, ADMIN))
      .send({ leavePending: true, discount: { percent: 7, reason: 'Convenio' } });

    expect(invalidPercent.status).toBe(422);
    expect(invalidPercent.body.error.mensaje).toBe('Porcentaje de descuento no válido.');

    const applied = await request(app.getHttpServer())
      .post(`/api/orders/${discountOrder.id}/payments`)
      .set(headers(fixture.tenantId, ADMIN))
      .send({ leavePending: true, discount: { percent: 10, reason: 'Convenio' } });

    expect(applied.status).toBe(201);
    expect(applied.body.discount.percent).toBe(10);
    expect(applied.body.discount.reason).toBe('Convenio');
    expect(applied.body.discount.authorizedBy).toBe('Administradora QA');
    expect(applied.body.total).toBe('225.00');
    expect(applied.body.logs.some((log: { action: string }) => log.action === 'Aplicó descuento')).toBeTruthy();
  });

  it('rechaza pagos que superan el saldo después del descuento', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/orders/${discountOrder.id}/payments`)
      .set(headers(fixture.tenantId, ADMIN))
      .send({ payments: [{ method: 'cash', amount: 300 }] });

    expect(res.status).toBe(422);
    expect(res.body.error.mensaje).toBe('Los pagos superan el saldo por cobrar.');
  });

  it('no permite que un descuento deje el total por debajo de lo ya pagado', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/orders/${paymentOrder.id}/payments`)
      .set(headers(fixture.tenantId, ADMIN))
      .send({ leavePending: true, discount: { percent: 20, reason: 'Ajuste' } });

    expect(res.status).toBe(422);
    expect(res.body.error.mensaje).toBe('Con ese descuento lo ya pagado supera el total de la orden.');
  });

  it('valida y guarda los datos de facturación', async () => {
    const invalid = await request(app.getHttpServer())
      .post(`/api/orders/${invoiceOrder.id}/payments`)
      .set(headers(fixture.tenantId, ADMIN))
      .send({
        leavePending: true,
        invoice: { rfc: 'NO-ES-RFC', name: 'Cliente QA', zip: '01000', use: 'G03' },
      });

    expect(invalid.status).toBe(422);
    expect(invalid.body.error.mensaje).toBe('El RFC no tiene un formato válido.');

    const saved = await request(app.getHttpServer())
      .post(`/api/orders/${invoiceOrder.id}/payments`)
      .set(headers(fixture.tenantId, ADMIN))
      .send({
        leavePending: true,
        invoice: { rfc: 'abc010101ab1', name: 'Cliente QA', zip: '01000', use: 'G03' },
      });

    expect(saved.status).toBe(201);
    expect(saved.body.invoice.rfc).toBe('ABC010101AB1');
    expect(saved.body.invoice.name).toBe('Cliente QA');
    expect(saved.body.invoice.zip).toBe('01000');
    expect(saved.body.logs.some((log: { action: string }) => log.action === 'Capturó datos de facturación')).toBeTruthy();
  });

  it('bloquea pagos cuando los resultados ya fueron entregados', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/orders/${deliveredOrder.id}/payments`)
      .set(headers(fixture.tenantId, ADMIN))
      .send({ payments: [{ method: 'cash', amount: 10 }] });

    expect(res.status).toBe(409);
    expect(res.body.error.mensaje).toMatch(/ya se entregaron/);
  });

  it('solo un administrador puede cancelar un pago y el motivo es obligatorio', async () => {
    const forbidden = await request(app.getHttpServer())
      .post(`/api/payments/${cancelOrder.payments[0].id}/cancel`)
      .set(headers(fixture.tenantId, RECEPCION))
      .send({ reason: 'Error de captura' });

    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.mensaje).toBe('Tu rol no tiene permiso especial para cancelar pagos.');

    const withoutReason = await request(app.getHttpServer())
      .post(`/api/payments/${cancelOrder.payments[0].id}/cancel`)
      .set(headers(fixture.tenantId, ADMIN))
      .send({ reason: '   ' });

    expect(withoutReason.status).toBe(422);
    expect(withoutReason.body.error.mensaje).toBe('El motivo de la cancelación es obligatorio.');

    const cancelled = await request(app.getHttpServer())
      .post(`/api/payments/${cancelOrder.payments[0].id}/cancel`)
      .set(headers(fixture.tenantId, ADMIN))
      .send({ reason: 'Error de captura' });

    expect(cancelled.status).toBe(200);
    expect(cancelled.body.payments[0].cancelled).toBe(true);
    expect(cancelled.body.paid).toBe('0.00');
    expect(cancelled.body.balance).toBe('250.00');
    expect(cancelled.body.logs[0].action).toBe('Canceló pago');
    expect(cancelled.body.logs[0].detail).toMatch(/Error de captura/);

    const repeated = await request(app.getHttpServer())
      .post(`/api/payments/${cancelOrder.payments[0].id}/cancel`)
      .set(headers(fixture.tenantId, ADMIN))
      .send({ reason: 'Otra vez' });

    expect(repeated.status).toBe(409);
    expect(repeated.body.error.mensaje).toBe('El pago ya estaba cancelado.');

    const unknown = await request(app.getHttpServer())
      .post('/api/payments/999999999/cancel')
      .set(headers(fixture.tenantId, ADMIN))
      .send({ reason: 'No existe' });

    expect(unknown.status).toBe(404);
    expect(unknown.body.error.mensaje).toBe('El pago no existe');
  });

  it('no cancela pagos después de entregar resultados', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/payments/${deliveredPaidOrder.payments[0].id}/cancel`)
      .set(headers(fixture.tenantId, ADMIN))
      .send({ reason: 'Tarde' });

    expect(res.status).toBe(409);
    expect(res.body.error.mensaje).toMatch(/después de entregar resultados/);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: deliveredPaidOrder.payments[0].id } });
    expect(payment.cancelled).toBe(false);
  });
});
