import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GuardarPlantillaDto {
  @ApiPropertyOptional({ description: 'Encabezado del informe' })
  @IsOptional()
  @IsString({ message: 'headerText debe ser texto.' })
  headerText?: string | null;

  @ApiPropertyOptional({ description: 'Aviso legal al pie' })
  @IsOptional()
  @IsString({ message: 'disclaimer debe ser texto.' })
  disclaimer?: string | null;

  @ApiPropertyOptional({ description: 'Nombre del químico responsable' })
  @IsOptional()
  @IsString({ message: 'chemistName debe ser texto.' })
  chemistName?: string | null;

  @ApiPropertyOptional({ description: 'Cédula del químico responsable' })
  @IsOptional()
  @IsString({ message: 'chemistCedula debe ser texto.' })
  chemistCedula?: string | null;
}
