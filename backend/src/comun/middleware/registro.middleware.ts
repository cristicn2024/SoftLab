import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class RegistroMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const inicio = Date.now();
    const recibido = req.headers['x-request-id'];
    const id = typeof recibido === 'string' ? recibido : randomUUID();
    res.setHeader('X-Request-Id', id);

    res.on('finish', () => {
      this.logger.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - inicio}ms) [${id}]`);
    });
    next();
  }
}
