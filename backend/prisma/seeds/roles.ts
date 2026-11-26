import type { Prisma } from '@prisma/client';

const rolesBase = [
  { code: 'admin', name: 'Administración', permissions: ["ordenes","catalogo","catalogo.editar","cobro","caja","entrega","resultados","referencias","plantillas"] },
  { code: 'receptionist', name: 'Recepción', permissions: ["ordenes","cobro","caja","entrega","catalogo"] },
  { code: 'chemist', name: 'Química', permissions: ["resultados","referencias","entrega","catalogo"] },
  { code: 'doctor', name: 'Médico', permissions: ["entrega"] },
];

export async function crearRolesBase(tx: Prisma.TransactionClient, tenantId: number) {
  await tx.accessRole.createMany({ data: rolesBase.map(rol => ({ ...rol, tenantId })), skipDuplicates: true });
  const roles = await tx.accessRole.findMany({ where: { tenantId } });
  return Object.fromEntries(roles.map(r => [r.code, r.id]));
}
