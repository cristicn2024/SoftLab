import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { SESION } from './sesion';
import { SesionContext } from './sesionContext';
import type { DatosSesion } from './sesionContext';

export function SesionProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<DatosSesion>(SESION);

  const actualizarSesion = useCallback((cambios: Partial<DatosSesion>) => {
    setSesion(actual => ({ ...actual, ...cambios }));
  }, []);

  const valor = useMemo(() => ({ sesion, actualizarSesion }), [sesion, actualizarSesion]);

  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>;
}
