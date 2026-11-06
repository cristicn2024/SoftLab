import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configurarApp } from '../../configurar-app';
import { FakeRepository } from './dominio/corte-caja.escenarios';
import { CorteCajaModule } from './corte-caja.module';
import { CORTE_CAJA_REPOSITORY } from './corte-caja.tokens';

const TENANT = { 'x-tenant-id': '1' };
const QUERY = 'branchId=10&cashierId=5&shift=matutino&date=2026-01-15';

function at(hour: number): Date {
  return new Date(2026, 0, 15, hour);
}

describe('API de corte de caja', () => {
  let app: INestApplication;
  let repositorio: FakeRepository;

  beforeEach(async () => {
    repositorio = new FakeRepository();
    repositorio.addTenant(1, 'Lab Uno');
    repositorio.addBranch(1, 10, 'Sucursal corte');
    repositorio.addUser(1, 5, 'Cajero corte');
    repositorio.addOrder(1, 10, 5, at(9), { totalAmount: 100, discountAmount: 10, payments: [{ method: 'cash', amount: 100 }] });
    repositorio.addOrder(1, 10, 5, at(10), {
      totalAmount: 250,
      payments: [
        { method: 'cash', amount: 200 },
        { method: 'card', amount: 50 },
      ],
    });

    const modulo = await Test.createTestingModule({ imports: [CorteCajaModule] })
      .overrideProvider(CORTE_CAJA_REPOSITORY)
      .useValue(repositorio)
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
    expect((await request(server).get('/api/cash-cuts/context')).status).toBe(400);
    expect((await request(server).get(`/api/cash-cuts/summary?${QUERY}`)).status).toBe(400);
    expect((await request(server).get('/api/cash-cuts')).status).toBe(400);
    expect((await request(server).get('/api/cash-cuts/1/export')).status).toBe(400);
    const res = await request(server).post('/api/cash-cuts/close').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.mensaje).toBe('Falta el encabezado x-tenant-id con el id del laboratorio.');
  });

  it('entrega el contexto con la forma que usa el front', async () => {
    const res = await request(app.getHttpServer()).get('/api/cash-cuts/context').set(TENANT);
    expect(res.status).toBe(200);
    expect(res.body.tenant).toEqual({ id: 1, name: 'Lab Uno', subdomain: 'lab-1' });
    expect(res.body.currentUser.id).toBe(5);
    expect(res.body.shifts.length).toBe(3);
    expect(res.body.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('valida los parámetros del resumen con 400 y mensajes en lista', async () => {
    const server = app.getHttpServer();
    const faltan = await request(server).get('/api/cash-cuts/summary').set(TENANT);
    expect(faltan.status).toBe(400);
    expect(faltan.body.error.mensaje).toContain('branchId debe ser un entero');
    expect(faltan.body.error.mensaje).toContain('Turno inválido');

    const turno = await request(server).get('/api/cash-cuts/summary?branchId=10&cashierId=5&shift=tarde&date=2026-01-15').set(TENANT);
    expect(turno.status).toBe(400);
    expect(turno.body.error.mensaje).toContain('Turno inválido');

    const extra = await request(server).get(`/api/cash-cuts/summary?${QUERY}&otro=1`).set(TENANT);
    expect(extra.status).toBe(400);
  });

  it('separa la fecha inexistente (422) de la sucursal inexistente (404)', async () => {
    const server = app.getHttpServer();
    const fecha = await request(server).get(`/api/cash-cuts/summary?${QUERY.replace('2026-01-15', '2026-02-30')}`).set(TENANT);
    expect(fecha.status).toBe(422);
    expect(fecha.body.error.mensaje).toBe('Fecha inválida');

    const sucursal = await request(server).get(`/api/cash-cuts/summary?${QUERY.replace('branchId=10', 'branchId=99')}`).set(TENANT);
    expect(sucursal.status).toBe(404);
    expect(sucursal.body.error.mensaje).toBe('Sucursal no encontrada');
  });

  it('calcula el resumen abierto', async () => {
    const res = await request(app.getHttpServer()).get(`/api/cash-cuts/summary?${QUERY}`).set(TENANT);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('open');
    expect(res.body.summary).toEqual({
      cashTotal: 300,
      cardTotal: 50,
      transferTotal: 0,
      ordersCount: 2,
      discountsTotal: 10,
      cancellationsCount: 0,
      totalPaid: 350,
      expectedCash: 300,
    });
  });

  it('valida el cierre: observación, monto y tamaño', async () => {
    const server = app.getHttpServer();
    const cuerpo = { branchId: 10, cashierId: 5, shift: 'matutino', date: '2026-01-15' };

    const diferencia = await request(server).post('/api/cash-cuts/close').set(TENANT).send({ ...cuerpo, countedCash: 290 });
    expect(diferencia.status).toBe(422);
    expect(diferencia.body.error.mensaje).toBe(
      'La observación es obligatoria cuando el efectivo contado presenta una diferencia',
    );

    const negativo = await request(server).post('/api/cash-cuts/close').set(TENANT).send({ ...cuerpo, countedCash: -1 });
    expect(negativo.status).toBe(400);
    expect(negativo.body.error.mensaje).toContain('El efectivo contado no puede ser negativo');

    const largo = await request(server)
      .post('/api/cash-cuts/close')
      .set(TENANT)
      .send({ ...cuerpo, countedCash: 300, observation: 'a'.repeat(501) });
    expect(largo.status).toBe(400);
    expect(largo.body.error.mensaje).toContain('La observación no puede exceder 500 caracteres');
    expect(repositorio.cuts.length).toBe(0);

    const numerica = await request(server)
      .post('/api/cash-cuts/close')
      .set(TENANT)
      .send({ ...cuerpo, countedCash: 300, observation: 123 });
    expect(numerica.status).toBe(400);
    expect(repositorio.cuts.length).toBe(0);
  });

  it('cierra con 201, guarda x-user-id como quien cierra y rechaza repetir', async () => {
    const server = app.getHttpServer();
    const cuerpo = { branchId: 10, cashierId: 5, shift: 'matutino', date: '2026-01-15', countedCash: 290, observation: 'Faltante' };

    const res = await request(server).post('/api/cash-cuts/close').set({ ...TENANT, 'x-user-id': '5' }).send(cuerpo);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('closed');
    expect(res.body.difference).toBe(-10);
    expect(res.body.cashier).toBe('Cajero corte');
    expect(repositorio.cuts[0].input.closedById).toBe(5);

    const repetido = await request(server).post('/api/cash-cuts/close').set(TENANT).send(cuerpo);
    expect(repetido.status).toBe(409);
    expect(repetido.body.error.mensaje).toBe('El corte de caja ya está cerrado y no puede modificarse');
  });

  it('sin x-user-id usa el cajero del cuerpo y con cajero 0 no deja quien cierra', async () => {
    const server = app.getHttpServer();
    await request(server)
      .post('/api/cash-cuts/close')
      .set(TENANT)
      .send({ branchId: 10, cashierId: 5, shift: 'matutino', date: '2026-01-15', countedCash: 300 });
    expect(repositorio.cuts[0].input.closedById).toBe(5);

    repositorio.addOrder(1, 10, null, at(11), { payments: [{ method: 'cash', amount: 20 }] });
    const sinAsignar = await request(server)
      .post('/api/cash-cuts/close')
      .set({ ...TENANT, 'x-user-id': 'abc' })
      .send({ branchId: 10, cashierId: 0, shift: 'matutino', date: '2026-01-15', countedCash: 20 });
    expect(sinAsignar.status).toBe(201);
    expect(sinAsignar.body.cashier).toBe('Sin asignar');
    expect(repositorio.cuts[1].input.closedById).toBeNull();
  });

  it('lista el historial y exporta el CSV con sus encabezados', async () => {
    const server = app.getHttpServer();
    const cierre = await request(server)
      .post('/api/cash-cuts/close')
      .set(TENANT)
      .send({ branchId: 10, cashierId: 5, shift: 'matutino', date: '2026-01-15', countedCash: 290, observation: 'Faltante de cambio' });

    const historial = await request(server).get('/api/cash-cuts').set(TENANT);
    expect(historial.status).toBe(200);
    expect(historial.body.length).toBe(1);
    expect(historial.body[0].branch.name).toBe('Sucursal corte');

    const csv = await request(server).get(`/api/cash-cuts/${cierre.body.cutId}/export`).set(TENANT);
    expect(csv.status).toBe(200);
    expect(String(csv.headers['content-type'])).toMatch(/text\/csv/);
    expect(String(csv.headers['content-disposition'])).toBe(`attachment; filename="corte-caja-${cierre.body.cutId}.csv"`);
    expect(csv.text.startsWith('﻿"Reporte","Corte de caja"')).toBe(true);
    expect(csv.text).toMatch(/Faltante de cambio/);

    const invalido = await request(server).get('/api/cash-cuts/abc/export').set(TENANT);
    expect(invalido.status).toBe(400);
    expect(invalido.body.error.mensaje).toBe('ID de corte inválido');

    const noExiste = await request(server).get('/api/cash-cuts/999/export').set(TENANT);
    expect(noExiste.status).toBe(404);
    expect(noExiste.body.error.mensaje).toBe('Corte de caja no encontrado');

    const otroLab = await request(server).get(`/api/cash-cuts/${cierre.body.cutId}/export`).set({ 'x-tenant-id': '2' });
    expect(otroLab.status).toBe(404);
  });
});
