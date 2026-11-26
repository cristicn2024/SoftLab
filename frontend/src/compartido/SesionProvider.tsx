import { useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import { SesionContext, type DatosSesion } from './sesionContext';

export function SesionProvider({ children }: { children: ReactNode }) {
  const [sesion, establecer] = useState<DatosSesion | null>(null);
  const [cargando, cargar] = useState(true);
  useEffect(() => {
    let activo = true;
    const expirar = () => establecer(null);
    window.addEventListener('softlab:sesion-expirada', expirar);
    api.get<DatosSesion>('/auth/sesion').then(({ data }) => {
      if (activo) establecer(data);
    }).catch(() => {}).finally(() => { if (activo) cargar(false); });
    return () => { activo = false; window.removeEventListener('softlab:sesion-expirada', expirar); };
  }, []);
  return <SesionContext.Provider value={{ sesion, establecer, cargando }}>{children}</SesionContext.Provider>;
}
