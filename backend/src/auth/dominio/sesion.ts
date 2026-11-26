export type Rol = string;

export interface Sesion {
  tenantId: number;
  nombre: string;
  usuarioId?: number;
  rol?: Rol;
  sucursalId?: number;
}

export interface SesionActiva extends Sesion {
  usuarioId: number;
  sucursalId: number;
  sucursal: string;
  laboratorio: string;
  correo: string;
  rol: string;
  nombreRol: string;
  permisos: string[];
}
