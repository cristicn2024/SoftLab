import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';
import { respuestaDeError } from './respuesta-error';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(error: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<{ url: string }>();
    const estado = error.getStatus();

    const cuerpo = error.getResponse();
    const mensaje =
      typeof cuerpo === 'object' && cuerpo !== null && 'message' in cuerpo
        ? (cuerpo as { message: string | string[] }).message
        : error.message;

    res.status(estado).json(respuestaDeError(estado, error.name, mensaje, req.url));
  }
}
