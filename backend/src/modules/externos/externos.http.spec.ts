import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configurarApp } from '../../configurar-app';
import { estudio, FakeExternosRepository } from './dominio/externos.escenarios';
import { ExternosModule } from './externos.module';
import { EXTERNOS_REPOSITORY } from './externos.tokens';

describe('API de estudios externos', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const repositorio = new FakeExternosRepository();
    repositorio.agregarLaboratorio(1, { id: 1, name: 'Laboratorio Referencia Nacional' });
    repositorio.agregarLaboratorio(1, { id: 2, name: 'Laboratorio de Referencia del Norte' });
    repositorio.agregarEstudio(1, estudio(10, 'HBA001', 'Hemoglobina glucosilada (HbA1c)', 1, 'Laboratorio Referencia Nacional'));
    repositorio.agregarEstudio(1, estudio(11, 'EXT001', 'Vitamina D 25-OH', 2, 'Laboratorio de Referencia del Norte', false));
    repositorio.agregarEstudio(2, estudio(20, 'OTRO01', 'Otro', 5, 'Ajeno'));

    const modulo = await Test.createTestingModule({ imports: [ExternosModule] })
      .overrideProvider(EXTERNOS_REPOSITORY)
      .useValue(repositorio)
      .compile();
    app = modulo.createNestApplication();
    configurarApp(app as never);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('exige el encabezado x-tenant-id', async () => {
    const res = await request(app.getHttpServer()).get('/api/externos/estudios');
    expect(res.status).toBe(400);
  });

  it('lista los laboratorios externos del laboratorio', async () => {
    const res = await request(app.getHttpServer()).get('/api/externos/laboratorios').set('x-tenant-id', '1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('filtra por laboratorio y estatus y reporta el conteo', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/externos/estudios?laboratorio=2&estatus=inactivos')
      .set('x-tenant-id', '1');
    expect(res.status).toBe(200);
    expect(res.body.estudios).toHaveLength(1);
    expect(res.body.estudios[0].code).toBe('EXT001');
    expect(res.body.resumen.porLaboratorio).toEqual([{ laboratorio: 'Laboratorio de Referencia del Norte', cantidad: 1 }]);
  });

  it('no mezcla estudios de otro laboratorio', async () => {
    const res = await request(app.getHttpServer()).get('/api/externos/estudios').set('x-tenant-id', '2');
    expect(res.body.estudios).toHaveLength(1);
    expect(res.body.estudios[0].code).toBe('OTRO01');
  });

  it('responde 422 con un filtro inválido', async () => {
    const res = await request(app.getHttpServer()).get('/api/externos/estudios?estatus=raro').set('x-tenant-id', '1');
    expect(res.status).toBe(422);
    expect(res.body.error.tipo).toBe('FiltroInvalidoError');
  });
});
