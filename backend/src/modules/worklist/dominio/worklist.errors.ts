import { DatoInvalidoError, NoEncontradoError, ReglaDeNegocioError } from '../../../comun/errores';

export class OrderNotFoundError extends NoEncontradoError {
  constructor(orderId: number) {
    super(`No existe la orden ${orderId} en este laboratorio o no tiene muestras recibidas.`);
  }
}

export class EmptyCaptureError extends DatoInvalidoError {
  constructor() {
    super('Escribe al menos un resultado.');
  }
}

export class InvalidResultError extends DatoInvalidoError {
  constructor(parameterName: string, reason: string) {
    super(`${parameterName}: ${reason}`);
  }
}

export class CriticalValueError extends DatoInvalidoError {
  constructor(parameterName: string, flag: string) {
    super(
      `${parameterName}: valor crítico (${flag}). Falta registrar a quién se notificó antes de guardarlo (HU 6.2).`,
    );
  }
}

export class ParameterNotPendingError extends ReglaDeNegocioError {
  constructor(parameterId: number) {
    super(`El parámetro ${parameterId} no está pendiente de captura en esta orden.`);
  }
}

export class ResultAlreadyCapturedError extends ReglaDeNegocioError {
  constructor() {
    super('Alguien más ya capturó uno de estos resultados. Actualiza la lista de trabajo.');
  }
}
