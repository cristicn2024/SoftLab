import { Body, Controller, Get, HttpCode, Param, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { UsuarioActual } from '../../auth/decoradores/usuario-actual.decorator';
import { Publico } from '../../auth/decoradores/publico.decorator';
import type { Sesion } from '../../auth/dominio/sesion';
import { IdPositivoPipe } from '../../comun/pipes/id-positivo.pipe';
import { ReportesService } from './dominio/reportes.service';
import type { Actor } from './dominio/reportes.types';
import { EntregarInformeDto } from './dto/entregar-informe.dto';

const ID_ORDEN_INVALIDO = 'Orden o laboratorio no válido';

function actorDe(sesion: Sesion): Actor {
  return { tenantId: sesion.tenantId, name: sesion.nombre, isAdmin: sesion.rol === 'admin' };
}

@ApiTags('reportes')
@Controller()
export class ReportesController {
  constructor(private readonly servicio: ReportesService) {}

  @Get('reports/orders/:orderId/pdf')
  obtener(
    @UsuarioActual() sesion: Sesion,
    @Param('orderId', new IdPositivoPipe(ID_ORDEN_INVALIDO)) orderId: number,
    @Query('channel') channel: unknown,
    @Res() res: Response,
  ) {
    return this.entregar(sesion, orderId, channel, undefined, res);
  }

  @HttpCode(200)
  @Post('reports/orders/:orderId/pdf')
  emitir(
    @UsuarioActual() sesion: Sesion,
    @Param('orderId', new IdPositivoPipe(ID_ORDEN_INVALIDO)) orderId: number,
    @Query('channel') channelDeUrl: unknown,
    @Body() dto: EntregarInformeDto,
    @Res() res: Response,
  ) {
    return this.entregar(sesion, orderId, dto.channel ?? channelDeUrl, dto.reason, res);
  }

  @Publico()
  @Get('verify-report/:token')
  async verificar(@Param('token') token: string, @Res({ passthrough: true }) res: Response) {
    const informe = await this.servicio.verify(String(token));
    if (!informe) {
      res.status(404);
      return { valid: false, message: 'Documento no auténtico' };
    }
    return { valid: true, laboratory: informe.laboratory, patient: informe.patient, issuedAt: informe.issuedAt };
  }

  private async entregar(
    sesion: Sesion,
    orderId: number,
    channel: unknown,
    reason: unknown,
    res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store, private');
    const resultado = await this.servicio.release(actorDe(sesion), orderId, channel, reason);
    if (resultado.kind === 'blocked') {
      res.status(409).json({
        status: 409,
        code: 'PAYMENT_REQUIRED',
        error: resultado.message,
        balance: resultado.balance,
        paymentUrl: resultado.paymentUrl,
      });
      return;
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=Informe_Orden_${orderId}.pdf`);
    res.send(resultado.buffer);
  }
}
