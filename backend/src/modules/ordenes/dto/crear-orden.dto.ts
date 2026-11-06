import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Allow } from 'class-validator';

type Cuerpo = { obj: Record<string, unknown> };

export class CrearOrdenDto {
  @ApiPropertyOptional({ description: 'Id del paciente (obligatorio)' })
  @Allow()
  @Transform(({ obj }: Cuerpo) => obj.patientId)
  patientId?: unknown;

  @ApiPropertyOptional({ description: 'Id de la sucursal (obligatorio)' })
  @Allow()
  @Transform(({ obj }: Cuerpo) => obj.branchId)
  branchId?: unknown;

  @ApiPropertyOptional({ description: 'Id del médico solicitante; vacío si es particular' })
  @Allow()
  @Transform(({ obj }: Cuerpo) => obj.doctorId)
  doctorId?: unknown;

  @ApiPropertyOptional({ description: 'Conceptos de la orden: { id, type: TEST | PROFILE, price }' })
  @Allow()
  @Transform(({ obj }: Cuerpo) => obj.items)
  items?: unknown;

  @ApiPropertyOptional({ description: 'Total de la orden' })
  @Allow()
  @Transform(({ obj }: Cuerpo) => obj.totalAmount)
  totalAmount?: unknown;
}
