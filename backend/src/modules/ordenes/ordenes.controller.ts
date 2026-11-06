import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UsuarioActual } from '../../auth/decoradores/usuario-actual.decorator';
import type { Sesion } from '../../auth/dominio/sesion';
import { OrdenesService } from './dominio/ordenes.service';
import { CrearOrdenDto } from './dto/crear-orden.dto';
import { RegistrarMedicoDto } from './dto/registrar-medico.dto';

@ApiTags('ordenes')
@Controller()
export class OrdenesController {
  constructor(private readonly servicio: OrdenesService) {}

  @Get('concepts/search')
  buscarConceptos(@UsuarioActual() sesion: Sesion, @Query('q') q: unknown) {
    return this.servicio.searchConcepts(sesion.tenantId, q);
  }

  @Get('orders/check-open')
  ordenAbierta(@UsuarioActual() sesion: Sesion, @Query('patientId') patientId: unknown) {
    return this.servicio.checkOpenOrder(sesion.tenantId, patientId, new Date());
  }

  @Post('doctors/express')
  @HttpCode(201)
  registrarMedico(@UsuarioActual() sesion: Sesion, @Body() dto: RegistrarMedicoDto) {
    return this.servicio.registerDoctor({
      tenantId: sesion.tenantId,
      name: dto.name,
      cedula: dto.cedula,
      specialty: dto.specialty,
    });
  }

  @Post('orders')
  @HttpCode(201)
  crear(@UsuarioActual() sesion: Sesion, @Body() dto: CrearOrdenDto) {
    return this.servicio.createOrder(sesion.tenantId, dto, new Date());
  }
}
