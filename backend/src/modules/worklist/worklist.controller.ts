import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { UsuarioActual } from '../../auth/decoradores/usuario-actual.decorator';
import type { Sesion } from '../../auth/dominio/sesion';
import { IdPositivoPipe } from '../../comun/pipes/id-positivo.pipe';
import { GuardarResultadosDto } from './dto/guardar-resultados.dto';
import { WorklistService } from './dominio/worklist.service';
import { BranchAccessService } from '../../auth/branch-access.service';

const ID_ORDEN_INVALIDO = 'El id de la orden no es válido.';

@Controller('worklist')
export class WorklistController {
  constructor(private readonly servicio: WorklistService, private readonly branchAccess: BranchAccessService) {}

  @Get()
  async listar(@UsuarioActual() sesion: Sesion) {
    return this.servicio.getWorklist(sesion.tenantId, new Date(), await this.branchAccess.allowedBranchIds(sesion));
  }

  @Get('orders/:orderId')
  async buscar(
    @UsuarioActual() sesion: Sesion,
    @Param('orderId', new IdPositivoPipe(ID_ORDEN_INVALIDO)) orderId: number,
  ) {
    return this.servicio.getOrder(sesion.tenantId, orderId, new Date(), await this.branchAccess.allowedBranchIds(sesion));
  }

  @Post('orders/:orderId/results')
  @HttpCode(201)
  async guardar(
    @UsuarioActual() sesion: Sesion,
    @Param('orderId', new IdPositivoPipe(ID_ORDEN_INVALIDO)) orderId: number,
    @Body() dto: GuardarResultadosDto,
  ) {
    const saved = await this.servicio.saveOrderResults(
      sesion.tenantId,
      orderId,
      dto.results,
      new Date(),
      sesion.usuarioId ?? null,
      await this.branchAccess.allowedBranchIds(sesion),
    );
    return { saved };
  }
}
