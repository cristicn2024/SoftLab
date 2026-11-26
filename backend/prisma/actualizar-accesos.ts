import { createConnection } from 'mysql2/promise';
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { crearRolesBase } from './seeds/roles';

const prisma = new PrismaClient();

// El arranque de desarrollo usa db push, que omite los datos y triggers de la migración.
async function actualizar() {
  for (const { id: tenantId } of await prisma.tenant.findMany({ select: { id: true } })) {
    const roles = await crearRolesBase(prisma, tenantId);
    for (const role of ['admin', 'receptionist', 'chemist', 'doctor'] as const) {
      await prisma.user.updateMany({ where: { tenantId, role, accessRoleId: null }, data: { accessRoleId: roles[role] } });
    }
  }
  // MySQL no admite CREATE TRIGGER como sentencia preparada.
  const conexion = await createConnection(process.env.DATABASE_URL!);
  try {
    await conexion.query("CREATE TRIGGER IF NOT EXISTS auth_events_no_update BEFORE UPDATE ON auth_events FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La bitácora de autenticación es inmutable'");
    await conexion.query("CREATE TRIGGER IF NOT EXISTS auth_events_no_delete BEFORE DELETE ON auth_events FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La bitácora de autenticación es inmutable'");
  } finally { await conexion.end(); }
}
actualizar().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
