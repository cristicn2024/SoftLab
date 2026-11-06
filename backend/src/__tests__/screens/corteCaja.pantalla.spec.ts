import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { prisma } from '../../config/db';
import {
  formatLocalDate,
  parseDateOnly,
  resolvePeriod,
  round2,
  shiftForHour,
} from '../../modules/corte-caja/dominio/corte-caja.rules';
import { closeDatabase, createScreenFixture, headers, type ScreenFixture } from './support';
import { construirAppNest } from './support-nest';

jest.setTimeout(30000);

// Pantalla "Corte de caja" (HU 5.4)
// GET /cash-cuts/context · GET /cash-cuts/summary · POST /cash-cuts/close
// GET /cash-cuts · GET /cash-cuts/:id/export

describe('Reglas de turno del corte de caja', () => {
  it('asigna el turno según la hora del día', () => {
    expect(shiftForHour(7)).toBe('nocturno');
    expect(shiftForHour(8)).toBe('matutino');
    expect(shiftForHour(14)).toBe('matutino');
    expect(shiftForHour(15)).toBe('vespertino');
    expect(shiftForHour(21)).toBe('vespertino');
    expect(shiftForHour(22)).toBe('nocturno');
    expect(shiftForHour(0)).toBe('nocturno');
  });

  it('el turno nocturno termina al día siguiente', () => {
    const { start, end } = resolvePeriod('2026-01-15', 'nocturno');
    expect(start.getDate()).toBe(15);
    expect(start.getHours()).toBe(22);
    expect(end.getDate()).toBe(16);
    expect(end.getHours()).toBe(8);
  });

  it('valida fechas reales y rechaza días inexistentes', () => {
    expect(formatLocalDate(new Date(2024, 1, 29))).toBe('2024-02-29');
    const parsed = parseDateOnly('2024-02-29');
    expect(parsed.getUTCFullYear()).toBe(2024);
    expect(parsed.getUTCMonth()).toBe(1);
    expect(parsed.getUTCDate()).toBe(29);
    expect(() => parseDateOnly('2026-02-30')).toThrow(/Fecha inválida/);
    expect(() => parseDateOnly('2026-13-01')).toThrow(/Fecha inválida/);
    expect(() => parseDateOnly('sin-fecha')).toThrow(/Fecha inválida/);
  });

  it('redondea a centavos', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(10.994)).toBe(10.99);
    expect(round2(0)).toBe(0);
  });
});

