import { DatoInvalidoError } from '../../../comun/errores';

export class DatoExternoInvalidoError extends DatoInvalidoError {
  constructor(mensaje: string) {
    super(mensaje);
  }
}

export class LaboratorioExternoNoValidoError extends DatoInvalidoError {
  constructor() {
    super('El laboratorio externo no existe o está inactivo en este laboratorio.');
  }
}

export class FiltroInvalidoError extends DatoInvalidoError {
  constructor(mensaje: string) {
    super(mensaje);
  }
}
