import { Transform } from 'class-transformer';
import {
  IsArray,
  Validate,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import type { ResultEntry } from '../dominio/worklist.types';

const MENSAJE_ENTRADA = 'Cada resultado necesita orderItemId, parameterId y value (texto).';

function esEntradaValida(item: unknown): boolean {
  if (typeof item !== 'object' || item === null) {
    return false;
  }
  const entrada = item as { orderItemId?: unknown; parameterId?: unknown; value?: unknown };
  return (
    Number.isInteger(entrada.orderItemId) &&
    Number.isInteger(entrada.parameterId) &&
    typeof entrada.value === 'string'
  );
}

@ValidatorConstraint({ name: 'entradasDeResultados', async: false })
export class EntradasDeResultadosConstraint implements ValidatorConstraintInterface {
  validate(valor: unknown): boolean {
    if (!Array.isArray(valor)) {
      return true;
    }
    for (const item of valor) {
      if (!esEntradaValida(item)) {
        return false;
      }
    }
    return true;
  }

  defaultMessage(): string {
    return MENSAJE_ENTRADA;
  }
}

export class GuardarResultadosDto {
  @Transform(({ obj }: { obj: { results?: unknown } }) => obj.results)
  @IsArray({ message: 'Manda la lista de resultados en "results".' })
  @Validate(EntradasDeResultadosConstraint)
  results: ResultEntry[];
}
