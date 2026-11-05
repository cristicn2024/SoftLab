import type { Request, Response } from 'express';
import { BadRequestError } from '../../common/app-error';
import type { WorklistService } from './worklist.service';
import type { ResultEntry } from './worklist.types';

function tenantOf(res: Response): number {
  return res.locals.tenantId as number;
}

function parseOrderId(raw: string): number {
  const orderId = Number(raw);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    throw new BadRequestError('El id de la orden no es válido.');
  }
  return orderId;
}

function parseEntries(body: unknown): ResultEntry[] {
  const list = (body as { results?: unknown } | null)?.results;
  if (!Array.isArray(list)) {
    throw new BadRequestError('Manda la lista de resultados en "results".');
  }

  const entries: ResultEntry[] = [];
  for (const item of list) {
    const entry = item as { orderItemId?: unknown; parameterId?: unknown; value?: unknown };
    if (!Number.isInteger(entry.orderItemId) || !Number.isInteger(entry.parameterId) || typeof entry.value !== 'string') {
      throw new BadRequestError('Cada resultado necesita orderItemId, parameterId y value (texto).');
    }
    entries.push({
      orderItemId: entry.orderItemId as number,
      parameterId: entry.parameterId as number,
      value: entry.value,
    });
  }
  return entries;
}

export function createWorklistController(service: WorklistService) {
  return {
    async list(_req: Request, res: Response) {
      const worklist = await service.getWorklist(tenantOf(res));
      res.json(worklist);
    },

    async show(req: Request, res: Response) {
      const order = await service.getOrder(tenantOf(res), parseOrderId(String(req.params.orderId)));
      res.json(order);
    },

    async save(req: Request, res: Response) {
      const orderId = parseOrderId(String(req.params.orderId));
      const saved = await service.saveOrderResults(tenantOf(res), orderId, parseEntries(req.body));
      res.status(201).json({ saved });
    },
  };
}

export type WorklistController = ReturnType<typeof createWorklistController>;
