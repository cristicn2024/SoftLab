export type Rol = 'admin' | 'receptionist' | 'chemist' | 'doctor';

export interface Sesion {
  tenantId: number;
  nombre: string;
  usuarioId?: number;
  rol?: Rol;
}
