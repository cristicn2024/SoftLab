import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { SesionContext, type DatosSesion } from '../compartido/sesionContext';

export const usuarioQA: DatosSesion = {
  tenantId: 1, usuarioId: 2, nombre: 'Laura Méndez', rol: 'admin', nombreRol: 'Administradora',
  laboratorio: 'Laboratorio QA', sucursal: 'Clínica Central', sucursalId: 10,
  permisos: ['ordenes', 'catalogo', 'catalogo.editar', 'resultados', 'referencias', 'cobro', 'entrega'],
};

export function renderConUsuario(ui: ReactElement) {
  return render(<SesionContext.Provider value={{ sesion: usuarioQA, cargando: false, establecer: () => {} }}>
    {ui}
  </SesionContext.Provider>);
}
