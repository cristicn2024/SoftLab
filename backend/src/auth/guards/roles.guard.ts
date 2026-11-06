import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_REQUERIDOS } from '../decoradores/roles.decorator';
import type { Rol, Sesion } from '../dominio/sesion';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const requeridos = this.reflector.getAllAndOverride<Rol[]>(ROLES_REQUERIDOS, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (!requeridos || requeridos.length === 0) return true;

    const sesion = contexto.switchToHttp().getRequest<{ user?: Sesion }>().user;
    if (!sesion || !sesion.rol || !requeridos.includes(sesion.rol)) {
      throw new ForbiddenException(`Esta operación requiere el rol: ${requeridos.join(' o ')}`);
    }
    return true;
  }
}
