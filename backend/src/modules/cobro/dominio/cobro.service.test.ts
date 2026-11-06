import test from 'node:test';
import assert from 'node:assert/strict';
import { ErrorDeDominio } from '../../../comun/errores';
import {
  BillingOrderNotFoundError,
  CancelNotAllowedError,
  CancelReasonRequiredError,
  DiscountNotAllowedError,
  InvalidDiscountError,
  InvalidInvoiceError,
  InvalidPaymentError,
  PaymentAlreadyCancelledError,
  PaymentNotFoundError,
  ResultsAlreadyDeliveredError,
} from './cobro.errors';
import { FakeRepository, order } from './cobro.escenarios';
import { CobroService } from './cobro.service';
import type { Actor } from './cobro.types';

const TODAY = new Date(2026, 10, 3);
const ADMIN: Actor = { tenantId: 1, name: 'Administradora QA', isAdmin: true };
const RECEPCION: Actor = { tenantId: 1, name: 'Recepcionista QA', isAdmin: false };

function setup() {
  const repository = new FakeRepository();
  repository.add(1, order(1));
  repository.add(1, order(2));
  repository.add(1, order(3, { payments: [{ method: 'cash', amount: 100, reference: 'Caja 1' }] }));
  repository.add(1, order(6, { payments: [{ method: 'cash', amount: 250 }] }));
  repository.add(1, order(4, { resultsDeliveredAt: new Date(2026, 10, 1) }));
  repository.add(2, order(5));
  return { repository, service: new CobroService(repository) };
}

test('el cobro muestra total, saldo y conceptos', async () => {
  const { service } = setup();
  const billing = await service.getBilling(1, 1, TODAY);
  assert.equal(billing.folio, 'SL-000001');
  assert.equal(billing.patient.record, 'P-000010');
  assert.equal(billing.patient.gender, 'Mujer');
  assert.equal(billing.patient.age, 36);
  assert.equal(billing.subtotal, '250.00');
  assert.equal(billing.total, '250.00');
  assert.equal(billing.paid, '0.00');
  assert.equal(billing.balance, '250.00');
  assert.equal(billing.items.length, 2);
  assert.equal(billing.resultsDelivered, false);
});

test('una orden de otro laboratorio o inexistente da 404', async () => {
  const { service } = setup();
  await assert.rejects(service.getBilling(1, 5, TODAY), BillingOrderNotFoundError);
  await assert.rejects(service.getBilling(1, 999, TODAY), BillingOrderNotFoundError);
  await assert.rejects(
    service.registerPayments(ADMIN, 5, { payments: [{ method: 'cash', amount: 10 }] }, TODAY),
    BillingOrderNotFoundError,
  );
});

test('un pago en efectivo calcula el cambio y deja saldo cero', async () => {
  const { service } = setup();
  const billing = await service.registerPayments(
    ADMIN,
    1,
    { payments: [{ method: 'cash', amount: 250 }], cashReceived: 300 },
    TODAY,
  );
  assert.equal(billing.paid, '250.00');
  assert.equal(billing.balance, '0.00');
  assert.equal(billing.payments[0].method, 'cash');
  assert.equal(billing.logs[0].action, 'Registró pago');
  assert.match(billing.logs[0].detail, /cambio \$50\.00/);
  await assert.rejects(
    service.registerPayments(ADMIN, 1, { payments: [{ method: 'cash', amount: 1 }] }, TODAY),
    (error: Error) => error instanceof InvalidPaymentError && error.message === 'Los pagos superan el saldo por cobrar.',
  );
});

test('los pagos parciales se acumulan', async () => {
  const { service } = setup();
  const first = await service.registerPayments(ADMIN, 2, { payments: [{ method: 'cash', amount: 100 }] }, TODAY);
  assert.equal(first.balance, '150.00');
  const second = await service.registerPayments(
    ADMIN,
    2,
    { payments: [{ method: 'card', amount: 150, reference: 'AUTH-123' }] },
    TODAY,
  );
  assert.equal(second.paid, '250.00');
  assert.equal(second.payments[1].reference, 'AUTH-123');
});

test('tarjeta y transferencia exigen referencia', async () => {
  const { service } = setup();
  await assert.rejects(
    service.registerPayments(ADMIN, 1, { payments: [{ method: 'card', amount: 10 }] }, TODAY),
    (error: Error) => error.message === 'Falta la referencia del pago con tarjeta.',
  );
  await assert.rejects(
    service.registerPayments(ADMIN, 1, { payments: [{ method: 'transfer', amount: 10 }] }, TODAY),
    (error: Error) => error.message === 'Falta la referencia del pago con transferencia.',
  );
  await assert.rejects(
    service.registerPayments(ADMIN, 1, { payments: [{ method: 'bitcoin', amount: 10 }] }, TODAY),
    (error: Error) => error.message === 'Método de pago no válido.',
  );
});

