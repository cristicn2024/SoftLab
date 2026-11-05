import { createContext, useContext } from 'react';
import { SESION } from './sesion';

export type DatosSesion = typeof SESION;

export type ContextoSesion = {
  sesion: DatosSesion;
  actualizarSesion: (cambios: Partial<DatosSesion>) => void;
};

export const SesionContext = createContext<ContextoSesion | null>(null);

export function useSesion() {
  const contexto = useContext(SesionContext);
  if (!contexto) {
    throw new Error('useSesion debe usarse dentro de un SesionProvider');
  }
  return contexto;
}
