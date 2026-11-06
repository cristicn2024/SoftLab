import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Allow } from 'class-validator';

export class CancelarPagoDto {
  @ApiPropertyOptional({ description: 'Motivo de la cancelación (obligatorio)' })
  @Allow()
  @Transform(({ obj }: { obj: Record<string, unknown> }) => obj.reason)
  reason?: unknown;
}
