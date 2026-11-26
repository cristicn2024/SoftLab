import { BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, ParseIntPipe, Put } from '@nestjs/common';
import { Roles } from '../../auth/decoradores/roles.decorator';
import { UsuarioActual } from '../../auth/decoradores/usuario-actual.decorator';
import type { Sesion } from '../../auth/dominio/sesion';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('admin/access')
@Roles('admin')
export class BranchAccessController {
  constructor(private readonly prisma: PrismaService) {}

  private async adminDb(tenantId: number, email?: string) {
    if (!email) throw new ForbiddenException('No se pudo identificar la cuenta administradora.');
    const user = await this.prisma.user.findFirst({ where: { tenantId, email }, select: { id: true, role: true } });
    if (!user || user.role !== 'admin') throw new ForbiddenException('La cuenta no es administradora de este laboratorio.');
  }

  @Get('branches')
  async listar(@UsuarioActual() session: Sesion) {
    await this.adminDb(session.tenantId, session.email);
    const [branches, users] = await Promise.all([
      this.prisma.branch.findMany({ where: { tenantId: session.tenantId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      this.prisma.user.findMany({ where: { tenantId: session.tenantId, role: { not: 'admin' } }, select: { id: true, fullName: true, email: true, role: true, branchId: true, branchAccess: { select: { branchId: true } } }, orderBy: { fullName: 'asc' } }),
    ]);
    return {
      branches,
      users: users.map(({ branchAccess, branchId, ...user }) => ({
        ...user,
        branchIds: branchAccess.length ? branchAccess.map(access => access.branchId) : branchId === null ? [] : [branchId],
      })),
    };
  }

  @Put('users/:userId/branches')
  async asignar(@UsuarioActual() session: Sesion, @Param('userId', ParseIntPipe) userId: number, @Body() body: { branchIds?: unknown }) {
    await this.adminDb(session.tenantId, session.email);
    if (!Array.isArray(body.branchIds) || body.branchIds.length === 0 || body.branchIds.some(id => !Number.isSafeInteger(id) || Number(id) <= 0)) {
      throw new BadRequestException('Selecciona al menos una sucursal válida.');
    }
    const branchIds = [...new Set(body.branchIds as number[])];
    if (branchIds.length !== body.branchIds.length) throw new BadRequestException('No repitas sucursales.');
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId: session.tenantId, role: { not: 'admin' } }, select: { id: true } });
    if (!user) throw new NotFoundException('No se encontró al empleado en este laboratorio.');
    const count = await this.prisma.branch.count({ where: { tenantId: session.tenantId, id: { in: branchIds } } });
    if (count !== branchIds.length) throw new BadRequestException('Todas las sucursales deben pertenecer a este laboratorio.');

    await this.prisma.$transaction(async tx => {
      await tx.userBranchAccess.deleteMany({ where: { userId } });
      await tx.userBranchAccess.createMany({ data: branchIds.map(branchId => ({ userId, branchId })) });
      // Keep the legacy primary branch field aligned for existing screens and reports.
      await tx.user.update({ where: { id: userId }, data: { branchId: branchIds[0] } });
    });
    return { userId, branchIds };
  }
}
