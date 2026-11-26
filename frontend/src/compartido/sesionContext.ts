import { createContext, useContext } from 'react';

export interface DatosSesion {
  usuarioId: number;
  tenantId: number;
  nombre: string;
  rol: string;
  nombreRol: string;
  laboratorio: string;
  sucursalId: number;
  sucursal: string;
  permisos: string[];
}
export const SesionContext = createContext<{
  sesion: DatosSesion | null;
  cargando: boolean;
  establecer: (sesion: DatosSesion | null) => void;
} | null>(null);

export function useSesion() {
  const contexto = useContext(SesionContext);
  if (!contexto) throw new Error('Falta SesionProvider');
  return contexto;
}

export function useSesionActiva() {
  const { sesion } = useSesion();
  if (!sesion) throw new Error('Se requiere una sesión activa');
  return sesion;
}
