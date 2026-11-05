import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function dateOnly(date: Date) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

function at(date: Date, hour: number, minute: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0, 0);
}

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { subdomain: 'central' },
    update: { name: 'Laboratorio Santa Lucía', status: 'active' },
    create: {
      name: 'Laboratorio Santa Lucía',
      subdomain: 'central',
      status: 'active'
    }
  });

  const branch =
    (await prisma.branch.findFirst({ where: { tenantId: tenant.id }, orderBy: { id: 'asc' } })) ??
    (await prisma.branch.create({
      data: {
        tenantId: tenant.id,
        name: 'Clínica Central',
        address: 'Av. Principal 100',
        phone: '555-0100'
      }
    }));

  await prisma.branch.update({
    where: { id: branch.id },
    data: { name: 'Clínica Central' }
  });

  let secondBranch = await prisma.branch.findFirst({
    where: { tenantId: tenant.id, name: 'Clínica Norte' }
  });
  if (!secondBranch) {
    secondBranch = await prisma.branch.create({
      data: {
        tenantId: tenant.id,
        name: 'Clínica Norte',
        address: 'Blvd. Norte 250',
        phone: '555-0200'
      }
    });
  }

  const cashier = await prisma.user.upsert({
    where: { email: 'laura.mendez@central.com' },
    update: {
      tenantId: tenant.id,
      branchId: branch.id,
      fullName: 'Laura Méndez',
      role: 'receptionist'
    },
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      fullName: 'Laura Méndez',
      email: 'laura.mendez@central.com',
      passwordHash: '$2b$10$demo.hash.not.real',
      role: 'receptionist'
    }
  });

  const secondCashier = await prisma.user.upsert({
    where: { email: 'carlos.ruiz@central.com' },
    update: {
      tenantId: tenant.id,
      branchId: secondBranch.id,
      fullName: 'Carlos Ruiz',
      role: 'receptionist'
    },
    create: {
      tenantId: tenant.id,
      branchId: secondBranch.id,
      fullName: 'Carlos Ruiz',
      email: 'carlos.ruiz@central.com',
      passwordHash: '$2b$10$demo.hash.not.real',
      role: 'receptionist'
    }
  });

  const patient =
    (await prisma.patient.findFirst({ where: { tenantId: tenant.id }, orderBy: { id: 'asc' } })) ??
    (await prisma.patient.create({
      data: {
        tenantId: tenant.id,
        firstName: 'María',
        lastName: 'López García',
        birthDate: new Date('1987-05-14'),
        gender: 'F',
        phone: '555-123-4567',
        email: 'maria.lopez@example.com'
      }
    }));

  const doctor =
    (await prisma.doctor.findFirst({
      where: { tenantId: tenant.id, name: 'Roberto Salas' }
    })) ??
    (await prisma.doctor.create({
      data: {
        tenantId: tenant.id,
        name: 'Roberto Salas',
        cedula: '12345678',
        specialty: 'Medicina General',
        phone: '555-222-3333'
      }
    }));

  const testSeeds = [
    {
      code: 'BH',
      name: 'Biometría Hemática',
      price: 250,
      sampleType: 'Sangre (Tubo Rojo)',
      referenceRange: 'Hemoglobina 12-16 g/dL'
    },
    {
      code: 'QS',
      name: 'Química Sanguínea',
      price: 450,
      sampleType: 'Sangre (Tubo Amarillo)',
      referenceRange: 'Glucosa 70-100 mg/dL'
    },
    {
      code: 'EGO',
      name: 'Examen General de Orina',
      price: 180,
      sampleType: 'Orina',
      referenceRange: 'Sin alteraciones'
    }
  ];

  const tests: Record<string, { id: number; price: number }> = {};
  for (const seed of testSeeds) {
    const test = await prisma.testCatalog.upsert({
      where: { uq_tenant_test_code: { tenantId: tenant.id, code: seed.code } },
      update: {
        name: seed.name,
        price: seed.price,
        sampleType: seed.sampleType,
        referenceRange: seed.referenceRange
      },
      create: {
        tenantId: tenant.id,
        ...seed,
        genderRestriction: 'BOTH'
      }
    });
    tests[seed.code] = { id: test.id, price: Number(test.price) };
  }

  const today = new Date();
  const cutDate = dateOnly(today);

  // Datos demo idempotentes: se reemplaza el turno matutino de Laura.
  await prisma.cashCut.deleteMany({
    where: {
      tenantId: tenant.id,
      branchId: branch.id,
      cashierId: cashier.id,
      cutDate,
      shift: 'matutino'
    }
  });

  await prisma.order.deleteMany({
    where: {
      tenantId: tenant.id,
      folio: { startsWith: 'ORD-CORTE-' }
    }
  });

  const demoOrders = [
    {
      folio: 'ORD-CORTE-0001',
      hour: 8,
      minute: 15,
      total: 250,
      discount: 0,
      status: 'completed' as const,
      testCode: 'BH',
      payments: [{ method: 'cash' as const, amount: 250 }]
    },
    {
      folio: 'ORD-CORTE-0002',
      hour: 9,
      minute: 5,
      total: 500,
      discount: 50,
      status: 'completed' as const,
      testCode: 'QS',
      payments: [{ method: 'card' as const, amount: 450 }]
    },
    {
      folio: 'ORD-CORTE-0003',
      hour: 10,
      minute: 20,
      total: 900,
      discount: 0,
      status: 'completed' as const,
      testCode: 'EGO',
      payments: [{ method: 'transfer' as const, amount: 900 }]
    },
    {
      folio: 'ORD-CORTE-0004',
      hour: 11,
      minute: 10,
      total: 450,
      discount: 50,
      status: 'completed' as const,
      testCode: 'QS',
      payments: [
        { method: 'cash' as const, amount: 200 },
        { method: 'card' as const, amount: 200 }
      ]
    },
    {
      folio: 'ORD-CORTE-0005',
      hour: 12,
      minute: 30,
      total: 180,
      discount: 0,
      status: 'pending' as const,
      testCode: 'EGO',
      payments: []
    },
    {
      folio: 'ORD-CORTE-0006',
      hour: 13,
      minute: 45,
      total: 250,
      discount: 0,
      status: 'cancelled' as const,
      testCode: 'BH',
      payments: []
    }
  ];

  for (const demo of demoOrders) {
    const createdAt = at(today, demo.hour, demo.minute);
    const test = tests[demo.testCode];
    const paid = demo.payments.reduce((acc, payment) => acc + payment.amount, 0);

    await prisma.order.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        patientId: patient.id,
        doctorId: doctor.id,
        cashierId: cashier.id,
        totalAmount: demo.total,
        discountAmount: demo.discount,
        paidAmount: paid,
        status: demo.status,
        folio: demo.folio,
        createdAt,
        items: {
          create: [{ testId: test.id, price: demo.total }]
        },
        payments: {
          create: demo.payments.map(payment => ({
            tenantId: tenant.id,
            branchId: branch.id,
            cashierId: cashier.id,
            method: payment.method,
            amount: payment.amount,
            createdAt
          }))
        }
      }
    });
  }

  const cashTotal = demoOrders
    .flatMap(order => order.payments)
    .filter(payment => payment.method === 'cash')
    .reduce((acc, payment) => acc + payment.amount, 0);
  const cardTotal = demoOrders
    .flatMap(order => order.payments)
    .filter(payment => payment.method === 'card')
    .reduce((acc, payment) => acc + payment.amount, 0);
  const transferTotal = demoOrders
    .flatMap(order => order.payments)
    .filter(payment => payment.method === 'transfer')
    .reduce((acc, payment) => acc + payment.amount, 0);

  console.log('Seed de corte de caja completado:');
  console.log(`  laboratorio=${tenant.name} sucursal=${branch.name}`);
  console.log(`  cajero=${cashier.fullName} (id=${cashier.id})`);
  console.log(`  cajero secundario=${secondCashier.fullName}`);
  console.log(`  fecha=${cutDate.toISOString().slice(0, 10)} turno=matutino`);
  console.log(
    `  efectivo=${cashTotal} tarjeta=${cardTotal} transferencia=${transferTotal} ordenes=${demoOrders.length}`
  );
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
