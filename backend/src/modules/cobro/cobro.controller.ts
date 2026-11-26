import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UsuarioActual } from '../../auth/decoradores/usuario-actual.decorator';
import type { Sesion } from '../../auth/dominio/sesion';
import { IdPositivoPipe } from '../../comun/pipes/id-positivo.pipe';
import { CobroService } from './dominio/cobro.service';
import type { Actor } from './dominio/cobro.types';
import { CancelarPagoDto } from './dto/cancelar-pago.dto';
import { RegistrarPagosDto } from './dto/registrar-pagos.dto';
import { BranchAccessService } from '../../auth/branch-access.service';

const ID_ORDEN_INVALIDO = 'El id de la orden no es válido.';
const ID_PAGO_INVALIDO = 'El id del pago no es válido.';

function actorDe(sesion: Sesion): Actor {
  return { tenantId: sesion.tenantId, name: sesion.nombre, isAdmin: sesion.rol === 'admin' };
}

@ApiTags('cobro')
@Controller()
export class CobroController {
  constructor(private readonly servicio: CobroService, private readonly branchAccess: BranchAccessService) {}

  @Get('orders/:id/billing')
  async obtener(@UsuarioActual() sesion: Sesion, @Param('id', new IdPositivoPipe(ID_ORDEN_INVALIDO)) id: number) {
    await this.branchAccess.exigirAccesoOrden(sesion, id);
    return this.servicio.getBilling(sesion.tenantId, id);
  }

  @Post('orders/:id/payments')
  @HttpCode(201)
  async registrar(
    @UsuarioActual() sesion: Sesion,
    @Param('id', new IdPositivoPipe(ID_ORDEN_INVALIDO)) id: number,
    @Body() dto: RegistrarPagosDto,
  ) {
    await this.branchAccess.exigirAccesoOrden(sesion, id);
    return this.servicio.registerPayments(actorDe(sesion), id, dto);
  }

  @Post('payments/:id/cancel')
  @HttpCode(200)
  async cancelar(
    @UsuarioActual() sesion: Sesion,
    @Param('id', new IdPositivoPipe(ID_PAGO_INVALIDO)) id: number,
    @Body() dto: CancelarPagoDto,
  ) {
    await this.branchAccess.exigirAccesoPago(sesion, id);
    return this.servicio.cancelPayment(actorDe(sesion), id, dto.reason);
  }
}
