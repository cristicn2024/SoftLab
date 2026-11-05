import type { NextFunction, Request, Response } from 'express';
import { BadRequestError } from '../common/app-error';

export function resolveTenant(req: Request, res: Response, next: NextFunction) {
  const raw = req.headers['x-tenant-id'];
  const tenantId = Number(raw);

  if (typeof raw !== 'string' || !Number.isInteger(tenantId) || tenantId <= 0) {
    next(new BadRequestError('Falta el encabezado x-tenant-id con el id del laboratorio.'));
    return;
  }

  res.locals.tenantId = tenantId;
  next();
}
