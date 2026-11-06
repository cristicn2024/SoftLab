import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { UsuarioActual } from '../../auth/decoradores/usuario-actual.decorator';
import type { Sesion } from '../../auth/dominio/sesion';
import { IdPositivoPipe } from '../../comun/pipes/id-positivo.pipe';
import { GuardarResultadosDto } from './dto/guardar-resultados.dto';
import { WorklistService } from './dominio/worklist.service';

const ID_ORDEN_INVALIDO = 'El id de la orden no es válido.';

@Controller('worklist')
export class WorklistController {
  constructor(private readonly servicio: WorklistService) {}

  @Get()
  listar(@UsuarioActual() sesion: Sesion) {
    return this.servicio.getWorklist(sesion.tenantId);
  }

  @Get('orders/:orderId')
  buscar(
    @UsuarioActual() sesion: Sesion,
    @Param('orderId', new IdPositivoPipe(ID_ORDEN_INVALIDO)) orderId: number,
  ) {
    return this.servicio.getOrder(sesion.tenantId, orderId);
  }

  @Post('orders/:orderId/results')
  @HttpCode(201)
  async guardar(
    @UsuarioActual() sesion: Sesion,
    @Param('orderId', new IdPositivoPipe(ID_ORDEN_INVALIDO)) orderId: number,
    @Body() dto: GuardarResultadosDto,
  ) {
    const saved = await this.servicio.saveOrderResults(sesion.tenantId, orderId, dto.results);
    return { saved };
  }
}