test('se puede dejar la orden pendiente y sin monto no se registra', async () => {
  const { service } = setup();
  const billing = await service.registerPayments(ADMIN, 1, { leavePending: true }, TODAY);
  assert.equal(billing.balance, '250.00');
  assert.equal(billing.logs[0].action, 'Orden pendiente de pago');
  await assert.rejects(
    service.registerPayments(ADMIN, 2, {}, TODAY),
    (error: Error) => error.message === 'Captura al menos un monto para registrar el pago.',
  );
});

test('solo un administrador aplica descuentos y con motivo', async () => {
  const { service } = setup();
  await assert.rejects(
    service.registerPayments(RECEPCION, 1, { leavePending: true, discount: { percent: 10, reason: 'Convenio' } }, TODAY),
    DiscountNotAllowedError,
  );
  await assert.rejects(
    service.registerPayments(ADMIN, 1, { leavePending: true, discount: { percent: 10 } }, TODAY),
    (error: Error) => error instanceof InvalidDiscountError && error.message === 'El descuento requiere un motivo.',
  );
  await assert.rejects(
    service.registerPayments(ADMIN, 1, { leavePending: true, discount: { percent: 7, reason: 'x' } }, TODAY),
    (error: Error) => error.message === 'Porcentaje de descuento no válido.',
  );
  const billing = await service.registerPayments(
    ADMIN,
    1,
    { leavePending: true, discount: { percent: 10, reason: 'Convenio' } },
    TODAY,
  );
  assert.equal(billing.discount.authorizedBy, 'Administradora QA');
  assert.equal(billing.total, '225.00');
  assert.equal(billing.logs[0].action, 'Orden pendiente de pago');
  assert.equal(billing.logs[1].action, 'Aplicó descuento');
});

test('un descuento no puede dejar el total debajo de lo ya pagado', async () => {
  const { service } = setup();
  await assert.rejects(
    service.registerPayments(ADMIN, 6, { leavePending: true, discount: { percent: 20, reason: 'Ajuste' } }, TODAY),
    (error: Error) => error.message === 'Con ese descuento lo ya pagado supera el total de la orden.',
  );
});

test('valida y guarda los datos de facturación', async () => {
  const { service } = setup();
  await assert.rejects(
    service.registerPayments(ADMIN, 1, { leavePending: true, invoice: { rfc: 'NO-ES-RFC', name: 'QA', zip: '01000' } }, TODAY),
    (error: Error) => error instanceof InvalidInvoiceError && error.message === 'El RFC no tiene un formato válido.',
  );
  await assert.rejects(
    service.registerPayments(ADMIN, 1, { leavePending: true, invoice: { rfc: 'ABC010101AB1', name: ' ', zip: '01000' } }, TODAY),
    (error: Error) => error.message === 'Falta el nombre o razón social para la factura.',
  );
  await assert.rejects(
    service.registerPayments(ADMIN, 1, { leavePending: true, invoice: { rfc: 'ABC010101AB1', name: 'QA', zip: '1000' } }, TODAY),
    (error: Error) => error.message === 'El código postal fiscal debe tener 5 dígitos.',
  );
  const billing = await service.registerPayments(
    ADMIN,
    1,
    { leavePending: true, invoice: { rfc: 'abc010101ab1', name: 'Cliente QA', zip: '01000', use: 'G03' } },
    TODAY,
  );
  assert.equal(billing.invoice?.rfc, 'ABC010101AB1');
  assert.equal(billing.logs[0].action, 'Capturó datos de facturación');
});

test('con resultados entregados no se registran pagos', async () => {
  const { service } = setup();
  await assert.rejects(
    service.registerPayments(ADMIN, 4, { payments: [{ method: 'cash', amount: 10 }] }, TODAY),
    ResultsAlreadyDeliveredError,
  );
});

test('cancelar un pago exige administrador y motivo, y no se repite', async () => {
  const { service } = setup();
  await assert.rejects(service.cancelPayment(RECEPCION, 301, 'Error', TODAY), CancelNotAllowedError);
  await assert.rejects(service.cancelPayment(ADMIN, 301, '   ', TODAY), CancelReasonRequiredError);
  const billing = await service.cancelPayment(ADMIN, 301, 'Error de captura', TODAY);
  assert.equal(billing.payments[0].cancelled, true);
  assert.equal(billing.paid, '0.00');
  assert.equal(billing.balance, '250.00');
  assert.equal(billing.logs[0].action, 'Canceló pago');
  assert.match(billing.logs[0].detail, /Error de captura/);
  await assert.rejects(service.cancelPayment(ADMIN, 301, 'Otra vez', TODAY), PaymentAlreadyCancelledError);
  await assert.rejects(service.cancelPayment(ADMIN, 999999, 'No existe', TODAY), PaymentNotFoundError);
});

test('todos los errores de cobro son errores de dominio', async () => {
  const { service } = setup();
  await assert.rejects(service.getBilling(1, 999, TODAY), ErrorDeDominio);
});
