import { DatoInvalidoError, ErrorDeDominio } from '../../../comun/errores';

export class PatientRequiredError extends DatoInvalidoError {
  constructor() {
    super('patientId es requerido');
  }
}

export class BranchRequiredError extends DatoInvalidoError {
  constructor() {
    super('branchId es requerido');
  }
}

export class ConceptSearchFailedError extends ErrorDeDominio {
  constructor() {
    super('Error en búsqueda predictiva de conceptos');
  }
}

export class OpenOrderLookupFailedError extends ErrorDeDominio {
  constructor() {
    super('Error al consultar órdenes abiertas del día');
  }
}

export class DoctorRegistrationFailedError extends ErrorDeDominio {
  constructor() {
    super('Error al registrar médico solicitante');
  }
}

export class OrderConfirmationFailedError extends ErrorDeDominio {
  constructor() {
    super('Error al confirmar la orden');
  }
}
