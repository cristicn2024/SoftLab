import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { prisma } from '../prisma-pruebas';
import { closeDatabase, createScreenFixture, headers, type ScreenFixture } from './support';
import { construirAppNest } from './support-nest';

jest.setTimeout(30000);

// Pantalla "Recepción / Nueva orden" (HU-07 · HU 5.1)
// GET /concepts/search · GET /orders/check-open · POST /doctors/express · POST /orders

describe('Pantalla de nueva orden', () => {
  let app: INestApplication;
  let fixture: ScreenFixture;
  let testId = 0;
  let profileId = 0;
  let openPatientId = 0;
  let cleanPatientId = 0;

  beforeAll(async () => {
    app = await construirAppNest();
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

  afterAll(async () => {
    await app.close();
    await fixture.cleanup();
    await closeDatabase();
  });

  it('no consulta la base cuando la búsqueda viene vacía', async () => {
    const res = await request(app.getHttpServer()).get('/api/concepts/search?q=   ').set(headers(fixture.tenantId));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('busca estudios y perfiles activos por clave o nombre', async () => {
    const res = await request(app.getHttpServer()).get('/api/concepts/search?q=QA').set(headers(fixture.tenantId));

    expect(res.status).toBe(200);
    const test = res.body.find((item: { type: string }) => item.type === 'TEST');
    const profile = res.body.find((item: { type: string }) => item.type === 'PROFILE');

    expect(test).toBeTruthy();
    expect(test.id).toBe(testId);
    expect(test.code).toBe('BH-QA');
    expect(test.price).toBe(150);
    expect(test.includedTestIds).toEqual([testId]);

    expect(profile).toBeTruthy();
    expect(profile.id).toBe(profileId);
    expect(profile.code).toBe('PERF-QA');
    expect(profile.price).toBe(300);
    expect(profile.includedTestIds).toEqual([testId]);

    const inactive = res.body.find((item: { code: string }) => item.code === 'INACT-QA');
    expect(inactive).toBe(undefined);
  });

  it('no mezcla conceptos de otro laboratorio', async () => {
    const res = await request(app.getHttpServer()).get('/api/concepts/search?q=QA').set(headers(fixture.tenantId + 999999));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('avisa si el paciente ya tiene una orden pendiente hoy', async () => {
    const clean = await request(app.getHttpServer())
      .get(`/api/orders/check-open?patientId=${cleanPatientId}`)
      .set(headers(fixture.tenantId));
    expect(clean.status).toBe(200);
    expect(clean.body).toEqual({ hasOpenOrder: false, orderId: null });

    const invalid = await request(app.getHttpServer())
      .get('/api/orders/check-open?patientId=abc')
      .set(headers(fixture.tenantId));
    expect(invalid.status).toBe(200);
    expect(invalid.body).toEqual({ hasOpenOrder: false, orderId: null });

    const openOrder = await fixture.createOrder({ patientId: openPatientId, totalAmount: 10 });

    const open = await request(app.getHttpServer())
      .get(`/api/orders/check-open?patientId=${openPatientId}`)
      .set(headers(fixture.tenantId));
    expect(open.status).toBe(200);
    expect(open.body.hasOpenOrder).toBe(true);
    expect(open.body.orderId).toBe(openOrder.id);

    await prisma.order.update({ where: { id: openOrder.id }, data: { status: 'completed' } });

    const completed = await request(app.getHttpServer())
      .get(`/api/orders/check-open?patientId=${openPatientId}`)
      .set(headers(fixture.tenantId));
    expect(completed.body.hasOpenOrder).toBe(false);
  });

  it('registra un médico solicitante sin salir de la orden', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/doctors/express')
      .set(headers(fixture.tenantId))
      .send({ name: 'Dr. Roberto Salas QA', cedula: '12345678', specialty: 'Medicina General' });

    expect(res.status).toBe(201);
    expect(res.body.id > 0).toBeTruthy();
    expect(res.body.name).toBe('Dr. Roberto Salas QA');
    expect(res.body.cedula).toBe('12345678');
    expect(res.body.specialty).toBe('Medicina General');
    expect(res.body.tenantId).toBe(fixture.tenantId);
  });

  it('exige paciente y sucursal al confirmar la orden', async () => {
    const withoutPatient = await request(app.getHttpServer())
      .post('/api/orders')
      .set(headers(fixture.tenantId))
      .send({ branchId: fixture.branchId, items: [], totalAmount: 0 });
    expect(withoutPatient.status).toBe(422);
    expect(withoutPatient.body.error.mensaje).toBe('patientId es requerido');

    const withoutBranch = await request(app.getHttpServer())
      .post('/api/orders')
      .set(headers(fixture.tenantId))
      .send({ patientId: cleanPatientId, items: [], totalAmount: 0 });
    expect(withoutBranch.status).toBe(422);
    expect(withoutBranch.body.error.mensaje).toBe('branchId es requerido');
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

    const first = await request(app.getHttpServer()).post('/api/orders').set(headers(fixture.tenantId)).send(payload);
    expect(first.status).toBe(201);
    expect(first.body.success).toBe(true);
    expect(first.body.folio).toMatch(/^ORD-\d{8}-\d{4}$/);

    const second = await request(app.getHttpServer()).post('/api/orders').set(headers(fixture.tenantId)).send(payload);
    expect(second.status).toBe(201);
    expect(second.body.folio).not.toBe(first.body.folio);

    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: first.body.orderId },
      include: { items: true },
    });
    expect(stored.tenantId).toBe(fixture.tenantId);
    expect(stored.branchId).toBe(fixture.branchId);
    expect(stored.patientId).toBe(cleanPatientId);
    expect(stored.status).toBe('pending');
    expect(Number(stored.totalAmount)).toBe(450);
    expect(stored.items.length).toBe(2);

    const testItem = stored.items.find(item => item.testId === testId);
    const profileItem = stored.items.find(item => item.profileId === profileId);
    expect(testItem).toBeTruthy();
    expect(Number(testItem?.price)).toBe(150);
    expect(profileItem).toBeTruthy();
    expect(Number(profileItem?.price)).toBe(300);
  });
});
