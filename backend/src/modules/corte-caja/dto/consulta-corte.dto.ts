import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, Matches } from 'class-validator';
import { SHIFT_VALUES } from '../dominio/corte-caja.rules';
import type { ShiftValue } from '../dominio/corte-caja.types';

/**
 * @author Jesús Rodrigo Villegas Argüelles - 261186
 */
export class ConsultaCorteDto {
  @ApiProperty({ example: 1, description: 'Id de la sucursal' })
  @Type(() => Number)
  @IsInt({ message: 'branchId debe ser un entero' })
  branchId!: number;

  @ApiProperty({ example: 1, description: 'Id del cajero; 0 significa "Sin asignar"' })
  @Type(() => Number)
  @IsInt({ message: 'cashierId debe ser un entero' })
  cashierId!: number;

  @ApiProperty({ enum: SHIFT_VALUES, example: 'matutino' })
  @IsIn(SHIFT_VALUES, { message: 'Turno inválido' })
  shift!: ShiftValue;

  @ApiProperty({ example: '2026-11-02', description: 'Fecha del corte en formato YYYY-MM-DD' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha debe tener formato YYYY-MM-DD' })
  date!: string;
}
