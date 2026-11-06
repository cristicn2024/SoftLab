import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Allow } from 'class-validator';

function valorOriginal(campo: string) {
  return Transform(({ obj }: { obj: Record<string, unknown> }) => obj[campo]);
}

export class RegistrarPagosDto {
  @ApiPropertyOptional({ description: 'Pagos nuevos: [{ method: cash|card|transfer, amount, reference }]' })
  @Allow()
  @valorOriginal('payments')
  payments?: unknown;

  @ApiPropertyOptional({ description: 'Efectivo recibido, sirve para calcular el cambio' })
  @Allow()
  @valorOriginal('cashReceived')
  cashReceived?: unknown;

  @ApiPropertyOptional({ description: 'Descuento: { percent: 0|5|10|15|20, reason }' })
  @Allow()
  @valorOriginal('discount')
  discount?: unknown;

  @ApiPropertyOptional({ description: 'Datos de facturación: { rfc, name, zip, use }' })
  @Allow()
  @valorOriginal('invoice')
  invoice?: unknown;

  @ApiPropertyOptional({ description: 'Dejar la orden pendiente de pago sin capturar montos' })
  @Allow()
  @valorOriginal('leavePending')
  leavePending?: unknown;
}
