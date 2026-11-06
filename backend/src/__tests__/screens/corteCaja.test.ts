import 'reflect-metadata';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import cashCutRoutes from '../../routes/cashCut.routes';
import { prisma } from '../../config/db';
import {
  formatLocalDate,
  parseDateOnly,
  resolvePeriod,
  round2,
  shiftForHour,
} from '../../services/cashCut.service';
import { buildApp, closeDatabase, createScreenFixture, headers, type ScreenFixture } from './support';

// Pantalla "Corte de caja" (HU 5.4)
// GET /cash-cuts/context · GET /cash-cuts/summary · POST /cash-cuts/close
// GET /cash-cuts · GET /cash-cuts/:id/export

const app = buildApp(cashCutRoutes);

describe('Reglas de turno del corte de caja', () => {
  it('asigna el turno según la hora del día', () => {
    assert.equal(shiftForHour(7), 'nocturno');
    assert.equal(shiftForHour(8), 'matutino');
    assert.equal(shiftForHour(14), 'matutino');
    assert.equal(shiftForHour(15), 'vespertino');
    assert.equal(shiftForHour(21), 'vespertino');
    assert.equal(shiftForHour(22), 'nocturno');
    assert.equal(shiftForHour(0), 'nocturno');
  });

  it('el turno nocturno termina al día siguiente', () => {
    const { start, end } = resolvePeriod('2026-01-15', 'nocturno');
    assert.equal(start.getDate(), 15);
    assert.equal(start.getHours(), 22);
    assert.equal(end.getDate(), 16);
    assert.equal(end.getHours(), 8);
  });

  it('valida fechas reales y rechaza días inexistentes', () => {
    assert.equal(formatLocalDate(new Date(2024, 1, 29)), '2024-02-29');
    const parsed = parseDateOnly('2024-02-29');
    assert.equal(parsed.getUTCFullYear(), 2024);
    assert.equal(parsed.getUTCMonth(), 1);
    assert.equal(parsed.getUTCDate(), 29);
    assert.throws(() => parseDateOnly('2026-02-30'), /Fecha inválida/);
    assert.throws(() => parseDateOnly('2026-13-01'), /Fecha inválida/);
    assert.throws(() => parseDateOnly('sin-fecha'), /Fecha inválida/);
  });

  it('redondea a centavos', () => {
    assert.equal(round2(1.005), 1.01);
    assert.equal(round2(10.994), 10.99);
    assert.equal(round2(0), 0);
  });
});

