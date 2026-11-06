import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ES_PUBLICO } from '../decoradores/publico.decorator';
import type { Sesion } from '../dominio/sesion';
import { leerEncabezado, rolDesdeEncabezado } from '../encabezados';

type Encabezados = Record<string, string | string[] | undefined>;

@Injectable()
export class SesionPorEncabezadosGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const esPublico = this.reflector.getAllAndOverride<boolean>(ES_PUBLICO, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (esPublico) return true;

    const req = contexto.switchToHttp().getRequest<{ headers: Encabezados; user?: Sesion }>();
    const tenantId = Number(leerEncabezado(req.headers['x-tenant-id']));
    if (!Number.isInteger(tenantId) || tenantId <= 0) {
      throw new BadRequestException('Falta el encabezado x-tenant-id con el id del laboratorio.');
    }

    req.user = {
      tenantId,
      nombre: leerEncabezado(req.headers['x-user-name']) || 'Usuario sin nombre',
      rol: rolDesdeEncabezado(leerEncabezado(req.headers['x-user-role'])),
    };
    return true;
  }
}
