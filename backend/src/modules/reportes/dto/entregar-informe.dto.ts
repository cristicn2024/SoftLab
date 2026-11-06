import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Allow } from 'class-validator';

export class EntregarInformeDto {
  @ApiPropertyOptional({ description: 'Canal de entrega: counter, email, portal o print (por omisión counter)' })
  @Allow()
  @Transform(({ obj }: { obj: Record<string, unknown> }) => obj.channel)
  channel?: unknown;

  @ApiPropertyOptional({ description: 'Motivo de la excepción de entrega con saldo pendiente (solo administrador)' })
  @Allow()
  @Transform(({ obj }: { obj: Record<string, unknown> }) => obj.reason)
  reason?: unknown;
}
