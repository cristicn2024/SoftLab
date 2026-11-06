import test from 'node:test';
import assert from 'node:assert/strict';
import { ErrorDeDominio } from '../../../comun/errores';
import {
  BranchRequiredError,
  ConceptSearchFailedError,
  DoctorRegistrationFailedError,
  OpenOrderLookupFailedError,
  OrderConfirmationFailedError,
  PatientRequiredError,
} from './ordenes.errors';
import { catalogProfile, catalogTest, FakeRepository } from './ordenes.escenarios';
import { OrdenesService } from './ordenes.service';

const NOW = new Date(2026, 10, 3, 10, 0);

function setup() {
  const repository = new FakeRepository();
  repository.addTest(1, catalogTest(1, { code: 'BH-QA', name: 'Biometría hemática QA', price: 150 }));
  repository.addTest(2, catalogTest(2, { code: 'BH-OTRO', name: 'De otro laboratorio' }));
  repository.addProfile(1, catalogProfile(3, [1], { code: 'PERF-QA', name: 'Perfil QA' }));
  repository.addProfile(1, catalogProfile(4, [1], { code: 'INACT-QA', name: 'Perfil inactivo QA' }), false);
  return { repository, service: new OrdenesService(repository) };
}

test('una búsqueda vacía no consulta nada', async () => {
  const { repository, service } = setup();
  repository.failWith = new Error('no debía consultar');
  assert.deepEqual(await service.searchConcepts(1, '   '), []);
  assert.deepEqual(await service.searchConcepts(1, undefined), []);
});

test('busca estudios y perfiles activos solo del laboratorio', async () => {
  const { service } = setup();
  const concepts = await service.searchConcepts(1, 'QA');
  assert.deepEqual(concepts.map((c) => [c.type, c.code]), [['TEST', 'BH-QA'], ['PROFILE', 'PERF-QA']]);
  assert.deepEqual(await service.searchConcepts(99, 'QA'), []);
});

test('el límite es de 10 estudios y 5 perfiles', async () => {
  const repository = new FakeRepository();
  for (let id = 1; id <= 14; id++) repository.addTest(1, catalogTest(id, { name: `Glucosa ${id}` }));
  for (let id = 100; id <= 108; id++) repository.addProfile(1, catalogProfile(id, [1], { name: `Glucosa perfil ${id}` }));
  const concepts = await new OrdenesService(repository).searchConcepts(1, 'Glucosa');
  assert.equal(concepts.length, 15);
});

test('un fallo de la base se reporta con el mensaje de siempre', async () => {
  const { repository, service } = setup();
  repository.failWith = new Error('base caída');
  const consola = console.error;
  console.error = () => {};
  try {
    await assert.rejects(service.searchConcepts(1, 'QA'), ConceptSearchFailedError);
    await assert.rejects(service.checkOpenOrder(1, '5', NOW), OpenOrderLookupFailedError);
    await assert.rejects(service.registerDoctor({ tenantId: 1, name: 'Dr.' }), DoctorRegistrationFailedError);
    await assert.rejects(
      service.createOrder(1, { patientId: 1, branchId: 1 }, NOW),
      (error: unknown) => error instanceof OrderConfirmationFailedError && error.message === 'Error al confirmar la orden',
    );
  } finally {
    console.error = consola;
  }
});

test('avisa de la orden pendiente de hoy y no de las completadas ni de ayer', async () => {
  const { repository, service } = setup();
  assert.deepEqual(await service.checkOpenOrder(1, '5', NOW), { hasOpenOrder: false, orderId: null });
  assert.deepEqual(await service.checkOpenOrder(1, 'abc', NOW), { hasOpenOrder: false, orderId: null });
  assert.deepEqual(await service.checkOpenOrder(1, undefined, NOW), { hasOpenOrder: false, orderId: null });

  repository.addOrder(1, 5, 'pending', new Date(2026, 10, 2, 23, 0));
  assert.equal((await service.checkOpenOrder(1, '5', NOW)).hasOpenOrder, false);

  const abierta = repository.addOrder(1, 5, 'pending', new Date(2026, 10, 3, 8, 0));
  assert.deepEqual(await service.checkOpenOrder(1, '5', NOW), { hasOpenOrder: true, orderId: abierta.id });
  assert.equal((await service.checkOpenOrder(2, '5', NOW)).hasOpenOrder, false);

  abierta.status = 'completed';
  assert.equal((await service.checkOpenOrder(1, '5', NOW)).hasOpenOrder, false);
});

