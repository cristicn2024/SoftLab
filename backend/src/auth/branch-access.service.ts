import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Sesion } from './dominio/sesion';

@Injectable()
export class BranchAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** null means unrestricted for a database-verified administrator. */
  async allowedBranchIds(sesion: Sesion): Promise<number[] | null> {
    if (!sesion.email) throw new ForbiddenException('No se identificó una cuenta para validar sus sucursales.');

    const usuario = await this.prisma.user.findFirst({
      where: { tenantId: sesion.tenantId, email: sesion.email },
      select: { id: true, role: true, branchId: true },
    });
    if (!usuario) throw new ForbiddenException('La cuenta no pertenece a este laboratorio.');
    if (usuario.role === 'admin') return null;

    const asignaciones = await this.prisma.userBranchAccess.findMany({
      where: { userId: usuario.id, branch: { tenantId: sesion.tenantId } },
      select: { branchId: true },
    });
    if (asignaciones.length > 0) return asignaciones.map(({ branchId }) => branchId);

    // Keeps existing accounts usable until their access list has been configured.
    return usuario.branchId === null ? [] : [usuario.branchId];
  }

  async puedeOperar(sesion: Sesion, branchId: number): Promise<boolean> {
    const permitidas = await this.allowedBranchIds(sesion);
    return permitidas === null || permitidas.includes(branchId);
  }

  async exigirAcceso(sesion: Sesion, branchId: number): Promise<void> {
    if (!(await this.puedeOperar(sesion, branchId))) {
      throw new ForbiddenException('Tu cuenta no tiene acceso a esta sucursal.');
    }
  }

  async exigirAccesoOrden(sesion: Sesion, orderId: number): Promise<void> {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, tenantId: sesion.tenantId }, select: { branchId: true } });
    if (!order) throw new NotFoundException('Orden no encontrada.');
    await this.exigirAcceso(sesion, order.branchId);
  }

  async exigirAccesoPago(sesion: Sesion, paymentId: number): Promise<void> {
    const payment = await this.prisma.payment.findFirst({ where: { id: paymentId, tenantId: sesion.tenantId }, select: { branchId: true } });
    if (!payment) throw new NotFoundException('Pago no encontrado.');
    await this.exigirAcceso(sesion, payment.branchId);
  }
}
