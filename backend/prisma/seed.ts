import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { CLAVE_DEMO, sembrarDemo } from './seeds/demo';

const prisma = new PrismaClient();

async function main() {
  const soloSiVacia = process.argv.slice(2).includes('--si-vacia');

  if (soloSiVacia) {
    const laboratorios = await prisma.tenant.count();
    if (laboratorios > 0) {
      console.log('La base ya tiene datos, no se cargó el seed. Para recrear el laboratorio demo: npm run db:seed');
      return;
    }
  }

  const resumen = await sembrarDemo(prisma);
  console.table(resumen.filas);
  console.log(`Laboratorio demo listo (id ${resumen.tenantId}, el que usa el frontend en x-tenant-id).`);
  console.log(`Cuentas de prueba @santalucia.demo, contraseña "${CLAVE_DEMO}": laura.mendez (admin), carlos.ibarra y daniela.soto (recepción), andrea.ruiz y marco.pena (químicos).`);
}

main()
  .catch(error => {
    console.error('El seed falló:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
