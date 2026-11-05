import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

type DemoOrder = {
  folio: string;
  firstName: string;
  lastName: string;
  patientCode: string;
  gender: 'M' | 'F';
  ageYears: number;
  testCodes: string[];
  barcode: string;
  sampleDescription: string;
};

const DEMO_ORDERS: DemoOrder[] = [
  {
    folio: 'SL-W-0001',
    firstName: 'Carlos',
    lastName: 'Ramírez Soto',
    patientCode: 'P-000301',
    gender: 'M',
    ageYears: 45,
    testCodes: ['GLU001', 'PERF02'],
    barcode: 'SL-W-0001-AMARILLO',
    sampleDescription: 'Suero · tubo amarillo',
  },
  {
    folio: 'SL-W-0002',
    firstName: 'Lucía',
    lastName: 'Fernández Ortiz',
    patientCode: 'P-000302',
    gender: 'F',
    ageYears: 29,
    testCodes: ['GLU001', 'BH001'],
    barcode: 'SL-W-0002-AMARILLO',
    sampleDescription: 'Suero · tubo amarillo',
  },
  {
    folio: 'SL-W-0003',
    firstName: 'Mateo',
    lastName: 'Salazar Peña',
    patientCode: 'P-000303',
    gender: 'M',
    ageYears: 6,
    testCodes: ['GLU001'],
    barcode: 'SL-W-0003-AMARILLO',
    sampleDescription: 'Suero · tubo amarillo',
  },
];

function birthDateFor(ageYears: number): Date {
  const days = ageYears * 365.25 + 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function seedDemoOrder(tenantId: number, branchId: number, demo: DemoOrder) {
  let patient = await prisma.patient.findFirst({
    where: { tenantId, firstName: demo.firstName, lastName: demo.lastName },
  });
  if (!patient) {
    patient = await prisma.patient.create({
      data: {
        tenantId,
        firstName: demo.firstName,
        lastName: demo.lastName,
        birthDate: birthDateFor(demo.ageYears),
        gender: demo.gender,
        patientCode: demo.patientCode,
      },
    });
  }

  const tests = await prisma.testCatalog.findMany({
    where: { tenantId, code: { in: demo.testCodes } },
  });
  if (tests.length !== demo.testCodes.length) {
    throw new Error('Faltan estudios en el catálogo. Corre primero: npm run seed:hu-5-2-6-2');
  }

  let total = 0;
  for (const test of tests) {
    total = total + Number(test.price);
  }

  let order = await prisma.order.findUnique({ where: { folio: demo.folio } });
  if (!order) {
    order = await prisma.order.create({
      data: {
        tenantId,
        branchId,
        patientId: patient.id,
        folio: demo.folio,
        totalAmount: total,
        status: 'in_process',
      },
    });
  }

  for (const test of tests) {
    const existingItem = await prisma.orderItem.findFirst({
      where: { orderId: order.id, testId: test.id },
    });
    if (!existingItem) {
      await prisma.orderItem.create({
        data: { orderId: order.id, testId: test.id, price: test.price },
      });
    }
  }

  const items = await prisma.orderItem.findMany({ where: { orderId: order.id } });
  const itemIds: number[] = [];
  for (const item of items) {
    itemIds.push(item.id);
  }
  await prisma.testResult.deleteMany({ where: { orderItemId: { in: itemIds } } });

  const existingSample = await prisma.sample.findUnique({ where: { barcode: demo.barcode } });
  if (!existingSample) {
    const now = new Date();
    await prisma.sample.create({
      data: {
        tenantId,
        orderId: order.id,
        barcode: demo.barcode,
        status: 'received',
        collectedAt: now,
        receivedAt: now,
        sampleDescription: demo.sampleDescription,
      },
    });
  } else {
    await prisma.sample.update({
      where: { id: existingSample.id },
      data: { status: 'received' },
    });
  }
}

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { name: 'Laboratorio Santa Lucía' } });
  if (!tenant) {
    throw new Error('No existe el laboratorio de prueba. Corre primero: npm run seed:hu-5-2-6-2');
  }
  const branch = await prisma.branch.findFirst({
    where: { tenantId: tenant.id, name: 'Clínica Central' },
  });
  if (!branch) {
    throw new Error('No existe la sucursal de prueba. Corre primero: npm run seed:hu-5-2-6-2');
  }

  for (const demo of DEMO_ORDERS) {
    await seedDemoOrder(tenant.id, branch.id, demo);
  }

  console.log(`Seed HU 6.1 listo. Laboratorio "${tenant.name}" con id ${tenant.id}.`);
  console.log('Si ese id no es 1, cambia x-tenant-id en frontend/src/services/api.ts');
}

async function run() {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

run();
