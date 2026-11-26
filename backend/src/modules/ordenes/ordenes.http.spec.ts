import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configurarApp } from '../../__tests__/sesion-de-prueba';
import { catalogProfile, catalogTest, FakeRepository } from './dominio/ordenes.escenarios';
import { OrdenesModule } from './ordenes.module';
import { ORDENES_REPOSITORY } from './ordenes.tokens';
import { PrismaService } from '../../prisma/prisma.service';

const TENANT = { 'x-tenant-id': '1' };

describe('API de nueva orden', () => {
  let app: INestApplication;
  let repositorio: FakeRepository;

  beforeEach(async () => {
    repositorio = new FakeRepository();
    repositorio.addTest(1, catalogTest(1, { code: 'BH-QA', name: 'Biometría hemática QA', price: 150 }));
    repositorio.addTest(2, catalogTest(2, { code: 'BH-OTRO', name: 'QA de otro laboratorio' }));
    repositorio.addProfile(1, catalogProfile(3, [1], { code: 'PERF-QA', name: 'Perfil QA', price: 300 }));
    repositorio.addProfile(1, catalogProfile(4, [1], { code: 'INACT-QA', name: 'Perfil inactivo QA' }), false);

    const prisma = {
      patient: { findFirst: jest.fn(async ({ where }: { where: { id: number } }) => ({ id: where.id, gender: where.id === 6 ? 'M' : 'F' })) },
      branch: { findFirst: jest.fn(async () => ({ id: 1 })) },
      doctor: { findFirst: jest.fn(async () => ({ id: 7 })) },
      testCatalog: { findMany: jest.fn(async ({ where }: { where: { id: { in: number[] } } }) => where.id.in.map((id) => ({ id, tenantId: 1, status: true, code: `T-${id}`, name: `Estudio ${id}`, sampleType: 'Sangre', containerType: id === 1 ? 'Tubo rojo' : null, sampleVolume: null, sampleVolumeUnit: null, fastingHours: null, preparationInstructions: null, medicationWarnings: null, additionalInstructions: null, genderRestriction: id === 5 ? 'F' : 'BOTH' }))) },
      profileCatalog: { findMany: jest.fn(async ({ where }: { where: { id: { in: number[] } } }) => where.id.in.map((id) => ({ id, tenantId: 1, status: true, name: `Perfil ${id}`, tests: [{ testId: 1, test: { id: 1, tenantId: 1, status: true, code: 'T-1', name: 'Estudio 1', sampleType: 'Sangre', containerType: 'Tubo rojo', sampleVolume: null, sampleVolumeUnit: null, fastingHours: null, preparationInstructions: null, medicationWarnings: null, additionalInstructions: null, genderRestriction: 'BOTH' } }] }))) },
    };

    const modulo = await Test.createTestingModule({ imports: [OrdenesModule] })
      .overrideProvider(ORDENES_REPOSITORY)
      .useValue(repositorio)
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = modulo.createNestApplication();
    configurarApp(app as never);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('exige el encabezado x-tenant-id en todas las rutas', async () => {
    const server = app.getHttpServer();
    expect((await request(server).get('/api/concepts/search?q=QA')).status).toBe(400);
    expect((await request(server).get('/api/orders/check-open?patientId=1')).status).toBe(400);
    expect((await request(server).post('/api/doctors/express').send({ name: 'Dr.' })).status).toBe(400);
    const res = await request(server).post('/api/orders').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.mensaje).toBe('Falta el encabezado x-tenant-id con el id del laboratorio.');
  });

  it('lista los médicos solicitantes del laboratorio para el select de Nueva orden', async () => {
    await request(app.getHttpServer()).post('/api/doctors/express').set(TENANT).send({ name: 'Dra. Patricia Ruiz' });
    await request(app.getHttpServer()).post('/api/doctors/express').set({ 'x-tenant-id': '2' }).send({ name: 'Dr. Ajeno' });
    const res = await request(app.getHttpServer()).get('/api/doctors').set(TENANT);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Dra. Patricia Ruiz');
    expect((await request(app.getHttpServer()).get('/api/doctors')).status).toBe(400);
  });

  it('busca conceptos con la forma que usa el front y sin mezclar laboratorios', async () => {
    const vacia = await request(app.getHttpServer()).get('/api/concepts/search?q=%20%20').set(TENANT);
    expect(vacia.status).toBe(200);
    expect(vacia.body).toEqual([]);

    const sinQ = await request(app.getHttpServer()).get('/api/concepts/search').set(TENANT);
    expect(sinQ.body).toEqual([]);

    const res = await request(app.getHttpServer()).get('/api/concepts/search?q=QA').set(TENANT);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: 1, type: 'TEST', code: 'BH-QA', name: 'Biometría hemática QA', price: 150, genderRestriction: 'BOTH', includedTestIds: [1] },
      { id: 3, type: 'PROFILE', code: 'PERF-QA', name: 'Perfil QA', price: 300, genderRestriction: 'BOTH', includedTestIds: [1] },
    ]);

    const otro = await request(app.getHttpServer()).get('/api/concepts/search?q=QA').set({ 'x-tenant-id': '999' });
    expect(otro.body).toEqual([]);
  });

  it('responde si el paciente tiene una orden pendiente hoy', async () => {
    const limpio = await request(app.getHttpServer()).get('/api/orders/check-open?patientId=5').set(TENANT);
    expect(limpio.status).toBe(200);
    expect(limpio.body).toEqual({ hasOpenOrder: false, orderId: null });

    for (const consulta of ['', '?patientId=abc', '?patientId=0']) {
      const res = await request(app.getHttpServer()).get(`/api/orders/check-open${consulta}`).set(TENANT);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ hasOpenOrder: false, orderId: null });
    }

    const abierta = repositorio.addOrder(1, 5, 'pending', new Date());
    const res = await request(app.getHttpServer()).get('/api/orders/check-open?patientId=5').set(TENANT);
    expect(res.body).toEqual({ hasOpenOrder: true, orderId: abierta.id });
  });

  it('registra un médico solicitante y responde 201 con el registro', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/doctors/express')
      .set(TENANT)
      .send({ name: 'Dr. Roberto Salas QA', cedula: '12345678', specialty: 'Medicina General' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(1);
    expect(res.body.tenantId).toBe(1);
    expect(res.body.name).toBe('Dr. Roberto Salas QA');
    expect(res.body.cedula).toBe('12345678');
    expect(res.body.specialty).toBe('Medicina General');

    const vacios = await request(app.getHttpServer())
      .post('/api/doctors/express')
      .set(TENANT)
      .send({ name: 'Dra. Ana', cedula: '', specialty: null });
    expect(vacios.status).toBe(201);
    expect(vacios.body.cedula).toBe('');
    expect(vacios.body.specialty).toBeNull();
  });

  it('rechaza un médico sin nombre, con datos de otro tipo o con campos de más', async () => {
    const enviar = (cuerpo: object) => request(app.getHttpServer()).post('/api/doctors/express').set(TENANT).send(cuerpo);
    expect((await enviar({})).status).toBe(400);
    expect((await enviar({ name: 123 })).status).toBe(400);
    expect((await enviar({ name: 'Dr.', cedula: 55 })).status).toBe(400);
    expect((await enviar({ name: 'Dr.', phone: '123' })).status).toBe(400);
    expect(repositorio.doctors.length).toBe(0);
  });

  it('exige paciente y sucursal al confirmar la orden', async () => {
    const sinPaciente = await request(app.getHttpServer()).post('/api/orders').set(TENANT).send({ branchId: 1, items: [], totalAmount: 0 });
    expect(sinPaciente.status).toBe(422);
    expect(sinPaciente.body.error.mensaje).toBe('patientId es requerido');

    const sinSucursal = await request(app.getHttpServer()).post('/api/orders').set(TENANT).send({ patientId: 5, items: [], totalAmount: 0 });
    expect(sinSucursal.status).toBe(422);
    expect(sinSucursal.body.error.mensaje).toBe('branchId es requerido');

    const sinCuerpo = await request(app.getHttpServer()).post('/api/orders').set(TENANT);
    expect(sinCuerpo.status).toBe(422);
    expect(repositorio.orders.length).toBe(0);
  });

  it('crea la orden, devuelve el folio y guarda estudios y perfiles', async () => {
    const cuerpo = {
      patientId: 5,
      branchId: 1,
      doctorId: null,
      totalAmount: 450,
      items: [
        { id: 1, type: 'TEST', code: 'BH-QA', name: 'Biometría hemática QA', price: 150 },
        { id: 3, type: 'PROFILE', code: 'PERF-QA', name: 'Perfil QA', price: 300 },
      ],
    };
    const primera = await request(app.getHttpServer()).post('/api/orders').set(TENANT).send(cuerpo);
    expect(primera.status).toBe(201);
    expect(primera.body.success).toBe(true);
    expect(primera.body.folio).toMatch(/^ORD-\d{8}-\d{4}$/);
    expect(primera.body.orderId).toBe(1);

    const segunda = await request(app.getHttpServer()).post('/api/orders').set(TENANT).send(cuerpo);
    expect(segunda.body.folio).not.toBe(primera.body.folio);

    expect(repositorio.orders[0].data.items).toEqual([{ price: 150, testId: 1 }, { price: 300, profileId: 3 }]);
    expect(repositorio.orders[0].data.totalAmount).toBe(450);
    expect(repositorio.orders[0].data.folio).toBe(primera.body.folio);
    expect(repositorio.orders[1].data.folio).toBe(segunda.body.folio);
  });

  it('acepta números como texto y listas vacías como hace la pantalla', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/orders')
      .set(TENANT)
      .send({ patientId: '5', branchId: '1', doctorId: '7', totalAmount: '99.5', items: {} });
    expect(res.status).toBe(201);
    expect(repositorio.orders[0].data.doctorId).toBe(7);
    expect(repositorio.orders[0].data.totalAmount).toBe(99.5);
    expect(repositorio.orders[0].data.items).toEqual([]);
  });

  it('bloquea incompatibilidad por sexo en backend y registra excepción con usuario, motivo y estudio', async () => {
    const body = { patientId: 6, branchId: 1, items: [{ id: 5, type: 'TEST', price: 10 }], totalAmount: 10 };
    const bloqueada = await request(app.getHttpServer()).post('/api/orders').set(TENANT).send(body);
    expect(bloqueada.status).toBe(400);
    expect(repositorio.orders).toHaveLength(0);

    const noAutorizada = await request(app.getHttpServer()).post('/api/orders').set(TENANT).send({ ...body, exceptionApprovals: [{ testId: 5, reason: 'Caso clínico' }] });
    expect(noAutorizada.status).toBe(403);

    const sinMotivo = await request(app.getHttpServer()).post('/api/orders').set({ ...TENANT, 'x-user-role': 'admin', 'x-user-name': 'Admin QA' }).send({ ...body, exceptionApprovals: [{ testId: 5, reason: '  ' }] });
    expect(sinMotivo.status).toBe(400);

    const autorizada = await request(app.getHttpServer()).post('/api/orders').set({ ...TENANT, 'x-user-role': 'admin', 'x-user-name': 'Admin QA' }).send({ ...body, exceptionApprovals: [{ testId: 5, reason: 'Autorización clínica documentada' }] });
    expect(autorizada.status).toBe(201);
    expect(repositorio.orders[0].data.exceptionApprovals).toEqual([{ testId: 5, reason: 'Autorización clínica documentada', authorizedByName: 'Admin QA' }]);
  });

  it('responde 500 con el mensaje de siempre cuando la base falla', async () => {
    const consola = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    repositorio.failWith = new Error('base caída');
    const res = await request(app.getHttpServer()).post('/api/orders').set(TENANT).send({ patientId: 5, branchId: 1 });
    expect(res.status).toBe(500);
    expect(res.body.error.mensaje).toBe('Error al confirmar la orden');
    const busqueda = await request(app.getHttpServer()).get('/api/concepts/search?q=QA').set(TENANT);
    expect(busqueda.status).toBe(500);
    expect(busqueda.body.error.mensaje).toBe('Error en búsqueda predictiva de conceptos');
    consola.mockRestore();
  });
});