describe('Pantalla de corte de caja', () => {
  const FECHA = '2026-01-15';
  const MATUTINO = { shift: 'matutino', date: FECHA };

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

  before(async () => {
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

  after(async () => {
    await fixture.cleanup();
    await closeDatabase();
  });

  it('carga el contexto de sucursales, cajeros y turnos', async () => {
    // El cajero por defecto es quien registró el último pago del laboratorio.
    await fixture.createOrder({
      createdAt: new Date(2025, 0, 1, 9),
      cashierId: fixture.admin.id,
      payments: [{ method: 'cash', amount: 1 }],
    });

    const res = await request(app).get('/api/cash-cuts/context').set(headers(fixture.tenantId));

    assert.equal(res.status, 200);
    assert.equal(res.body.tenant.id, fixture.tenantId);
    assert.equal(res.body.currentUser.id, fixture.admin.id);
    assert.equal(res.body.currentUser.role, 'admin');
    assert.ok(res.body.branches.some((branch: { id: number }) => branch.id === fixture.branchId));
    assert.equal(res.body.cashiers.length, 2);
    assert.deepEqual(
      res.body.shifts.map((shift: { value: string }) => shift.value),
      ['matutino', 'vespertino', 'nocturno'],
    );
    assert.match(res.body.today, /^\d{4}-\d{2}-\d{2}$/);
  });

  it('rechaza parámetros inválidos del resumen', async () => {
    const missing = await request(app).get('/api/cash-cuts/summary').set(headers(fixture.tenantId));
    assert.equal(missing.status, 400);
    assert.equal(missing.body.error, 'Parámetros inválidos');

    const invalidShift = await request(app)
      .get(`/api/cash-cuts/summary?${scopeQuery({ shift: 'tarde' })}`)
      .set(headers(fixture.tenantId));
    assert.equal(invalidShift.status, 400);
    assert.equal(invalidShift.body.error, 'Parámetros inválidos');

    const invalidDate = await request(app)
      .get(`/api/cash-cuts/summary?${scopeQuery({ date: '2026-02-30' })}`)
      .set(headers(fixture.tenantId));
    assert.equal(invalidDate.status, 400);
    assert.equal(invalidDate.body.error, 'Fecha inválida');

    const unknownBranch = await request(app)
      .get(`/api/cash-cuts/summary?${scopeQuery({ branchId: '999999999' })}`)
      .set(headers(fixture.tenantId));
    assert.equal(unknownBranch.status, 404);
    assert.equal(unknownBranch.body.error, 'Sucursal no encontrada');
  });

  it('calcula los acumulados del turno y clasifica los movimientos', async () => {
    const res = await request(app)
      .get(`/api/cash-cuts/summary?${scopeQuery()}`)
      .set(headers(fixture.tenantId));

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'open');
    assert.equal(res.body.scope.branchName, 'Sucursal corte');
    assert.equal(res.body.scope.cashierName, 'Cajero corte');
    assert.equal(res.body.scope.shiftLabel, 'Matutino');
    assert.equal(res.body.scope.schedule, '08:00 – 15:00');

    assert.deepEqual(res.body.summary, {
      cashTotal: 300,
      cardTotal: 50,
      transferTotal: 75,
      ordersCount: 5,
      discountsTotal: 10,
      cancellationsCount: 1,
      totalPaid: 425,
      expectedCash: 300,
    });

    assert.equal(res.body.movements.length, 5);
    const byId = new Map<number, { method: string; methodLabel: string; amount: number }>(
      res.body.movements.map((movement: { id: number; method: string; methodLabel: string; amount: number }) => [
        movement.id,
        movement,
      ]),
    );
    assert.equal(byId.get(orderCash.id)?.methodLabel, 'Efectivo');
    assert.equal(byId.get(orderMixed.id)?.methodLabel, 'Efectivo + tarjeta');
    assert.equal(byId.get(orderTransfer.id)?.methodLabel, 'Transferencia');
    assert.equal(byId.get(orderCancelled.id)?.methodLabel, 'Cancelado');
    assert.equal(byId.get(orderPending.id)?.methodLabel, 'Pendiente');
    assert.equal(byId.has(orderOutside.id), false);
    assert.equal(byId.has(orderOtherCashier.id), false);
  });

  it('aísla el corte por laboratorio, sucursal y cajero', async () => {
    const otherCashier = await request(app)
      .get(
        `/api/cash-cuts/summary?${scopeQuery({
          cashierId: String(fixture.admin.id),
        })}`,
      )
      .set(headers(fixture.tenantId));

    assert.equal(otherCashier.status, 200);
    assert.equal(otherCashier.body.summary.ordersCount, 1);
    assert.equal(otherCashier.body.summary.cashTotal, 999);

    const otherTenant = await request(app)
      .get(`/api/cash-cuts/summary?${scopeQuery()}`)
      .set(headers(fixture.tenantId + 999999));

    assert.equal(otherTenant.status, 404);
    assert.equal(otherTenant.body.error, 'Sucursal no encontrada');
  });

  it('exige observación cuando el efectivo contado tiene diferencia', async () => {
    const res = await request(app)
      .post('/api/cash-cuts/close')
      .set(headers(fixture.tenantId))
      .send(closeBody({ countedCash: 290 }));

    assert.equal(res.status, 400);
    assert.equal(
      res.body.error,
      'La observación es obligatoria cuando el efectivo contado presenta una diferencia',
    );
  });

  it('valida el efectivo contado y la observación', async () => {
    const negative = await request(app)
      .post('/api/cash-cuts/close')
      .set(headers(fixture.tenantId))
      .send(closeBody({ countedCash: -1 }));

    assert.equal(negative.status, 400);
    assert.equal(negative.body.error, 'Datos inválidos');

    const longObservation = await request(app)
      .post('/api/cash-cuts/close')
      .set(headers(fixture.tenantId))
      .send(closeBody({ countedCash: 300, observation: 'a'.repeat(501) }));

    assert.equal(longObservation.status, 400);
    assert.equal(longObservation.body.error, 'Datos inválidos');
  });

  it('cierra el corte, congela el resumen y liga los pagos al corte', async () => {
    const res = await request(app)
      .post('/api/cash-cuts/close')
      .set(headers(fixture.tenantId))
      .send(closeBody({ countedCash: 290, observation: 'Faltante de cambio' }));

    assert.equal(res.status, 201);
    assert.equal(res.body.status, 'closed');
    assert.equal(res.body.countedCash, 290);
    assert.equal(res.body.difference, -10);
    assert.equal(res.body.observation, 'Faltante de cambio');
    assert.equal(res.body.summary.cashTotal, 300);
    assert.equal(res.body.summary.expectedCash, 300);

    cutId = res.body.cutId;
    const linkedPayments = await prisma.payment.count({ where: { cashCutId: cutId } });
    assert.equal(linkedPayments, 4);

    const repeated = await request(app)
      .post('/api/cash-cuts/close')
      .set(headers(fixture.tenantId))
      .send(closeBody({ countedCash: 290, observation: 'Otra vez' }));

    assert.equal(repeated.status, 409);
    assert.equal(repeated.body.error, 'El corte de caja ya está cerrado y no puede modificarse');
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

    const res = await request(app)
      .get(`/api/cash-cuts/summary?${scopeQuery()}`)
      .set(headers(fixture.tenantId));

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'closed');
    assert.equal(res.body.cutId, cutId);
    assert.equal(res.body.countedCash, 290);
    assert.equal(res.body.difference, -10);
    assert.equal(res.body.observation, 'Faltante de cambio');
    assert.equal(res.body.summary.cashTotal, 300);
    assert.equal(res.body.summary.totalPaid, 425);
    assert.equal(res.body.movements.length, 5);
  });

  it('lista el historial de cortes cerrados', async () => {
    const res = await request(app).get('/api/cash-cuts').set(headers(fixture.tenantId));

    assert.equal(res.status, 200);
    const cut = res.body.find((item: { id: number }) => item.id === cutId);
    assert.ok(cut);
    assert.equal(cut.branch.name, 'Sucursal corte');
    assert.equal(cut.cashier.fullName, 'Cajero corte');
    assert.equal(cut.shift, 'matutino');
    assert.equal(cut.status, 'closed');
    assert.equal(cut.expectedCash, 300);
    assert.equal(cut.countedCash, 290);
    assert.equal(cut.difference, -10);
    assert.equal(cut.observation, 'Faltante de cambio');
    assert.equal(cut.closedBy.id, fixture.cashier.id);
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

      const contexto = await request(app)
        .get('/api/cash-cuts/context')
        .set(headers(tenant.id));
      assert.equal(contexto.status, 200);
      assert.equal(contexto.body.currentUser, null);
      assert.deepEqual(contexto.body.cashiers, []);

      const query = new URLSearchParams({
        branchId: String(branch.id),
        cashierId: '0',
        shift: 'matutino',
        date: '2026-01-20',
      }).toString();

      const abierto = await request(app)
        .get(`/api/cash-cuts/summary?${query}`)
        .set(headers(tenant.id));
      assert.equal(abierto.status, 200);
      assert.equal(abierto.body.scope.cashierName, 'Sin asignar');
      assert.equal(abierto.body.summary.cashTotal, 200);

      const cierre = await request(app)
        .post('/api/cash-cuts/close')
        .set(headers(tenant.id))
        .send({
          branchId: branch.id,
          cashierId: 0,
          shift: 'matutino',
          date: '2026-01-20',
          countedCash: 200,
        });
      assert.equal(cierre.status, 201);
      assert.equal(cierre.body.cashier, 'Sin asignar');

      const repetido = await request(app)
        .post('/api/cash-cuts/close')
        .set(headers(tenant.id))
        .send({
          branchId: branch.id,
          cashierId: 0,
          shift: 'matutino',
          date: '2026-01-20',
          countedCash: 200,
        });
      assert.equal(repetido.status, 409);

      const guardado = await prisma.cashCut.findUnique({ where: { id: cierre.body.cutId } });
      assert.ok(guardado?.cashierId && guardado.cashierId > 0);
      assert.equal(guardado?.closedById, null);
      const tecnico = await prisma.user.findUnique({ where: { id: guardado?.cashierId } });
      assert.equal(tecnico?.fullName, 'Sin asignar');
      assert.match(tecnico?.email ?? '', /@sistema\.local$/);

      const cerrado = await request(app)
        .get(`/api/cash-cuts/summary?${query}`)
        .set(headers(tenant.id));
      assert.equal(cerrado.status, 200);
      assert.equal(cerrado.body.status, 'closed');
      assert.equal(cerrado.body.summary.cashTotal, 200);

      const historial = await request(app)
        .get('/api/cash-cuts')
        .set(headers(tenant.id));
      assert.equal(historial.status, 200);
      assert.equal(historial.body[0].cashier.fullName, 'Sin asignar');
      assert.equal(historial.body[0].closedBy, null);

      const exportado = await request(app)
        .get(`/api/cash-cuts/${cierre.body.cutId}/export`)
        .set(headers(tenant.id));
      assert.equal(exportado.status, 200);
      assert.match(exportado.text, /Sin asignar/);
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
    const res = await request(app)
      .get(`/api/cash-cuts/${cutId}/export`)
      .set(headers(fixture.tenantId));

    assert.equal(res.status, 200);
    assert.match(String(res.headers['content-type']), /text\/csv/);
    assert.match(String(res.headers['content-disposition']), /corte-caja-/);
    assert.ok(res.text.startsWith('\uFEFF"Reporte","Corte de caja"'));
    assert.match(res.text, /Faltante de cambio/);
    assert.match(res.text, /Sucursal corte/);
    assert.match(res.text, /Cajero corte/);

    const invalid = await request(app).get('/api/cash-cuts/abc/export').set(headers(fixture.tenantId));
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error, 'ID de corte inválido');

    const unknown = await request(app).get('/api/cash-cuts/999999999/export').set(headers(fixture.tenantId));
    assert.equal(unknown.status, 404);
    assert.equal(unknown.body.error, 'Corte de caja no encontrado');

    const otherTenant = await request(app)
      .get(`/api/cash-cuts/${cutId}/export`)
      .set(headers(fixture.tenantId + 999999));
    assert.equal(otherTenant.status, 404);
  });
});
