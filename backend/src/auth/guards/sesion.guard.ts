import { PrismaService } from '../../prisma/prisma.service';
import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService } from '../auth.service';
import { tokenCookie } from '../config';
import { ES_PUBLICO } from '../decoradores/publico.decorator';
import { PERMISO, RECURSO, type RecursoSucursal } from '../decoradores/permiso.decorator';
import type { SesionActiva } from '../dominio/sesion';

@Injectable()
export class SesionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly auth: AuthService, private readonly prisma: PrismaService) {}
  async canActivate(ctx: ExecutionContext) {
    const destino = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(ES_PUBLICO, destino)) return true;
    const req = ctx.switchToHttp().getRequest<Request & { user: SesionActiva }>();
    const sesion = await this.auth.autenticar(tokenCookie(req));
    const permiso = this.reflector.getAllAndOverride<string>(PERMISO, destino);
    if (permiso && !sesion.permisos.includes(permiso)) throw new ForbiddenException('No tienes permiso para acceder a este módulo.');
    const recurso = this.reflector.getAllAndOverride<RecursoSucursal>(RECURSO, destino);
    if (recurso) {
      const id = Number(req.params[recurso.parametro]);
      if (Number.isSafeInteger(id) && id > 0) {
        const where = { id, tenantId: sesion.tenantId, branchId: sesion.sucursalId };
        const select = { id: true };
        let fila;
        switch (recurso.tipo) {
          case 'order': fila = await this.prisma.order.findFirst({ where, select }); break;
          case 'payment': fila = await this.prisma.payment.findFirst({ where, select }); break;
          case 'cashCut': fila = await this.prisma.cashCut.findFirst({ where, select }); break;
        }
        if (!fila) throw new NotFoundException('Registro no encontrado en esta sucursal.');
      }
    }
    req.user = sesion;
    return true;
  }
}
