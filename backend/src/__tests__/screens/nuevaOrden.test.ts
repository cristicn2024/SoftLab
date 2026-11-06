import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import orderCaptureRoutes from '../../routes/orderCapture.routes';
import { prisma } from '../../config/db';
import { buildApp, closeDatabase, createScreenFixture, headers, type ScreenFixture } from './support';

// Pantalla "Recepción / Nueva orden" (HU-07 · HU 5.1)
// GET /concepts/search · GET /orders/check-open · POST /doctors/express · POST /orders

const app = buildApp(orderCaptureRoutes);

describe('Pantalla de nueva orden', () => {
  let fixture: ScreenFixture;
  let testId = 0;
  let profileId = 0;
  let openPatientId = 0;
  let cleanPatientId = 0;

  before(async () => {
    fixture = await createScreenFixture('orden');

    const test = await prisma.testCatalog.create({
      data: {
        tenantId: fixture.tenantId,
        code: 'BH-QA',
        name: 'Biometría hemática QA',
        price: 150,
        sampleType: 'Sangre',
      },
    });
    testId = test.id;

    const profile = await prisma.profileCatalog.create({
      data: {
        tenantId: fixture.tenantId,
        code: 'PERF-QA',
        name: 'Perfil QA',
        price: 300,
        tests: { create: [{ testId: test.id }] },
      },
    });
    profileId = profile.id;

    await prisma.profileCatalog.create({
      data: {
        tenantId: fixture.tenantId,
        code: 'INACT-QA',
        name: 'Perfil inactivo QA',
        price: 999,
        status: false,
      },
    });

    const openPatient = await prisma.patient.create({
      data: {
        tenantId: fixture.tenantId,
        firstName: 'Paciente',
        lastName: 'Con orden abierta',
        birthDate: new Date(1985, 4, 20),
        gender: 'M',
        patientCode: `P-ABIERTA-${Date.now()}`,
      },
    });
    openPatientId = openPatient.id;

    const cleanPatient = await prisma.patient.create({
      data: {
        tenantId: fixture.tenantId,
        firstName: 'Paciente',
        lastName: 'Sin orden',
        birthDate: new Date(1992, 7, 10),
        gender: 'F',
        patientCode: `P-LIMPIA-${Date.now()}`,
      },
    });
    cleanPatientId = cleanPatient.id;
  });

  after(async () => {
    await fixture.cleanup();
    await closeDatabase();
  });

  it('no consulta la base cuando la búsqueda viene vacía', async () => {
    const res = await request(app).get('/api/concepts/search?q=   ').set(headers(fixture.tenantId));
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  it('busca estudios y perfiles activos por clave o nombre', async () => {
    const res = await request(app).get('/api/concepts/search?q=QA').set(headers(fixture.tenantId));

    assert.equal(res.status, 200);
    const test = res.body.find((item: { type: string }) => item.type === 'TEST');
    const profile = res.body.find((item: { type: string }) => item.type === 'PROFILE');

    assert.ok(test);
    assert.equal(test.id, testId);
    assert.equal(test.code, 'BH-QA');
    assert.equal(test.price, 150);
    assert.deepEqual(test.includedTestIds, [testId]);

    assert.ok(profile);
    assert.equal(profile.id, profileId);
    assert.equal(profile.code, 'PERF-QA');
    assert.equal(profile.price, 300);
    assert.deepEqual(profile.includedTestIds, [testId]);

    const inactive = res.body.find((item: { code: string }) => item.code === 'INACT-QA');
    assert.equal(inactive, undefined);
  });

  it('no mezcla conceptos de otro laboratorio', async () => {
    const res = await request(app).get('/api/concepts/search?q=QA').set(headers(fixture.tenantId + 999999));
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  it('avisa si el paciente ya tiene una orden pendiente hoy', async () => {
    const clean = await request(app)
      .get(`/api/orders/check-open?patientId=${cleanPatientId}`)
      .set(headers(fixture.tenantId));
    assert.equal(clean.status, 200);
    assert.deepEqual(clean.body, { hasOpenOrder: false, orderId: null });

    const invalid = await request(app)
      .get('/api/orders/check-open?patientId=abc')
      .set(headers(fixture.tenantId));
    assert.equal(invalid.status, 200);
    assert.deepEqual(invalid.body, { hasOpenOrder: false, orderId: null });

    const openOrder = await fixture.createOrder({ patientId: openPatientId, totalAmount: 10 });

    const open = await request(app)
      .get(`/api/orders/check-open?patientId=${openPatientId}`)
      .set(headers(fixture.tenantId));
    assert.equal(open.status, 200);
    assert.equal(open.body.hasOpenOrder, true);
    assert.equal(open.body.orderId, openOrder.id);

    await prisma.order.update({ where: { id: openOrder.id }, data: { status: 'completed' } });

    const completed = await request(app)
      .get(`/api/orders/check-open?patientId=${openPatientId}`)
      .set(headers(fixture.tenantId));
    assert.equal(completed.body.hasOpenOrder, false);
  });

  it('registra un médico solicitante sin salir de la orden', async () => {
    const res = await request(app)
      .post('/api/doctors/express')
      .set(headers(fixture.tenantId))
      .send({ name: 'Dr. Roberto Salas QA', cedula: '12345678', specialty: 'Medicina General' });

    assert.equal(res.status, 201);
    assert.ok(res.body.id > 0);
    assert.equal(res.body.name, 'Dr. Roberto Salas QA');
    assert.equal(res.body.cedula, '12345678');
    assert.equal(res.body.specialty, 'Medicina General');
    assert.equal(res.body.tenantId, fixture.tenantId);
  });

  it('exige paciente y sucursal al confirmar la orden', async () => {
    const withoutPatient = await request(app)
      .post('/api/orders')
      .set(headers(fixture.tenantId))
      .send({ branchId: fixture.branchId, items: [], totalAmount: 0 });
    assert.equal(withoutPatient.status, 400);
    assert.equal(withoutPatient.body.error, 'patientId es requerido');

    const withoutBranch = await request(app)
      .post('/api/orders')
      .set(headers(fixture.tenantId))
      .send({ patientId: cleanPatientId, items: [], totalAmount: 0 });
    assert.equal(withoutBranch.status, 400);
    assert.equal(withoutBranch.body.error, 'branchId es requerido');
  });

  it('genera un folio único y guarda estudios y perfiles en la orden', async () => {
    const payload = {
      patientId: cleanPatientId,
      branchId: fixture.branchId,
      doctorId: null,
      totalAmount: 450,
      items: [
        { id: testId, type: 'TEST', code: 'BH-QA', name: 'Biometría hemática QA', price: 150 },
        { id: profileId, type: 'PROFILE', code: 'PERF-QA', name: 'Perfil QA', price: 300 },
      ],
    };

    const first = await request(app).post('/api/orders').set(headers(fixture.tenantId)).send(payload);
    assert.equal(first.status, 201);
    assert.equal(first.body.success, true);
    assert.match(first.body.folio, /^ORD-\d{8}-\d{4}$/);

    const second = await request(app).post('/api/orders').set(headers(fixture.tenantId)).send(payload);
    assert.equal(second.status, 201);
    assert.notEqual(second.body.folio, first.body.folio);

    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: first.body.orderId },
      include: { items: true },
    });
    assert.equal(stored.tenantId, fixture.tenantId);
    assert.equal(stored.branchId, fixture.branchId);
    assert.equal(stored.patientId, cleanPatientId);
    assert.equal(stored.status, 'pending');
    assert.equal(Number(stored.totalAmount), 450);
    assert.equal(stored.items.length, 2);

    const testItem = stored.items.find(item => item.testId === testId);
    const profileItem = stored.items.find(item => item.profileId === profileId);
    assert.ok(testItem);
    assert.equal(Number(testItem.price), 150);
    assert.ok(profileItem);
    assert.equal(Number(profileItem.price), 300);
  });
});
