import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min
} from 'class-validator';

export const CASH_CUT_SHIFTS = ['matutino', 'vespertino', 'nocturno'] as const;
export type CashCutShiftValue = (typeof CASH_CUT_SHIFTS)[number];

export class CashCutQueryDto {
  @Type(() => Number)
  @IsInt({ message: 'branchId debe ser un entero' })
  branchId!: number;

  @Type(() => Number)
  @IsInt({ message: 'cashierId debe ser un entero' })
  cashierId!: number;

  @IsIn(CASH_CUT_SHIFTS, { message: 'Turno inválido' })
  shift!: CashCutShiftValue;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha debe tener formato YYYY-MM-DD' })
  date!: string;
}

export class CloseCashCutDto extends CashCutQueryDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El efectivo contado debe ser numérico' })
  @Min(0, { message: 'El efectivo contado no puede ser negativo' })
  countedCash!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La observación no puede exceder 500 caracteres' })
  observation?: string;
}

export class CreateCashCutDto extends CashCutQueryDto {
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  note?: string;
}
