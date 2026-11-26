import { crearCuentasDeAcceso } from './seeds/acceso-demo';
import { crearRolesBase } from './seeds/roles';
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { sembrarDemo } from './seeds/demo';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') return;
  if (process.argv.includes('--solo-acceso')) {
    const demo = await prisma.tenant.findUnique({ where: { subdomain: 'central' }, include: { branches: true } });
    const central = demo?.branches.find(b => b.name === 'Clínica Central');
    const norte = demo?.branches.find(b => b.name === 'Clínica Norte');
    if (!demo || demo.name !== 'Laboratorio Santa Lucía' || !central || !norte) throw new Error('Se requiere el laboratorio demo Santa Lucía con sus dos sucursales.');
    await prisma.$transaction(async tx => {
      const roles = await crearRolesBase(tx, demo.id);
      await crearCuentasDeAcceso(tx, demo.id, central.id, norte.id, roles.chemist);
    });
    console.log('Cuentas de acceso del laboratorio demo preparadas.');
    return;
  }
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
  console.log(`Laboratorio demo listo (id ${resumen.tenantId}, desarrollo).`);
}

main()
  .catch(error => {
    console.error('El seed falló:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
