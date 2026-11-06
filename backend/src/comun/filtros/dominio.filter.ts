import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import {
  DatoInvalidoError,
  ErrorDeDominio,
  NoAutorizadoError,
  NoEncontradoError,
  ReglaDeNegocioError,
} from '../errores';
import { respuestaDeError } from './respuesta-error';

@Catch(ErrorDeDominio)
export class DominioExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Dominio');

  private codigoPara(error: ErrorDeDominio): number {
    if (error instanceof NoEncontradoError) return HttpStatus.NOT_FOUND;
    if (error instanceof NoAutorizadoError) return HttpStatus.FORBIDDEN;
    if (error instanceof DatoInvalidoError) return HttpStatus.UNPROCESSABLE_ENTITY;
    if (error instanceof ReglaDeNegocioError) return HttpStatus.CONFLICT;
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  catch(error: ErrorDeDominio, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<{ url: string; method: string }>();
    const estado = this.codigoPara(error);

    this.logger.warn(`${req.method} ${req.url} -> ${estado} ${error.name}`);
    res.status(estado).json(respuestaDeError(estado, error.name, error.message, req.url));
  }
}
