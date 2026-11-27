import { ForbiddenException, HttpException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHmac, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ERROR_LOGIN, ERROR_SESION, enteroEntorno, secretoSesion } from './config';
import { hashClave, verificarClave } from './claves';
import type { SesionActiva } from './dominio/sesion';
import { IntentosService } from './intentos.service';

const sucursal = { select: { id: true, name: true, tenantId: true } } as const;
const relaciones = {
  tenant: { select: { name: true, status: true } },
  branch: sucursal, extraBranches: { select: { branch: sucursal } }, accessRole: true,
} satisfies Prisma.UserInclude;
type Cuenta = Prisma.UserGetPayload<{ include: typeof relaciones }>;
type Evento = 'LOGIN_EXITOSO' | 'LOGIN_FALLIDO' | 'LOGOUT';

function sucursales(cuenta: Cuenta) {
  const todas = [cuenta.branch, ...cuenta.extraBranches.map(a => a.branch)];
  const unicas = new Map<number, { id: number; name: string }>();
  for (const s of todas) {
    if (s?.tenantId === cuenta.tenantId) unicas.set(s.id, { id: s.id, name: s.name });
  }
  return [...unicas.values()];
}

function habilitada(cuenta: Cuenta) {
  return cuenta.active && cuenta.tenant.status === 'active' && cuenta.accessRole?.tenantId === cuenta.tenantId;
}

function contexto(cuenta: Cuenta, branchId: number): SesionActiva {
  const activa = sucursales(cuenta).find(s => s.id === branchId);
  const rol = cuenta.accessRole;
  if (!habilitada(cuenta) || !activa || !rol) throw new UnauthorizedException(ERROR_SESION);
  const permisos = Array.isArray(rol.permissions) ? rol.permissions.filter((p): p is string => typeof p === 'string') : [];
  return { tenantId: cuenta.tenantId, usuarioId: cuenta.id, correo: cuenta.email, nombre: cuenta.fullName,
    laboratorio: cuenta.tenant.name, sucursalId: activa.id, sucursal: activa.name,
    rol: rol.code, nombreRol: rol.name, permisos };
}

function registrarAuditoria(tx: Prisma.TransactionClient, action: Evento, login: string, ip: string,
  cuenta?: { id: number; tenantId: number } | null, branchId?: number | null) {
  return tx.authEvent.create({ data: { action, login, ip, userId: cuenta?.id, tenantId: cuenta?.tenantId, branchId } });
}

@Injectable()
export class AuthService {
  private readonly secreto = secretoSesion();
  private readonly duracion = enteroEntorno('SESION_MINUTOS', 480, 10080) * 60000;

  constructor(private readonly prisma: PrismaService, private readonly intentos: IntentosService) {}

  private digest(token: string) {
    return createHmac('sha256', this.secreto).update(token).digest('hex');
  }

  private async emitir(tx: Prisma.TransactionClient, cuenta: Cuenta, branchId: number | null, ip: string) {
    const token = randomBytes(32).toString('base64url');
    const maxAge = branchId === null ? Math.min(this.duracion, 300000) : this.duracion;
    await tx.authSession.create({ data: { digest: this.digest(token), userId: cuenta.id, branchId, expiresAt: new Date(Date.now() + maxAge) } });
    if (branchId === null) return { token, maxAge, respuesta: { sucursales: sucursales(cuenta) } };
    const sesion = contexto(cuenta, branchId);
    await registrarAuditoria(tx, 'LOGIN_EXITOSO', cuenta.email, ip, cuenta, branchId);
    return { token, maxAge, respuesta: { sesion } };
  }

  async login(correo: string, clave: string, ip: string) {
    const claves = await this.intentos.reservar(correo, ip);
    if (!claves) {
      await registrarAuditoria(this.prisma, 'LOGIN_FALLIDO', correo, ip);
      throw new HttpException('Demasiados intentos. Intenta más tarde.', 429);
    }
    const cuenta = await this.prisma.user.findUnique({ where: { email: correo }, include: relaciones });
    const correcta = await verificarClave(clave, cuenta?.passwordHash);
    if (!correcta || !cuenta || !habilitada(cuenta)) {
      await registrarAuditoria(this.prisma, 'LOGIN_FALLIDO', correo, ip, cuenta);
      throw new UnauthorizedException(ERROR_LOGIN);
    }
    await this.intentos.liberar(claves);
    const asignadas = sucursales(cuenta);
    if (!asignadas.length) {
      await registrarAuditoria(this.prisma, 'LOGIN_FALLIDO', correo, ip, cuenta);
      throw new ForbiddenException('Tu cuenta no tiene sucursales asignadas. Contacta al administrador.');
    }
    if (cuenta.passwordHash.startsWith('scrypt$')) {
      await this.prisma.user.updateMany({ where: { id: cuenta.id, passwordHash: cuenta.passwordHash },
        data: { passwordHash: await hashClave(clave) } });
    }
    return this.prisma.$transaction(tx => this.emitir(tx, cuenta, asignadas.length === 1 ? asignadas[0].id : null, ip));
  }

  private async buscar(token?: string) {
    if (!token) throw new UnauthorizedException(ERROR_SESION);
    const registro = await this.prisma.authSession.findUnique({ where: { digest: this.digest(token) }, include: { user: { include: relaciones } } });
    if (!registro || registro.expiresAt.getTime() <= Date.now() || !habilitada(registro.user)) throw new UnauthorizedException(ERROR_SESION);
    return registro;
  }

  async autenticar(token?: string) {
    const registro = await this.buscar(token);
    if (registro.branchId === null) throw new UnauthorizedException(ERROR_SESION);
    return contexto(registro.user, registro.branchId);
  }

  async seleccionar(token: string | undefined, branchId: number, ip: string) {
    const registro = await this.buscar(token);
    if (registro.branchId !== null) throw new UnauthorizedException(ERROR_SESION);
    if (!sucursales(registro.user).some(s => s.id === branchId)) {
      await registrarAuditoria(this.prisma, 'LOGIN_FALLIDO', registro.user.email, ip, registro.user);
      throw new ForbiddenException('Sucursal no asignada.');
    }
    return this.prisma.$transaction(async tx => {
      const usado = await tx.authSession.deleteMany({ where: { digest: registro.digest, branchId: null, expiresAt: { gt: new Date() } } });
      if (!usado.count) throw new UnauthorizedException(ERROR_SESION);
      return this.emitir(tx, registro.user, branchId, ip);
    });
  }

  async salir(token: string | undefined, ip: string) {
    if (!token) return;
    const digest = this.digest(token);
    await this.prisma.$transaction(async tx => {
      const sesion = await tx.authSession.findUnique({ where: { digest }, include: { user: true } });
      if (sesion && (await tx.authSession.deleteMany({ where: { digest } })).count) {
        await registrarAuditoria(tx, 'LOGOUT', sesion.user.email, ip, sesion.user, sesion.branchId);
      }
    });
  }
}
