import {
  DatoInvalidoError,
  NoAutorizadoError,
  NoEncontradoError,
  ReglaDeNegocioError,
} from '../../../comun/errores';

export class BillingOrderNotFoundError extends NoEncontradoError {
  constructor() {
    super('La orden no existe');
  }
}

export class PaymentNotFoundError extends NoEncontradoError {
  constructor() {
    super('El pago no existe');
  }
}

export class DiscountNotAllowedError extends NoAutorizadoError {
  constructor() {
    super('Tu rol no tiene permiso para aplicar descuentos.');
  }
}

export class CancelNotAllowedError extends NoAutorizadoError {
  constructor() {
    super('Tu rol no tiene permiso especial para cancelar pagos.');
  }
}

export class InvalidDiscountError extends DatoInvalidoError {}

export class InvalidInvoiceError extends DatoInvalidoError {}

export class InvalidPaymentError extends DatoInvalidoError {}

export class CancelReasonRequiredError extends DatoInvalidoError {
  constructor() {
    super('El motivo de la cancelación es obligatorio.');
  }
}

export class ResultsAlreadyDeliveredError extends ReglaDeNegocioError {}

export class PaymentAlreadyCancelledError extends ReglaDeNegocioError {
  constructor() {
    super('El pago ya estaba cancelado.');
  }
}
