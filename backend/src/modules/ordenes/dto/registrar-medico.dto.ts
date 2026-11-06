import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

type Cuerpo = { obj: Record<string, unknown> };

export class RegistrarMedicoDto {
  @ApiProperty({ description: 'Nombre del médico solicitante' })
  @IsString({ message: 'name debe ser texto.' })
  @Transform(({ obj }: Cuerpo) => obj.name)
  name!: string;

  @ApiPropertyOptional({ description: 'Cédula profesional' })
  @IsOptional()
  @IsString({ message: 'cedula debe ser texto.' })
  @Transform(({ obj }: Cuerpo) => obj.cedula)
  cedula?: string | null;

  @ApiPropertyOptional({ description: 'Especialidad' })
  @IsOptional()
  @IsString({ message: 'specialty debe ser texto.' })
  @Transform(({ obj }: Cuerpo) => obj.specialty)
  specialty?: string | null;
}
