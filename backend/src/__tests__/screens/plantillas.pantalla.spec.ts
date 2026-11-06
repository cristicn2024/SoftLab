import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { prisma } from '../../config/db';
import { closeDatabase, createScreenFixture, headers, type ScreenFixture } from './support';
import { construirAppNest } from './support-nest';

jest.setTimeout(30000);

// Pantalla "Plantillas de informe" (HU-06)
// GET /templates/active · POST /templates · GET /templates

describe('Pantalla de plantillas de informe', () => {
  let app: INestApplication;
  let fixture: ScreenFixture;
  let firstTemplateId = 0;

  const templateBody = (suffix: string) => ({
    headerText: `Encabezado ${suffix} · Laboratorio QA`,
    disclaimer: `Aviso legal ${suffix}`,
    chemistName: `Q.F.B. ${suffix}`,
    chemistCedula: `CED-${suffix}`,
  });

  beforeAll(async () => {
    app = await construirAppNest();
    fixture = await createScreenFixture('plantillas');
  });

  afterAll(async () => {
    await app.close();
    await fixture.cleanup();
    await closeDatabase();
  });

  it('usa la plantilla de respaldo cuando el laboratorio no tiene una configurada', async () => {
    const res = await request(app.getHttpServer()).get('/api/templates/active').set(headers(fixture.tenantId));

    expect(res.status).toBe(200);
    expect(res.body.version).toBe(3);
    expect(res.body.name).toBe('Biometría hemática · Clínica Central · v3 · Publicada');
    expect(res.body.headerText).toBe('Logotipo · Laboratorio Santa Lucía · Clínica Central');
    expect(res.body.chemistName).toBe('Laura Méndez');
    expect(res.body.chemistCedula).toBe('10458392');
  });

  it('guarda la primera versión y la marca como predeterminada', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/templates')
      .set(headers(fixture.tenantId))
      .send(templateBody('Primera'));

    expect(res.status).toBe(201);
    expect(res.body.tenantId).toBe(fixture.tenantId);
    expect(res.body.version).toBe(1);
    expect(res.body.name).toBe('Biometría hemática · v1');
    expect(res.body.isDefault).toBe(true);
    expect(res.body.headerText).toBe('Encabezado Primera · Laboratorio QA');
    expect(res.body.disclaimer).toBe('Aviso legal Primera');
    expect(res.body.chemistName).toBe('Q.F.B. Primera');
    expect(res.body.chemistCedula).toBe('CED-Primera');
    expect(res.body.primaryColor).toBe('#0f766e');

    firstTemplateId = res.body.id;
  });

  it('crea una nueva versión y desmarca la anterior', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/templates')
      .set(headers(fixture.tenantId))
      .send(templateBody('Segunda'));

    expect(res.status).toBe(201);
    expect(res.body.version).toBe(2);
    expect(res.body.name).toBe('Biometría hemática · v2');
    expect(res.body.isDefault).toBe(true);

    const previous = await prisma.reportTemplate.findUniqueOrThrow({ where: { id: firstTemplateId } });
    expect(previous.isDefault).toBe(false);
    expect(previous.version).toBe(1);
  });

  it('publica como vigente solo la última versión predeterminada', async () => {
    const res = await request(app.getHttpServer()).get('/api/templates/active').set(headers(fixture.tenantId));

    expect(res.status).toBe(200);
    expect(res.body.version).toBe(2);
    expect(res.body.name).toBe('Biometría hemática · v2');
    expect(res.body.headerText).toBe('Encabezado Segunda · Laboratorio QA');
    expect(res.body.isDefault).toBe(true);

    const defaults = await prisma.reportTemplate.count({
      where: { tenantId: fixture.tenantId, isDefault: true },
    });
    expect(defaults).toBe(1);
  });

  it('entrega el historial de versiones de la más reciente a la más antigua', async () => {
    const res = await request(app.getHttpServer()).get('/api/templates').set(headers(fixture.tenantId));

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body.map((template: { version: number }) => template.version)).toEqual([2, 1]);
    expect(res.body.map((template: { isDefault: boolean }) => template.isDefault)).toEqual([true, false]);
  });

  it('aísla las plantillas por laboratorio', async () => {
    const otherTenant = fixture.tenantId + 999999;

    const active = await request(app.getHttpServer()).get('/api/templates/active').set(headers(otherTenant));
    expect(active.status).toBe(200);
    expect(active.body.version).toBe(3);
    expect(active.body.name).toBe('Biometría hemática · Clínica Central · v3 · Publicada');

    const history = await request(app.getHttpServer()).get('/api/templates').set(headers(otherTenant));
    expect(history.status).toBe(200);
    expect(history.body).toEqual([]);
  });
});
