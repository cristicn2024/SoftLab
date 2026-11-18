import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UsuarioActual } from '../../auth/decoradores/usuario-actual.decorator';
import type { Sesion } from '../../auth/dominio/sesion';
import { leerFiltro } from './dominio/externos.rules';
import { ExternosService } from './dominio/externos.service';

@ApiTags('externos')
@Controller('externos')
export class ExternosController {
  constructor(private readonly servicio: ExternosService) {}

  @Get('laboratorios')
  laboratorios(@UsuarioActual() sesion: Sesion) {
    return this.servicio.laboratorios(sesion.tenantId);
  }

  @Get('estudios')
  estudios(
    @UsuarioActual() sesion: Sesion,
    @Query('q') q: unknown,
    @Query('laboratorio') laboratorio: unknown,
    @Query('estatus') estatus: unknown,
  ) {
    return this.servicio.listar(sesion.tenantId, leerFiltro(q, laboratorio, estatus));
  }
}
