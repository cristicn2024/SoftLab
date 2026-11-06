import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ConsultaCorteDto } from './consulta-corte.dto';

/**
 * @author Jesús Rodrigo Villegas Argüelles - 261186
 */
export class CerrarCorteDto extends ConsultaCorteDto {
  @ApiProperty({ example: 1250.5, description: 'Efectivo contado en caja, máximo 2 decimales' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El efectivo contado debe ser numérico' })
  @Min(0, { message: 'El efectivo contado no puede ser negativo' })
  countedCash!: number;

  @ApiPropertyOptional({ maxLength: 500, description: 'Obligatoria cuando hay diferencia con el efectivo esperado' })
  @IsOptional()
  @Transform(({ obj }: { obj: Record<string, unknown> }) => obj.observation)
  @IsString()
  @MaxLength(500, { message: 'La observación no puede exceder 500 caracteres' })
  observation?: string;
}
