import type { Rol } from './dominio/sesion';

const ROLES_VALIDOS: Rol[] = ['admin', 'receptionist', 'chemist', 'doctor'];
const ALIAS_DE_ADMIN = ['administrador', 'administradora'];

export function leerEncabezado(valor: string | string[] | undefined): string {
  const texto = Array.isArray(valor) ? valor[0] : valor;
  if (!texto) return '';
  try {
    return decodeURIComponent(texto);
  } catch {
    return texto;
  }
}

export function rolDesdeEncabezado(valor: string): Rol | undefined {
  const limpio = valor.trim().toLowerCase();
  if (ALIAS_DE_ADMIN.includes(limpio)) return 'admin';
  for (const rol of ROLES_VALIDOS) {
    if (rol === limpio) return rol;
  }
  return undefined;
}
