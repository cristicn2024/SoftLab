import {
  DatoInvalidoError,
  ErrorDeDominio,
  NoEncontradoError,
  ReglaDeNegocioError,
} from '../../../comun/errores';

export class InvalidDateError extends DatoInvalidoError {
  constructor() {
    super('Fecha inválida');
  }
}

export class InvalidShiftError extends DatoInvalidoError {
  constructor() {
    super('Turno inválido');
  }
}

export class ObservationRequiredError extends DatoInvalidoError {
  constructor() {
    super('La observación es obligatoria cuando el efectivo contado presenta una diferencia');
  }
}

export class TenantNotFoundError extends NoEncontradoError {
  constructor() {
    super('Laboratorio no encontrado');
  }
}

export class NoBranchesError extends NoEncontradoError {
  constructor() {
    super('No hay sucursales registradas');
  }
}

export class BranchNotFoundError extends NoEncontradoError {
  constructor() {
    super('Sucursal no encontrada');
  }
}

export class CashierNotFoundError extends NoEncontradoError {
  constructor() {
    super('Cajero no encontrado');
  }
}

export class CutNotFoundError extends NoEncontradoError {
  constructor() {
    super('Corte de caja no encontrado');
  }
}

export class CutAlreadyClosedError extends ReglaDeNegocioError {
  constructor() {
    super('El corte de caja ya está cerrado y no puede modificarse');
  }
}

export class CashCutFailedError extends ErrorDeDominio {
  constructor() {
    super('Error interno al procesar el corte de caja');
  }
}
