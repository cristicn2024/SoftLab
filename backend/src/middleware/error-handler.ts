import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../common/app-error';

function statusOf(error: unknown): number | null {
  if (error instanceof AppError) {
    return error.statusCode;
  }
  const code = (error as { statusCode?: unknown } | null)?.statusCode;
  if (typeof code === 'number') {
    return code;
  }
  return null;
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  const status = statusOf(error);

  if (status === null) {
    console.error(`${req.method} ${req.originalUrl}`, error);
    res.status(500).json({ error: { tipo: 'ErrorInterno', mensaje: 'Ocurrió un error inesperado.' } });
    return;
  }

  const failure = error as Error;
  res.status(status).json({ error: { tipo: failure.name, mensaje: failure.message } });
}
