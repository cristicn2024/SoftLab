import { randomBytes } from 'node:crypto';
import type { CookieOptions, Request } from 'express';

export const COOKIE = 'softlab_sesion';
export const ERROR_LOGIN = 'Usuario o contraseña incorrectos';
export const ERROR_SESION = 'La sesión no es válida o ha expirado';

export function enteroEntorno(nombre: string, defecto: number, maximo: number) {
  const valor = Number(process.env[nombre] ?? defecto);
  if (!Number.isSafeInteger(valor) || valor < 1 || valor > maximo) throw new Error('Valor inválido en ' + nombre);
  return valor;
}

export function secretoSesion() {
  const secreto = process.env.SESION_SECRETO;
  if (!secreto && process.env.NODE_ENV !== 'production') return randomBytes(32);
  if (!secreto || Buffer.byteLength(secreto) < 32) throw new Error('SESION_SECRETO requiere al menos 32 bytes');
  return secreto;
}

export function opcionesCookie(): CookieOptions {
  return { path: '/api', httpOnly: true, sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production' || process.env.SESION_COOKIE_SECURE === 'true' };
}

export function tokenCookie(req: Request) {
  return /(?:^|;\s*)softlab_sesion=([\w-]{43})(?:;|$)/.exec(req.headers.cookie ?? '')?.[1];
}
