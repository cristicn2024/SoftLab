import { Body, Controller, Get, HttpCode, NotFoundException, Param, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { UsuarioActual } from '../../auth/decoradores/usuario-actual.decorator';
import type { Sesion } from '../../auth/dominio/sesion';
import { IdPositivoPipe } from '../../comun/pipes/id-positivo.pipe';
import { CorteCajaService } from './dominio/corte-caja.service';
import { CerrarCorteDto } from './dto/cerrar-corte.dto';
import { ConsultaCorteDto } from './dto/consulta-corte.dto';
import { BranchAccessService } from '../../auth/branch-access.service';

const ID_CORTE_INVALIDO = 'ID de corte inválido';

/**
 * @author Jesús Rodrigo Villegas Argüelles - 261186
 */
@ApiTags('corte-caja')
@Controller('cash-cuts')
export class CorteCajaController {
  constructor(private readonly servicio: CorteCajaService, private readonly branchAccess: BranchAccessService) {}

  @Get('context')
  async contexto(@UsuarioActual() sesion: Sesion) {
    const context = await this.servicio.getContext(sesion.tenantId, new Date());
    const allowed = await this.branchAccess.allowedBranchIds(sesion);
    return { ...context, branches: allowed === null ? context.branches : context.branches.filter(branch => allowed.includes(branch.id)) };
  }

  @Get('summary')
  async resumen(@UsuarioActual() sesion: Sesion, @Query() consulta: ConsultaCorteDto) {
    await this.branchAccess.exigirAcceso(sesion, consulta.branchId);
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
    const cuts = await this.servicio.getHistory(sesion.tenantId);
    const cut = cuts.find(row => row.id === id);
    if (!cut) throw new NotFoundException('Corte no encontrado.');
    await this.branchAccess.exigirAcceso(sesion, cut.branch.id);
    const csv = await this.servicio.getCsv(sesion.tenantId, id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="corte-caja-${id}.csv"`);
    return '﻿' + csv;
  }

  @Get()
  async historial(@UsuarioActual() sesion: Sesion) {
    const [cuts, allowed] = await Promise.all([this.servicio.getHistory(sesion.tenantId), this.branchAccess.allowedBranchIds(sesion)]);
    return allowed === null ? cuts : cuts.filter(cut => allowed.includes(cut.branch.id));
  }

  @Post('close')
  @HttpCode(201)
  async cerrar(@UsuarioActual() sesion: Sesion, @Body() dto: CerrarCorteDto) {
    await this.branchAccess.exigirAcceso(sesion, dto.branchId);
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
