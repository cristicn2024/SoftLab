export abstract class ErrorDeDominio extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = new.target.name;
  }
}

export abstract class NoEncontradoError extends ErrorDeDominio {}

export abstract class ReglaDeNegocioError extends ErrorDeDominio {}

export abstract class NoAutorizadoError extends ErrorDeDominio {}

export abstract class DatoInvalidoError extends ErrorDeDominio {}
