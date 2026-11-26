import 'reflect-metadata';
import { ExecutionContext, HttpException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { request } from 'node:http';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../../app.module';
import { configurarApp } from '../../configurar-app';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { AuthController } from '../../auth/auth.controller';
import { AuthService } from '../../auth/auth.service';
import { IntentosService } from '../../auth/intentos.service';
import { SesionGuard } from '../../auth/guards/sesion.guard';
import { ERROR_LOGIN, opcionesCookie } from '../../auth/config';
import { hashClave } from '../../auth/claves';
import { PrismaService } from '../../prisma/prisma.service';

const correo = 'usuario@example.com';
const ip = '127.0.0.1';
const clave = 'Clave de pruebas 123';
const central = { id: 4, tenantId: 1, name: 'Central' };
const norte = { id: 8, tenantId: 1, name: 'Norte' };

function escenario(passwordHash: string) {
  const cuenta = { id: 10, tenantId: 1, email: correo, fullName: 'Usuario QA', active: true, passwordHash,
    tenant: { name: 'Lab QA', status: 'active' }, branch: central as typeof central | null,
    extraBranches: [] as { branch: typeof central }[],
    accessRole: { tenantId: 1, code: 'coordinacion', name: 'Coordinación', permissions: ['resultados'] } };
  type Fila = { digest: string; userId: number; branchId: number | null; expiresAt: Date };
  const sesiones = new Map<string, Fila>();
  const eventos: Record<string, unknown>[] = [];
  const cuentas = new Map<string, number>();
  const db = {
    user: { findUnique: async ({ where }) => where.email === correo ? cuenta : null },
    authEvent: { create: async ({ data }) => { eventos.push({ ...data, createdAt: new Date() }); } },
    authSession: {
      create: async ({ data }: { data: Fila }) => sesiones.set(data.digest, data),
      findUnique: async ({ where }) => sesiones.has(where.digest) ? { ...sesiones.get(where.digest), user: cuenta } : null,
      deleteMany: async ({ where }) => ({ count: Number(sesiones.delete(where.digest)) }),
    },
    $executeRaw: async (_sql, key: string) => { if (!cuentas.has(key)) cuentas.set(key, 0); },
    loginAttempt: {
      deleteMany: jest.fn(),
      findMany: async ({ where }) => where.key.in.map((key: string) => ({ count: cuentas.get(key) })),
      updateMany: async ({ where, data }) => {
        for (const key of where.key.in) cuentas.set(key, cuentas.get(key)! + (data.count.increment ?? -data.count.decrement));
      },
    },
    $transaction: async (fn) => fn(db),
  };
  const prisma = db as unknown as PrismaService;
  const auth = new AuthService(prisma, new IntentosService(prisma));
  const controller = new AuthController(auth);
  const guard = new SesionGuard(new Reflector(), auth, prisma);
  const req = (token?: string) => ({ headers: { cookie: token ? 'softlab_sesion=' + token : '' }, ip, params: {} }) as Request;
  const cookie = jest.fn();
  const res = { cookie, clearCookie: jest.fn() } as unknown as Response;
  async function login(usuario = correo, password = clave, desde = ip) {
    return controller.login({ usuario, clave: password }, { ...req(), ip: desde } as Request, res);
  }
  function privado(token?: string, permiso?: string) {
    const handler = () => {};
    if (permiso) Reflect.defineMetadata('auth:permiso', permiso, handler);
    const solicitud = req(token);
    Object.assign(solicitud.headers, { 'x-tenant-id': '1', 'x-user-role': 'admin' });
    return guard.canActivate({ getHandler: () => handler, getClass: () => AuthController,
      switchToHttp: () => ({ getRequest: () => solicitud }) } as ExecutionContext);
  }
  return { prisma, auth, controller, cuenta, req, res, login, privado, eventos, sesiones, cookie, token: () => cookie.mock.lastCall![1] as string };
}

describe('HU 7.5 – inicio de sesión', () => {
  let hash: string;
  let e: ReturnType<typeof escenario>;
  beforeAll(async () => { hash = await hashClave(clave); });
  beforeEach(() => { e = escenario(hash); });

  it('selecciona la única sucursal y entrega el rol y permisos vigentes con cookie HttpOnly', async () => {
    expect(await e.login()).toMatchObject({ sesion: { usuarioId: 10, rol: 'coordinacion', permisos: ['resultados'], sucursalId: 4 } });
    expect(e.cookie).toHaveBeenCalledWith('softlab_sesion', expect.any(String), expect.objectContaining({ httpOnly: true, sameSite: 'strict' }));
    expect(e.sesiones.has(e.token())).toBe(false);
    await expect(e.privado(e.token(), 'resultados')).resolves.toBe(true);
  });

  it.each(['incorrecta', 'inexistente', 'inactiva'])('rechaza la cuenta %s con el mismo 401', async caso => {
    e.cuenta.active = caso !== 'inactiva';
    const respuesta = e.login(caso === 'inexistente' ? 'nadie@example.com' : correo, caso === 'incorrecta' ? 'otra' : clave);
    await expect(respuesta).rejects.toMatchObject({ status: 401, message: ERROR_LOGIN });
    expect(e.cookie).not.toHaveBeenCalled();
  });

  it('explica la falta de sucursal solo con credenciales correctas', async () => {
    e.cuenta.branch = null;
    await expect(e.login()).rejects.toMatchObject({ status: 403, message: expect.stringContaining('no tiene sucursales') });
    expect(e.sesiones.size).toBe(0);
  });

  it('exige elegir una sucursal propia y consume el desafío una sola vez', async () => {
    e.cuenta.extraBranches = [{ branch: norte }, { branch: { ...central, id: 9, tenantId: 2 } }];
    expect(await e.login()).toEqual({ sucursales: [{ id: 4, name: 'Central' }, { id: 8, name: 'Norte' }] });
    const pendiente = e.token();
    await expect(e.privado(pendiente)).rejects.toMatchObject({ status: 401 });
    await expect(e.controller.seleccionar({ sucursalId: 9 }, e.req(pendiente), e.res)).rejects.toMatchObject({ status: 403 });
    expect(await e.controller.seleccionar({ sucursalId: 8 }, e.req(pendiente), e.res)).toMatchObject({ sesion: { sucursalId: 8 } });
    expect(e.token()).not.toBe(pendiente);
    await expect(e.controller.seleccionar({ sucursalId: 8 }, e.req(pendiente), e.res)).rejects.toMatchObject({ status: 401 });
  });

  it('bloquea por cuenta y por IP tras cinco fallos', async () => {
    for (let i = 0; i < 5; i++) await expect(e.login(correo, 'incorrecta')).rejects.toMatchObject({ status: 401 });
    await expect(e.login('otra@example.com')).rejects.toMatchObject({ status: 429 });
    await expect(e.login(correo, clave, '127.0.0.2')).rejects.toMatchObject({ status: 429 });
    const ventana = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 16 * 60000);
    try { await expect(e.login()).resolves.toHaveProperty('sesion'); } finally { ventana.mockRestore(); }
  });

  it('el guard rechaza encabezados de identidad, cookies desconocidas y sesiones vencidas', async () => {
    await expect(e.privado()).rejects.toBeInstanceOf(HttpException);
    await expect(e.privado('x'.repeat(43))).rejects.toMatchObject({ status: 401 });
    await e.login();
    for (const fila of e.sesiones.values()) fila.expiresAt = new Date(0);
    await expect(e.privado(e.token())).rejects.toMatchObject({ status: 401 });
  });

  it('revalida rol, sucursal y estatus en cada petición', async () => {
    await e.login();
    e.cuenta.accessRole.permissions = [];
    await expect(e.privado(e.token(), 'resultados')).rejects.toMatchObject({ status: 403 });
    e.cuenta.active = false;
    await expect(e.privado(e.token())).rejects.toMatchObject({ status: 401 });
    e.cuenta.active = true;
    e.cuenta.branch = null;
    await expect(e.privado(e.token())).rejects.toMatchObject({ status: 401 });
  });

  it('invalida la cookie anterior al cerrar sesión y registra la salida', async () => {
    await e.login();
    const token = e.token();
    await e.controller.logout(e.req(token), e.res);
    expect(e.res.clearCookie).toHaveBeenCalledWith('softlab_sesion', opcionesCookie());
    await expect(e.privado(token)).rejects.toMatchObject({ status: 401 });
    expect(e.eventos.at(-1)).toMatchObject({ action: 'LOGOUT', userId: 10, branchId: 4, ip });
  });

  it('registra login exitoso y fallido sin guardar la contraseña', async () => {
    await expect(e.login(correo, 'otra')).rejects.toThrow(ERROR_LOGIN);
    await e.login();
    expect(e.eventos).toMatchObject([
      { action: 'LOGIN_FALLIDO', userId: 10, login: correo, ip, createdAt: expect.any(Date) },
      { action: 'LOGIN_EXITOSO', userId: 10, branchId: 4, login: correo, ip, createdAt: expect.any(Date) },
    ]);
    expect(JSON.stringify(e.eventos)).not.toContain(clave);
  });

  it('protege la API de Nest por HTTP y solo acepta la cookie emitida hasta el logout', async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(e.prisma).compile();
    const app = modulo.createNestApplication();
    configurarApp(app as never);
    const nombre = 'softlab-' + randomUUID();
    const socketPath = process.platform === 'win32' ? '\\\\.\\pipe\\' + nombre : join(tmpdir(), nombre + '.sock');
    // Transporte HTTP local y privado. No requiere puertos ni un servidor externo.
    const llamar = (path: string, metodo = 'GET', cookie = '', body?: object) =>
      new Promise<{ status: number; cookies: string[]; body: string }>((resolve, reject) => {
        const req = request({ socketPath, path, method: metodo, headers: {
          'Content-Type': 'application/json', Cookie: cookie, 'x-user-role': 'admin', 'x-tenant-id': '1',
        } }, res => {
          const partes: Buffer[] = [];
          res.on('data', parte => partes.push(parte));
          res.on('end', () => resolve({ status: res.statusCode!, cookies: res.headers['set-cookie'] ?? [],
            body: Buffer.concat(partes).toString() }));
        });
        req.on('error', reject);
        req.end(body && JSON.stringify(body));
      });
    try {
      await app.listen(socketPath);
      expect((await llamar('/api/auth/sesion')).status).toBe(401);
      expect((await llamar('/api/catalogo')).status).toBe(401);
      expect((await llamar('/api/auth/login', 'POST', '', { usuario: correo, clave: '' })).status).toBe(400);
      const inicio = await llamar('/api/auth/login', 'POST', '', { usuario: correo, clave });
      expect(inicio.status).toBe(200);
      expect(inicio.cookies[0]).toMatch(/HttpOnly/);
      const cookie = inicio.cookies[0].split(';')[0];
      expect(JSON.parse((await llamar('/api/auth/sesion', 'GET', cookie)).body)).toMatchObject({ usuarioId: 10, sucursalId: 4 });
      expect((await llamar('/api/catalogo', 'GET', cookie)).status).toBe(403);
      expect((await llamar('/api/auth/logout', 'POST', cookie)).status).toBe(204);
      expect((await llamar('/api/auth/sesion', 'GET', cookie)).status).toBe(401);
    } finally { await app.close(); }
  }, 30000);
});
