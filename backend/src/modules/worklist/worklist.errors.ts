import { AppError } from '../../common/app-error';

export class OrderNotFoundError extends AppError {
  constructor(orderId: number) {
    super(`No existe la orden ${orderId} en este laboratorio o no tiene muestras recibidas.`, 404);
  }
}

export class EmptyCaptureError extends AppError {
  constructor() {
    super('Escribe al menos un resultado.', 422);
  }
}

export class InvalidResultError extends AppError {
  constructor(parameterName: string, reason: string) {
    super(`${parameterName}: ${reason}`, 422);
  }
}

export class CriticalValueError extends AppError {
  constructor(parameterName: string, flag: string) {
    super(
      `${parameterName}: valor crítico (${flag}). Falta registrar a quién se notificó antes de guardarlo (HU 6.2).`,
      422,
    );
  }
}

export class ParameterNotPendingError extends AppError {
  constructor(parameterId: number) {
    super(`El parámetro ${parameterId} no está pendiente de captura en esta orden.`, 409);
  }
}

export class ResultAlreadyCapturedError extends AppError {
  constructor() {
    super('Alguien más ya capturó uno de estos resultados. Actualiza la lista de trabajo.', 409);
  }
}
