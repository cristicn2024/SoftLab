import { Transform } from 'class-transformer';
import {
  IsArray,
  Validate,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { CRITICAL_CONTACT_METHODS, CRITICAL_RECIPIENTS, type ResultEntry } from '../dominio/worklist.types';

const MENSAJE_ENTRADA = 'Cada resultado necesita orderItemId, parameterId y value (texto).';
function esNotificacionValida(valor: unknown): boolean {
  if (valor === undefined) {
    return true;
  }
  if (typeof valor !== 'object' || valor === null) {
    return false;
  }
  const n = valor as { recipient?: unknown; recipientName?: unknown; contactMethod?: unknown; notifiedAt?: unknown };
  return (
    (CRITICAL_RECIPIENTS as readonly unknown[]).includes(n.recipient) &&
    typeof n.recipientName === 'string' &&
    (CRITICAL_CONTACT_METHODS as readonly unknown[]).includes(n.contactMethod) &&
    (n.notifiedAt === undefined || typeof n.notifiedAt === 'string')
  );
}

function esEntradaValida(item: unknown): boolean {
  if (typeof item !== 'object' || item === null) {
    return false;
  }
  const entrada = item as { orderItemId?: unknown; parameterId?: unknown; value?: unknown; notification?: unknown };
  return (
    Number.isInteger(entrada.orderItemId) &&
    Number.isInteger(entrada.parameterId) &&
    typeof entrada.value === 'string' &&
    esNotificacionValida(entrada.notification)
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
