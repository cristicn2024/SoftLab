import { Prisma, PrismaClient } from '@prisma/client';
import type { ContextoSeed } from './contexto';

const NOMBRE_LABORATORIO = 'Laboratorio Santa Lucía';

const CATALOGO_BASE = [
  { code: 'BH', name: 'Biometría Hemática', price: 250, sampleType: 'Sangre (Tubo Rojo)', referenceRange: 'Hemoglobina 12-16 g/dL' },
  { code: 'GLU001', name: 'Glucosa en ayuno', price: 120, sampleType: 'Sangre (Tubo Amarillo)', referenceRange: '70-99 mg/dL' },
  { code: 'PERF02', name: 'Perfil lipídico', price: 450, sampleType: 'Sangre (Tubo Amarillo)', referenceRange: 'Colesterol total < 200 mg/dL' },
  { code: 'EGO001', name: 'Examen general de orina', price: 90, sampleType: 'Orina (Frasco estéril)', referenceRange: 'Nitritos: Negativo' },
];

export async function sembrarBase(prisma: PrismaClient): Promise<ContextoSeed> {
  let tenant = await prisma.tenant.findFirst({ where: { name: NOMBRE_LABORATORIO } });
  if (!tenant) {
    const central = await prisma.tenant.findUnique({ where: { subdomain: 'central' } });
    if (central) {
      tenant = await prisma.tenant.update({
        where: { id: central.id },
        data: { name: NOMBRE_LABORATORIO, status: 'active' },
      });
    } else {
      tenant = await prisma.tenant.create({
        data: { name: NOMBRE_LABORATORIO, subdomain: 'central', status: 'active' },
      });
    }
  }

  let branch = await prisma.branch.findFirst({
    where: { tenantId: tenant.id, name: 'Clínica Central' },
  });
  if (!branch) {
    const primera = await prisma.branch.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { id: 'asc' },
    });
    if (primera) {
      branch = await prisma.branch.update({
        where: { id: primera.id },
        data: { name: 'Clínica Central' },
      });
    } else {
      branch = await prisma.branch.create({
        data: {
          tenantId: tenant.id,
          name: 'Clínica Central',
          address: 'Av. Principal 100',
          phone: '555-0100',
        },
      });
    }
  }

  await prisma.user.upsert({
    where: { email: 'admin@central.com' },
    update: {},
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      fullName: 'Admin Demo',
      email: 'admin@central.com',
      passwordHash: '$2b$10$hashedpassword',
      role: 'admin',
    },
  });

  const tests: Record<string, { id: number; price: Prisma.Decimal }> = {};
  for (const item of CATALOGO_BASE) {
    const test = await prisma.testCatalog.upsert({
      where: { uq_tenant_test_code: { tenantId: tenant.id, code: item.code } },
      update: {},
      create: {
        tenantId: tenant.id,
        code: item.code,
        name: item.name,
        price: item.price,
        sampleType: item.sampleType,
        referenceRange: item.referenceRange,
      },
    });
    tests[item.code] = { id: test.id, price: test.price };
  }

  let patient = await prisma.patient.findFirst({
    where: { tenantId: tenant.id, firstName: 'María', lastName: 'López García' },
  });
  if (!patient) {
    patient = await prisma.patient.create({
      data: {
        tenantId: tenant.id,
        firstName: 'María',
        lastName: 'López García',
        birthDate: new Date('1988-03-12'),
        gender: 'F',
        phone: '6445550042',
        email: 'maria.lopez@correo.com',
      },
    });
  }

  const doctorName = 'Dra. Patricia Ruiz · Medicina interna';
  let order = await prisma.order.findFirst({
    where: { tenantId: tenant.id, patientId: patient.id, doctorName },
    orderBy: { id: 'asc' },
  });
  if (!order) {
    order = await prisma.order.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        patientId: patient.id,
        totalAmount: 910,
        doctorName,
      },
    });
  }
  const conceptos = await prisma.orderItem.count({ where: { orderId: order.id } });
  if (conceptos === 0) {
    for (const code of ['BH', 'GLU001', 'PERF02', 'EGO001']) {
      await prisma.orderItem.create({
        data: { orderId: order.id, testId: tests[code].id, price: tests[code].price },
      });
    }
  }

  console.log(`Base lista: laboratorio "${tenant.name}" (id ${tenant.id}), sucursal "${branch.name}".`);
  return { tenant, branch };
}