describe('Pantalla de corte de caja', () => {
  const FECHA = '2026-01-15';
  const MATUTINO = { shift: 'matutino', date: FECHA };

  let app: INestApplication;
  let fixture: ScreenFixture;
  let orderCash: Awaited<ReturnType<ScreenFixture['createOrder']>>;
  let orderMixed: Awaited<ReturnType<ScreenFixture['createOrder']>>;
  let orderTransfer: Awaited<ReturnType<ScreenFixture['createOrder']>>;
  let orderCancelled: Awaited<ReturnType<ScreenFixture['createOrder']>>;
  let orderPending: Awaited<ReturnType<ScreenFixture['createOrder']>>;
  let orderOutside: Awaited<ReturnType<ScreenFixture['createOrder']>>;
  let orderOtherCashier: Awaited<ReturnType<ScreenFixture['createOrder']>>;
  let cutId = 0;

  const at = (hour: number, minute = 0) => new Date(2026, 0, 15, hour, minute, 0, 0);

  const scopeQuery = (extra: Record<string, string> = {}) =>
    new URLSearchParams({
      branchId: String(fixture.branchId),
      cashierId: String(fixture.cashier.id),
      ...MATUTINO,
      ...extra,
    }).toString();

  const closeBody = (extra: Record<string, unknown> = {}) => ({
    branchId: fixture.branchId,
    cashierId: fixture.cashier.id,
    ...MATUTINO,
    ...extra,
  });

  beforeAll(async () => {
    app = await construirAppNest();
    fixture = await createScreenFixture('corte');
    orderCash = await fixture.createOrder({
      createdAt: at(9),
      totalAmount: 100,
      discountAmount: 10,
      payments: [{ method: 'cash', amount: 100 }],
    });
    orderMixed = await fixture.createOrder({
      createdAt: at(10),
      totalAmount: 250,
      payments: [
        { method: 'cash', amount: 200 },
        { method: 'card', amount: 50, reference: 'AUTH-1' },
      ],
    });
    orderTransfer = await fixture.createOrder({
      createdAt: at(11),
      totalAmount: 75,
      payments: [{ method: 'transfer', amount: 75, reference: 'SPEI-1' }],
    });
    orderCancelled = await fixture.createOrder({ createdAt: at(12), status: 'cancelled', totalAmount: 30 });
    orderPending = await fixture.createOrder({ createdAt: at(13), totalAmount: 20 });
    orderOutside = await fixture.createOrder({
      createdAt: at(16),
      totalAmount: 999,
      payments: [{ method: 'cash', amount: 999 }],
    });
    orderOtherCashier = await fixture.createOrder({
      createdAt: at(10, 30),
      cashierId: fixture.admin.id,
      totalAmount: 999,
      payments: [{ method: 'cash', amount: 999 }],
    });
  });

  afterAll(async () => {
    await fixture.cleanup();
    await app.close();
    await closeDatabase();
  });

  it('carga el contexto de sucursales, cajeros y turnos', async () => {
    // El cajero por defecto es quien registró el último pago del laboratorio.
    await fixture.createOrder({
      createdAt: new Date(2025, 0, 1, 9),
      cashierId: fixture.admin.id,
      payments: [{ method: 'cash', amount: 1 }],
    });

    const res = await request(app.getHttpServer()).get('/api/cash-cuts/context').set(headers(fixture.tenantId));

    expect(res.status).toBe(200);
    expect(res.body.tenant.id).toBe(fixture.tenantId);
    expect(res.body.currentUser.id).toBe(fixture.admin.id);
    expect(res.body.currentUser.role).toBe('admin');
    expect(res.body.branches.some((branch: { id: number }) => branch.id === fixture.branchId)).toBeTruthy();
    expect(res.body.cashiers.length).toBe(2);
    expect(res.body.shifts.map((shift: { value: string }) => shift.value)).toEqual(['matutino', 'vespertino', 'nocturno']);
    expect(res.body.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('rechaza parámetros inválidos del resumen', async () => {
    const missing = await request(app.getHttpServer()).get('/api/cash-cuts/summary').set(headers(fixture.tenantId));
    expect(missing.status).toBe(400);
    expect(missing.body.error.mensaje).toContain('branchId debe ser un entero');
    expect(missing.body.error.mensaje).toContain('Turno inválido');

    const invalidShift = await request(app.getHttpServer())
      .get(`/api/cash-cuts/summary?${scopeQuery({ shift: 'tarde' })}`)
      .set(headers(fixture.tenantId));
    expect(invalidShift.status).toBe(400);
    expect(invalidShift.body.error.mensaje).toContain('Turno inválido');

    const invalidDate = await request(app.getHttpServer())
      .get(`/api/cash-cuts/summary?${scopeQuery({ date: '2026-02-30' })}`)
      .set(headers(fixture.tenantId));
    expect(invalidDate.status).toBe(422);
    expect(invalidDate.body.error.mensaje).toBe('Fecha inválida');

    const unknownBranch = await request(app.getHttpServer())
      .get(`/api/cash-cuts/summary?${scopeQuery({ branchId: '999999999' })}`)
      .set(headers(fixture.tenantId));
    expect(unknownBranch.status).toBe(404);
    expect(unknownBranch.body.error.mensaje).toBe('Sucursal no encontrada');
  });

  it('calcula los acumulados del turno y clasifica los movimientos', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/cash-cuts/summary?${scopeQuery()}`)
      .set(headers(fixture.tenantId));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('open');
    expect(res.body.scope.branchName).toBe('Sucursal corte');
    expect(res.body.scope.cashierName).toBe('Cajero corte');
    expect(res.body.scope.shiftLabel).toBe('Matutino');
    expect(res.body.scope.schedule).toBe('08:00 – 15:00');

    expect(res.body.summary).toEqual({
      cashTotal: 300,
      cardTotal: 50,
      transferTotal: 75,
      ordersCount: 5,
      discountsTotal: 10,
      cancellationsCount: 1,
      totalPaid: 425,
      expectedCash: 300,
    });

    expect(res.body.movements.length).toBe(5);
    const byId = new Map<number, { method: string; methodLabel: string; amount: number }>(
      res.body.movements.map((movement: { id: number; method: string; methodLabel: string; amount: number }) => [
        movement.id,
        movement,
      ]),
    );
    expect(byId.get(orderCash.id)?.methodLabel).toBe('Efectivo');
    expect(byId.get(orderMixed.id)?.methodLabel).toBe('Efectivo + tarjeta');
    expect(byId.get(orderTransfer.id)?.methodLabel).toBe('Transferencia');
    expect(byId.get(orderCancelled.id)?.methodLabel).toBe('Cancelado');
    expect(byId.get(orderPending.id)?.methodLabel).toBe('Pendiente');
    expect(byId.has(orderOutside.id)).toBe(false);
    expect(byId.has(orderOtherCashier.id)).toBe(false);
  });

  it('aísla el corte por laboratorio, sucursal y cajero', async () => {
    const otherCashier = await request(app.getHttpServer())
      .get(
        `/api/cash-cuts/summary?${scopeQuery({
          cashierId: String(fixture.admin.id),
        })}`,
      )
      .set(headers(fixture.tenantId));

    expect(otherCashier.status).toBe(200);
    expect(otherCashier.body.summary.ordersCount).toBe(1);
    expect(otherCashier.body.summary.cashTotal).toBe(999);

    const otherTenant = await request(app.getHttpServer())
      .get(`/api/cash-cuts/summary?${scopeQuery()}`)
      .set(headers(fixture.tenantId + 999999));

    expect(otherTenant.status).toBe(404);
    expect(otherTenant.body.error.mensaje).toBe('Sucursal no encontrada');
  });

  it('exige observación cuando el efectivo contado tiene diferencia', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/cash-cuts/close')
      .set(headers(fixture.tenantId))
      .send(closeBody({ countedCash: 290 }));

    expect(res.status).toBe(422);
    expect(res.body.error.mensaje).toBe('La observación es obligatoria cuando el efectivo contado presenta una diferencia');
  });

  it('valida el efectivo contado y la observación', async () => {
    const negative = await request(app.getHttpServer())
      .post('/api/cash-cuts/close')
      .set(headers(fixture.tenantId))
      .send(closeBody({ countedCash: -1 }));

    expect(negative.status).toBe(400);
    expect(negative.body.error.mensaje).toContain('El efectivo contado no puede ser negativo');

    const longObservation = await request(app.getHttpServer())
      .post('/api/cash-cuts/close')
      .set(headers(fixture.tenantId))
      .send(closeBody({ countedCash: 300, observation: 'a'.repeat(501) }));

    expect(longObservation.status).toBe(400);
    expect(longObservation.body.error.mensaje).toContain('La observación no puede exceder 500 caracteres');
  });

  it('cierra el corte, congela el resumen y liga los pagos al corte', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/cash-cuts/close')
      .set(headers(fixture.tenantId))
      .send(closeBody({ countedCash: 290, observation: 'Faltante de cambio' }));

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('closed');
    expect(res.body.countedCash).toBe(290);
    expect(res.body.difference).toBe(-10);
    expect(res.body.observation).toBe('Faltante de cambio');
    expect(res.body.summary.cashTotal).toBe(300);
    expect(res.body.summary.expectedCash).toBe(300);

    cutId = res.body.cutId;
    const linkedPayments = await prisma.payment.count({ where: { cashCutId: cutId } });
    expect(linkedPayments).toBe(4);

    const repeated = await request(app.getHttpServer())
      .post('/api/cash-cuts/close')
      .set(headers(fixture.tenantId))
      .send(closeBody({ countedCash: 290, observation: 'Otra vez' }));

    expect(repeated.status).toBe(409);
    expect(repeated.body.error.mensaje).toBe('El corte de caja ya está cerrado y no puede modificarse');
  });

  it('mantiene el resumen congelado aunque entren movimientos después del cierre', async () => {
    await prisma.payment.create({
      data: {
        tenantId: fixture.tenantId,
        branchId: fixture.branchId,
        orderId: orderCash.id,
        cashierId: fixture.cashier.id,
        method: 'cash',
        amount: 50,
        createdBy: 'Cajero corte',
      },
    });

    const res = await request(app.getHttpServer())
      .get(`/api/cash-cuts/summary?${scopeQuery()}`)
      .set(headers(fixture.tenantId));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('closed');
    expect(res.body.cutId).toBe(cutId);
    expect(res.body.countedCash).toBe(290);
    expect(res.body.difference).toBe(-10);
    expect(res.body.observation).toBe('Faltante de cambio');
    expect(res.body.summary.cashTotal).toBe(300);
    expect(res.body.summary.totalPaid).toBe(425);
    expect(res.body.movements.length).toBe(5);
  });

  it('lista el historial de cortes cerrados', async () => {
    const res = await request(app.getHttpServer()).get('/api/cash-cuts').set(headers(fixture.tenantId));

    expect(res.status).toBe(200);
    const cut = res.body.find((item: { id: number }) => item.id === cutId);
    expect(cut).toBeTruthy();
    expect(cut.branch.name).toBe('Sucursal corte');
    expect(cut.cashier.fullName).toBe('Cajero corte');
    expect(cut.shift).toBe('matutino');
    expect(cut.status).toBe('closed');
    expect(cut.expectedCash).toBe(300);
    expect(cut.countedCash).toBe(290);
    expect(cut.difference).toBe(-10);
    expect(cut.observation).toBe('Faltante de cambio');
    expect(cut.closedBy.id).toBe(fixture.cashier.id);
  });

  it('opera el corte completo sin usuarios registrados', async () => {
    const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Laboratorio sin usuarios',
        subdomain: `qa-sin-usuarios-${suffix}`.slice(0, 50),
      },
    });

    try {
      const branch = await prisma.branch.create({
        data: { tenantId: tenant.id, name: 'Sucursal sin usuarios' },
      });
      const patient = await prisma.patient.create({
        data: {
          tenantId: tenant.id,
          firstName: 'Paciente',
          lastName: 'Sin usuario',
          birthDate: new Date(1990, 0, 1),
          gender: 'F',
          patientCode: `P-${suffix}`,
        },
      });
      const createdAt = new Date(2026, 0, 20, 9, 0, 0, 0);

      await prisma.order.create({
        data: {
          tenantId: tenant.id,
          branchId: branch.id,
          patientId: patient.id,
          cashierId: null,
          totalAmount: 200,
          paidAmount: 200,
          status: 'completed',
          folio: `QA-SIN-USUARIO-${suffix}`,
          createdAt,
          payments: {
            create: [
              {
                tenantId: tenant.id,
                branchId: branch.id,
                cashierId: null,
                method: 'cash',
                amount: 200,
                createdAt,
              },
            ],
          },
        },
      });

      const contexto = await request(app.getHttpServer())
        .get('/api/cash-cuts/context')
        .set(headers(tenant.id));
      expect(contexto.status).toBe(200);
      expect(contexto.body.currentUser).toBe(null);
      expect(contexto.body.cashiers).toEqual([]);

      const query = new URLSearchParams({
        branchId: String(branch.id),
        cashierId: '0',
        shift: 'matutino',
        date: '2026-01-20',
      }).toString();

      const abierto = await request(app.getHttpServer())
        .get(`/api/cash-cuts/summary?${query}`)
        .set(headers(tenant.id));
      expect(abierto.status).toBe(200);
      expect(abierto.body.scope.cashierName).toBe('Sin asignar');
      expect(abierto.body.summary.cashTotal).toBe(200);

      const cierre = await request(app.getHttpServer())
        .post('/api/cash-cuts/close')
        .set(headers(tenant.id))
        .send({
          branchId: branch.id,
          cashierId: 0,
          shift: 'matutino',
          date: '2026-01-20',
          countedCash: 200,
        });
      expect(cierre.status).toBe(201);
      expect(cierre.body.cashier).toBe('Sin asignar');

      const repetido = await request(app.getHttpServer())
        .post('/api/cash-cuts/close')
        .set(headers(tenant.id))
        .send({
          branchId: branch.id,
          cashierId: 0,
          shift: 'matutino',
          date: '2026-01-20',
          countedCash: 200,
        });
      expect(repetido.status).toBe(409);

      const guardado = await prisma.cashCut.findUnique({ where: { id: cierre.body.cutId } });
      expect(guardado?.cashierId && guardado.cashierId > 0).toBeTruthy();
      expect(guardado?.closedById).toBe(null);
      const tecnico = await prisma.user.findUnique({ where: { id: guardado?.cashierId } });
      expect(tecnico?.fullName).toBe('Sin asignar');
      expect(tecnico?.email ?? '').toMatch(/@sistema\.local$/);

      const cerrado = await request(app.getHttpServer())
        .get(`/api/cash-cuts/summary?${query}`)
        .set(headers(tenant.id));
      expect(cerrado.status).toBe(200);
      expect(cerrado.body.status).toBe('closed');
      expect(cerrado.body.summary.cashTotal).toBe(200);

      const historial = await request(app.getHttpServer())
        .get('/api/cash-cuts')
        .set(headers(tenant.id));
      expect(historial.status).toBe(200);
      expect(historial.body[0].cashier.fullName).toBe('Sin asignar');
      expect(historial.body[0].closedBy).toBe(null);

      const exportado = await request(app.getHttpServer())
        .get(`/api/cash-cuts/${cierre.body.cutId}/export`)
        .set(headers(tenant.id));
      expect(exportado.status).toBe(200);
      expect(exportado.text).toMatch(/Sin asignar/);
    } finally {
      await prisma.payment.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.cashCut.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.order.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.patient.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.branch.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.tenant.deleteMany({ where: { id: tenant.id } });
    }
  });

  it('exporta el corte en CSV y valida el identificador', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/cash-cuts/${cutId}/export`)
      .set(headers(fixture.tenantId));

    expect(res.status).toBe(200);
    expect(String(res.headers['content-type'])).toMatch(/text\/csv/);
    expect(String(res.headers['content-disposition'])).toMatch(/corte-caja-/);
    expect(res.text.startsWith('\uFEFF"Reporte","Corte de caja"')).toBeTruthy();
    expect(res.text).toMatch(/Faltante de cambio/);
    expect(res.text).toMatch(/Sucursal corte/);
    expect(res.text).toMatch(/Cajero corte/);

    const invalid = await request(app.getHttpServer()).get('/api/cash-cuts/abc/export').set(headers(fixture.tenantId));
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.mensaje).toBe('ID de corte inválido');

    const unknown = await request(app.getHttpServer()).get('/api/cash-cuts/999999999/export').set(headers(fixture.tenantId));
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.mensaje).toBe('Corte de caja no encontrado');

    const otherTenant = await request(app.getHttpServer())
      .get(`/api/cash-cuts/${cutId}/export`)
      .set(headers(fixture.tenantId + 999999));
    expect(otherTenant.status).toBe(404);
  });
});
