import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { sembrarBase } from './seeds/base';
import { sembrarHu5262 } from './seeds/hu-5-2-6-2';
import { sembrarHu61 } from './seeds/hu-6-1';
import { sembrarCorteCaja } from './seeds/corte-caja';
import { sembrarHu55 } from './seeds/hu-5-5';

const prisma = new PrismaClient();

const NOMBRES = ['todo', 'base', 'hu-5-2-6-2', 'hu-6-1', 'corte-caja', 'hu-5-5'];

async function main() {
  const argumentos = process.argv.slice(2);
  const soloSiVacia = argumentos.includes('--si-vacia');
  let nombre = 'todo';
  for (const argumento of argumentos) {
    if (argumento !== '--si-vacia') {
      nombre = argumento;
    }
  }
  if (!NOMBRES.includes(nombre)) {
    throw new Error(`Seed desconocido "${nombre}". Opciones: ${NOMBRES.join(', ')}`);
  }

  if (soloSiVacia) {
    const laboratorios = await prisma.tenant.count();
    if (laboratorios > 0) {
      console.log('La base ya tiene datos, no se cargó el seed. Para cargarlo: npm run db:seed');
      return;
    }
  }

  const contexto = await sembrarBase(prisma);
  const todo = nombre === 'todo';

  if (todo || nombre === 'hu-5-2-6-2' || nombre === 'hu-6-1') {
    await sembrarHu5262(prisma, contexto);
  }
  if (todo || nombre === 'hu-6-1') {
    await sembrarHu61(prisma, contexto);
  }
  if (todo || nombre === 'corte-caja') {
    await sembrarCorteCaja(prisma, contexto);
  }
  if (todo || nombre === 'hu-5-5') {
    await sembrarHu55(prisma, contexto);
  }

  console.log(`Datos de prueba listos. El frontend usa el laboratorio ${contexto.tenant.id} (x-tenant-id).`);
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
