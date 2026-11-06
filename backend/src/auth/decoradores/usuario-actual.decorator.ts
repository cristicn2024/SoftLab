import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Sesion } from '../dominio/sesion';

export const UsuarioActual = createParamDecorator((_dato: unknown, contexto: ExecutionContext): Sesion => {
  const req = contexto.switchToHttp().getRequest<{ user: Sesion }>();
  return req.user;
});
