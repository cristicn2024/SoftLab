import { BadRequestException, Body, Controller, Get, Header, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { isEmail } from 'class-validator';
import { AuthService } from './auth.service';
import { COOKIE, opcionesCookie, tokenCookie } from './config';
import { Publico } from './decoradores/publico.decorator';
import { UsuarioActual } from './decoradores/usuario-actual.decorator';
import type { SesionActiva } from './dominio/sesion';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Publico()
  @Post('login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async login(@Body() body: Record<string, unknown>, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const correo = typeof body?.usuario === 'string' ? body.usuario.trim().toLowerCase() : '';
    if (correo.length > 150 || !isEmail(correo) || typeof body?.clave !== 'string' ||
        !body.clave.length || body.clave.length > 256 || Object.keys(body).length !== 2) {
      throw new BadRequestException('Ingresa un correo y una contraseña válidos.');
    }
    return this.responder(await this.auth.login(correo, body.clave, req.ip ?? ''), res);
  }

  @Publico()
  @Post('sucursal')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async seleccionar(@Body() body: Record<string, unknown>, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const id = body?.sucursalId;
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0 || Object.keys(body).length !== 1) {
      throw new BadRequestException('Selecciona una sucursal válida.');
    }
    return this.responder(await this.auth.seleccionar(tokenCookie(req), id, req.ip ?? ''), res);
  }

  @Get('sesion')
  @Header('Cache-Control', 'no-store')
  sesion(@UsuarioActual() sesion: SesionActiva) { return sesion; }

  @Publico()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.salir(tokenCookie(req), req.ip ?? '');
    res.clearCookie(COOKIE, opcionesCookie());
  }

  private responder(resultado: Awaited<ReturnType<AuthService['login']>>, res: Response) {
    res.cookie(COOKIE, resultado.token, { ...opcionesCookie(), maxAge: resultado.maxAge });
    return resultado.respuesta;
  }
}
