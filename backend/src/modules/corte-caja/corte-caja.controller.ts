import { Body, Controller, Get, HttpCode, Param, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { UsuarioActual } from '../../auth/decoradores/usuario-actual.decorator';
import type { Sesion } from '../../auth/dominio/sesion';
import { IdPositivoPipe } from '../../comun/pipes/id-positivo.pipe';
import { CorteCajaService } from './dominio/corte-caja.service';
import { CerrarCorteDto } from './dto/cerrar-corte.dto';
import { ConsultaCorteDto } from './dto/consulta-corte.dto';

const ID_CORTE_INVALIDO = 'ID de corte inválido';

/**
 * @author Jesús Rodrigo Villegas Argüelles - 261186
 */
@ApiTags('corte-caja')
@Controller('cash-cuts')
export class CorteCajaController {
  constructor(private readonly servicio: CorteCajaService) {}

  @Get('context')
  contexto(@UsuarioActual() sesion: Sesion) {
    return this.servicio.getContext(sesion.tenantId, new Date());
  }

  @Get('summary')
  resumen(@UsuarioActual() sesion: Sesion, @Query() consulta: ConsultaCorteDto) {
    return this.servicio.getSummary({
      tenantId: sesion.tenantId,
      branchId: consulta.branchId,
      cashierId: consulta.cashierId,
      shift: consulta.shift,
      date: consulta.date,
    });
  }

  @Get(':id/export')
  async exportar(
    @UsuarioActual() sesion: Sesion,
    @Param('id', new IdPositivoPipe(ID_CORTE_INVALIDO)) id: number,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const csv = await this.servicio.getCsv(sesion.tenantId, id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="corte-caja-${id}.csv"`);
    return '﻿' + csv;
  }

  @Get()
  historial(@UsuarioActual() sesion: Sesion) {
    return this.servicio.getHistory(sesion.tenantId);
  }

  @Post('close')
  @HttpCode(201)
  cerrar(@UsuarioActual() sesion: Sesion, @Body() dto: CerrarCorteDto) {
    let closedById: number | null = null;
    if (sesion.usuarioId !== undefined) closedById = sesion.usuarioId;
    else if (dto.cashierId > 0) closedById = dto.cashierId;

    return this.servicio.closeCut(
      {
        tenantId: sesion.tenantId,
        branchId: dto.branchId,
        cashierId: dto.cashierId,
        shift: dto.shift,
        date: dto.date,
      },
      { countedCash: dto.countedCash, observation: dto.observation, closedById },
      new Date(),
    );
  }
}
