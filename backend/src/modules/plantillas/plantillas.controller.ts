import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UsuarioActual } from '../../auth/decoradores/usuario-actual.decorator';
import type { Sesion } from '../../auth/dominio/sesion';
import { PlantillasService } from './dominio/plantillas.service';
import { GuardarPlantillaDto } from './dto/guardar-plantilla.dto';

@ApiTags('plantillas')
@Controller('templates')
export class PlantillasController {
  constructor(private readonly servicio: PlantillasService) {}

  @Get('active')
  vigente(@UsuarioActual() sesion: Sesion) {
    return this.servicio.getActive(sesion.tenantId);
  }

  @Post()
  @HttpCode(201)
  guardar(@UsuarioActual() sesion: Sesion, @Body() dto: GuardarPlantillaDto) {
    return this.servicio.save(sesion.tenantId, dto);
  }

  @Get()
  historial(@UsuarioActual() sesion: Sesion) {
    return this.servicio.history(sesion.tenantId);
  }
}
