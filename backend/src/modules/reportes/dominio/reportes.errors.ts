import { DatoInvalidoError, ErrorDeDominio, NoEncontradoError, ReglaDeNegocioError } from '../../../comun/errores';

export class ReleaseOrderNotFoundError extends NoEncontradoError {
  constructor() {
    super('La orden no existe');
  }
}

export class CancelledOrderError extends ReglaDeNegocioError {
  constructor() {
    super('La orden está cancelada');
  }
}

export class InvalidChannelError extends DatoInvalidoError {
  constructor() {
    super('Canal de entrega no válido');
  }
}

export class ReportGenerationError extends ErrorDeDominio {
  constructor() {
    super('Error al generar informe PDF');
  }
}
