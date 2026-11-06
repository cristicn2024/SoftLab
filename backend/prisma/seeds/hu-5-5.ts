import { PrismaClient } from '@prisma/client';
import type { ContextoSeed } from './contexto';

interface Escenario {
  key: string;
  name: string;
  status?: 'cancelled';
  discount?: number;
  payments: Array<{ amount: number; cancelled?: boolean }>;
  balance: number;
}

const scenarios: Escenario[] = [
  { key: 'sin-pago', name: 'Sin pago', payments: [], balance: 500 },
  { key: 'pago-parcial', name: 'Pago parcial', payments: [{ amount: 200 }], balance: 300 },
  { key: 'liquidada', name: 'Liquidada', payments: [{ amount: 500 }], balance: 0 },
  { key: 'descuento', name: 'Liquidada con descuento del 10%', discount: 10, payments: [{ amount: 450 }], balance: 0 },
  { key: 'pago-cancelado', name: 'Pago cancelado', payments: [{ amount: 500, cancelled: true }], balance: 500 },
  { key: 'orden-cancelada', name: 'Orden cancelada', status: 'cancelled', payments: [{ amount: 500 }], balance: 0 },
];

export async function sembrarHu55(prisma: PrismaClient, { tenant, branch }: ContextoSeed) {
  const rows = await prisma.$transaction(async tx => {
    const test = await tx.testCatalog.upsert({
      where: { uq_tenant_test_code: { tenantId: tenant.id, code: 'DEMO-HU55' } }, update: {},
      create: { tenantId: tenant.id, code: 'DEMO-HU55', name: 'Glucosa demo HU 5.5', price: 500,
        sampleType: 'Sangre', referenceRange: '70-99 mg/dL' },
    });
    if (!await tx.reportTemplate.findFirst({ where: { tenantId: tenant.id, isDefault: true } })) {
      await tx.reportTemplate.create({ data: {
        tenantId: tenant.id, name: 'Plantilla demo HU 5.5', isDefault: true,
        chemistName: 'Químico Demo', chemistCedula: 'DEMO-555',
        footerText: 'Datos ficticios para pruebas de entrega de resultados.',
      } });
    }
    const rows: Array<Record<string, unknown>> = [];
    for (const scenario of scenarios) {
      // Marcador estable, sin IDs fijos de órdenes ni cambios en pacientes reales.
      const email = `hu55.${scenario.key}@example.invalid`;
      let patient = await tx.patient.findFirst({ where: { tenantId: tenant.id, email } });
      if (!patient) patient = await tx.patient.create({ data: {
        tenantId: tenant.id, firstName: 'Demo HU55', lastName: scenario.name,
        birthDate: new Date('1990-01-15T00:00:00Z'), gender: 'F', email,
      } });
      let order = await tx.order.findFirst({
        where: { tenantId: tenant.id, patientId: patient.id }, orderBy: { id: 'asc' },
      });
      const existing = Boolean(order);
      if (!order) {
        const paid = scenario.payments.filter(p => !p.cancelled).reduce((sum, p) => sum + p.amount, 0);
        order = await tx.order.create({ data: {
          tenantId: tenant.id, branchId: branch.id, patientId: patient.id,
          status: scenario.status ?? 'completed', totalAmount: scenario.discount ? 450 : 500,
          paidAmount: paid, discountPercent: scenario.discount ?? 0,
          discountReason: scenario.discount ? 'Descuento demo HU 5.5' : null,
          discountAuthorizedBy: scenario.discount ? 'Administrador Demo' : null,
          doctorName: 'Médico Demo',
          items: { create: { testId: test.id, price: 500, testResults: { create: {
            tenantId: tenant.id, resultValue: '92', status: 'validated', validatedAt: new Date(),
          } } } },
          payments: { create: scenario.payments.map(p => ({
            tenantId: tenant.id, branchId: branch.id, method: 'cash', amount: p.amount,
            createdBy: 'Seed HU 5.5', cancelled: Boolean(p.cancelled),
            cancelReason: p.cancelled ? 'Cancelación demo HU 5.5' : null,
            cancelledBy: p.cancelled ? 'Administrador Demo' : null,
            cancelledAt: p.cancelled ? new Date() : null,
          })) },
          paymentLogs: { create: { tenantId: tenant.id, userName: 'Seed HU 5.5',
            action: 'Escenario de prueba creado', detail: scenario.name } },
        } });
      }
      rows.push({ orden: order.id, escenario: scenario.name,
        saldoInicial: scenario.balance, estadoSeed: existing ? 'Conservada (puede haber cambiado)' : 'Creada',
        entrega: `/resultados/entrega?orden=${order.id}` });
    }
    return rows;
  }, { timeout: 30000 });
  console.table(rows);
  console.log(`Laboratorio: ${tenant.id}. Las órdenes existentes no se reinician. Consulta el saldo actual en Cobro.`);
}
