import { SetMetadata } from '@nestjs/common';
import type { Rol } from '../dominio/sesion';

export const ROLES_REQUERIDOS = 'rolesRequeridos';

export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_REQUERIDOS, roles);
