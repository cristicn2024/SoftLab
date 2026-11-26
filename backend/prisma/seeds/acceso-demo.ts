import type { Prisma } from '@prisma/client';
import { hashClave } from '../../src/auth/claves';

export const CLAVE_DEMO = 'softlab2026';

export async function crearCuentasDeAcceso(tx: Prisma.TransactionClient, tenantId: number,
  central: number, norte: number, rolQuimica: number) {
  const coordinacion = await tx.accessRole.upsert({
    where: { tenantId_code: { tenantId, code: 'coordinacion' } }, update: {},
    create: { tenantId, code: 'coordinacion', name: 'Coordinación de resultados', permissions: ['resultados', 'entrega'] },
  });
  const base = { tenantId, role: 'chemist' as const };
  const cuentas = [
    { ...base, fullName: 'Coordinación Demo', email: 'coordinacion@santalucia.demo', accessRoleId: coordinacion.id, branchId: central },
    { ...base, fullName: 'Cuenta inactiva', email: 'inactivo@santalucia.demo', accessRoleId: rolQuimica, branchId: central, active: false },
    { ...base, fullName: 'Sin sucursal', email: 'sin.sucursal@santalucia.demo', accessRoleId: rolQuimica, branchId: null },
  ];
  for (const cuenta of cuentas) {
    if (await tx.user.findUnique({ where: { email: cuenta.email } })) continue;
    const nuevo = await tx.user.create({ data: { ...cuenta, passwordHash: await hashClave(CLAVE_DEMO) } });
    if (cuenta.accessRoleId === coordinacion.id) {
      await tx.userBranch.create({ data: { userId: nuevo.id, branchId: norte } });
    }
  }
}