test('registra al médico con los datos que llegan', async () => {
  const { service } = setup();
  const doctor = await service.registerDoctor({ tenantId: 1, name: 'Dr. Roberto', cedula: '123', specialty: 'General' });
  assert.equal(doctor.id, 1);
  assert.equal(doctor.tenantId, 1);
  assert.equal(doctor.name, 'Dr. Roberto');
  assert.equal(doctor.cedula, '123');
  assert.equal(doctor.specialty, 'General');

  const sinDatos = await service.registerDoctor({ tenantId: 1, name: 'Dra. Ana' });
  assert.equal(sinDatos.cedula, null);
  assert.equal(sinDatos.specialty, null);
});

test('exige paciente y sucursal antes de tocar la base', async () => {
  const { repository, service } = setup();
  repository.failWith = new Error('no debía consultar');
  await assert.rejects(service.createOrder(1, { branchId: 1 }, NOW), PatientRequiredError);
  await assert.rejects(service.createOrder(1, { patientId: 'abc', branchId: 1 }, NOW), PatientRequiredError);
  await assert.rejects(service.createOrder(1, { patientId: 0, branchId: 1 }, NOW), PatientRequiredError);
  await assert.rejects(service.createOrder(1, { patientId: 5 }, NOW), BranchRequiredError);
  await assert.rejects(service.createOrder(1, { patientId: 5, branchId: 'x' }, NOW), BranchRequiredError);
  await assert.rejects(service.createOrder(1, {}, NOW), (e: unknown) => e instanceof PatientRequiredError && e.message === 'patientId es requerido');
});

test('crea la orden pendiente con sus estudios y perfiles y devuelve el folio', async () => {
  const { repository, service } = setup();
  const result = await service.createOrder(
    1,
    {
      patientId: '5',
      branchId: 1,
      doctorId: null,
      totalAmount: 450,
      items: [{ id: 1, type: 'TEST', price: 150 }, { id: 3, type: 'PROFILE', price: 300 }],
    },
    NOW,
  );
  assert.equal(result.success, true);
  assert.match(result.folio, /^ORD-\d{8}-0001$/);
  assert.equal(result.orderId, 1);

  const stored = repository.orders[0];
  assert.equal(stored.status, 'pending');
  assert.equal(stored.data.patientId, 5);
  assert.equal(stored.data.doctorId, null);
  assert.equal(stored.data.totalAmount, 450);
  assert.deepEqual(stored.data.items, [{ price: 150, testId: 1 }, { price: 300, profileId: 3 }]);
});

test('sin conceptos ni total crea la orden vacía con total cero', async () => {
  const { repository, service } = setup();
  await service.createOrder(1, { patientId: 5, branchId: 1, items: 'nada' }, NOW);
  assert.equal(repository.orders[0].data.totalAmount, 0);
  assert.deepEqual(repository.orders[0].data.items, []);
});

test('cada orden del día lleva el siguiente consecutivo y el médico se convierte a número', async () => {
  const { repository, service } = setup();
  const hoy = new Date();
  repository.addOrder(1, 9, 'pending', hoy);
  repository.addOrder(1, 9, 'completed', hoy);
  repository.addOrder(2, 9, 'pending', hoy);
  const result = await service.createOrder(1, { patientId: 5, branchId: 1, doctorId: '7' }, hoy);
  assert.match(result.folio, /-0003$/);
  assert.equal(repository.orders[repository.orders.length - 1].data.doctorId, 7);
});

test('un concepto con id inválido hace fallar toda la orden y no se guarda nada', async () => {
  const { repository, service } = setup();
  const consola = console.error;
  console.error = () => {};
  try {
    await assert.rejects(
      service.createOrder(1, { patientId: 5, branchId: 1, items: [{ id: 'x', type: 'TEST', price: 10 }] }, NOW),
      OrderConfirmationFailedError,
    );
    await assert.rejects(
      service.createOrder(1, { patientId: 5, branchId: 1, doctorId: 'x' }, NOW),
      OrderConfirmationFailedError,
    );
  } finally {
    console.error = consola;
  }
  assert.equal(repository.orders.length, 0);
});

test('todos los errores de órdenes son errores de dominio', () => {
  for (const error of [
    new PatientRequiredError(),
    new BranchRequiredError(),
    new ConceptSearchFailedError(),
    new OpenOrderLookupFailedError(),
    new DoctorRegistrationFailedError(),
    new OrderConfirmationFailedError(),
  ]) {
    assert.ok(error instanceof ErrorDeDominio);
  }
});
