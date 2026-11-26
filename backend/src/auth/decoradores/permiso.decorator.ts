import { SetMetadata } from '@nestjs/common';
export const PERMISO = 'auth:permiso';
export const Permiso = (codigo: string) => SetMetadata(PERMISO, codigo);

export type RecursoSucursal = { tipo: 'order' | 'payment' | 'cashCut'; parametro: string };
export const RECURSO = 'auth:recurso-sucursal';
export const EnSucursal = (tipo: RecursoSucursal['tipo'], parametro: string) => SetMetadata(RECURSO, { tipo, parametro });
