import express, { type Application } from 'express';
import type { Router } from 'express';
import { prisma } from '../prisma-pruebas';

// Utilidades compartidas por las pruebas de pantalla.
// Cada archivo crea su propio laboratorio (tenant) de QA para no tocar datos reales
// y lo elimina al terminar.

export function buildApp(...routers: Router[]): Application {
  const app = express();
  app.use(express.json());
  for (const router of routers) {
    app.use('/api', router);
  }
  return app;
}

export function headers(tenantId: number, extra: Record<string, string> = {}) {
  return { 'x-tenant-id': String(tenantId), ...extra };
}

type OrderStatus = 'pending' | 'in_process' | 'completed' | 'cancelled';
type PaymentMethod = 'cash' | 'card' | 'transfer';

export interface OrderItemInput {
  price: number;
  testId?: number;
  profileId?: number;
}

export interface OrderPaymentInput {
  method: PaymentMethod;
  amount: number;
  reference?: string;
  cancelled?: boolean;
}

export interface OrderInput {
  patientId?: number;
  status?: OrderStatus;
  cashierId?: number | null;
  createdAt?: Date;
  totalAmount?: number;
  discountPercent?: number;
  discountAmount?: number;
  resultsDeliveredAt?: Date | null;
  doctorName?: string | null;
  items?: OrderItemInput[];
  payments?: OrderPaymentInput[];
}

export async function createScreenFixture(label: string) {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const emailBase = `qa-${label}-${suffix}`;

  const tenant = await prisma.tenant.create({
    data: { name: `Laboratorio QA ${label}`, subdomain: `qa-${label}-${suffix}`.slice(0, 50) },
  });
  const branch = await prisma.branch.create({
    data: { tenantId: tenant.id, name: `Sucursal ${label}` },
  });
  const admin = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      branchId: branch.id,
      fullName: `Administradora ${label}`,
      email: `${emailBase}-admin@example.test`,
      passwordHash: 'qa',
      role: 'admin',
    },
  });
  const cashier = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      branchId: branch.id,
      fullName: `Cajero ${label}`,
      email: `${emailBase}-cajero@example.test`,
      passwordHash: 'qa',
      role: 'receptionist',
    },
  });
  const patient = await prisma.patient.create({
    data: {
      tenantId: tenant.id,
      firstName: 'Paciente',
      lastName: label,
      birthDate: new Date(1990, 0, 1),
      gender: 'F',
      patientCode: `P-${suffix}`,
    },
  });

  let folioSeq = 0;

  async function createOrder(input: OrderInput = {}) {
    const {
      patientId = patient.id,
      status = 'pending',
      cashierId = cashier.id,
      createdAt,
      totalAmount = 0,
      discountPercent = 0,
      discountAmount = 0,
      resultsDeliveredAt = null,
      doctorName = null,
      items = [],
      payments = [],
    } = input;

    return prisma.order.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        patientId,
        cashierId,
        totalAmount,
        discountPercent,
        discountAmount,
        status,
        resultsDeliveredAt,
        doctorName,
        folio: `QA-${suffix}-${++folioSeq}`,
        ...(createdAt ? { createdAt } : {}),
        ...(items.length > 0
          ? {
              items: {
                create: items.map(item => ({
                  price: item.price,
                  ...(item.testId ? { testId: item.testId } : {}),
                  ...(item.profileId ? { profileId: item.profileId } : {}),
                })),
              },
            }
          : {}),
        ...(payments.length > 0
          ? {
              payments: {
                create: payments.map(payment => ({
                  tenantId: tenant.id,
                  branchId: branch.id,
                  cashierId,
                  method: payment.method,
                  amount: payment.amount,
                  reference: payment.reference ?? null,
                  cancelled: payment.cancelled ?? false,
                  createdBy: `Cajero ${label}`,
                })),
              },
            }
          : {}),
      },
      include: { items: true, payments: true },
    });
  }

  async function cleanup() {
    // Se borra de hijos a padres para respetar las llaves foráneas.
    await prisma.criticalNotification.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.testResult.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.instructionDelivery.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.instructionConfirmation.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.paymentLog.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.payment.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.orderReport.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.cashCut.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.sample.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.order.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.reportTemplate.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.testCatalog.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.profileCatalog.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.patient.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.doctor.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.user.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.branch.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.deleteMany({ where: { id: tenant.id } });
  }

  return {
    tenant,
    branch,
    admin,
    cashier,
    patient,
    tenantId: tenant.id,
    branchId: branch.id,
    createOrder,
    cleanup,
  };
}

export type ScreenFixture = Awaited<ReturnType<typeof createScreenFixture>>;

export async function closeDatabase() {
  await prisma.$disconnect();
}
