import { Request, Response } from 'express';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { CashCutQueryDto, CloseCashCutDto } from '../dtos/cashCut.dto';
import {
  CashCutConflictError,
  CashCutNotFoundError,
  CashCutValidationError,
  closeCashCut,
  getCashCutContext,
  getCashCutCsv,
  getCashCutHistory,
  getCashCutSummary
} from '../services/cashCut.service';

function tenantIdFrom(req: Request) {
  return Number(req.headers['x-tenant-id'] || 1);
}

function userIdFrom(req: Request, fallback: number) {
  const value = Number(req.headers['x-user-id']);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function formatValidationErrors(errors: ValidationError[]) {
  return errors.map(error => ({
    field: error.property,
    messages: Object.values(error.constraints ?? {})
  }));
}

async function parseDto<T extends object>(cls: new () => T, payload: unknown) {
  const dto = plainToInstance(cls, payload, { enableImplicitConversion: true });
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: false
  });
  return { dto, errors };
}

function handleError(res: Response, error: unknown) {
  if (error instanceof CashCutValidationError) {
    return res.status(error.status).json({ error: error.message });
  }
  if (error instanceof CashCutConflictError) {
    return res.status(error.status).json({ error: error.message });
  }
  if (error instanceof CashCutNotFoundError) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error(error);
  return res.status(500).json({ error: 'Error interno al procesar el corte de caja' });
}

// GET /api/cash-cuts/context
export async function getContext(req: Request, res: Response) {
  try {
    const context = await getCashCutContext(tenantIdFrom(req));
    return res.json(context);
  } catch (error) {
    return handleError(res, error);
  }
}

// GET /api/cash-cuts/summary?branchId=1&cashierId=1&shift=matutino&date=2026-11-02
export async function getSummary(req: Request, res: Response) {
  try {
    const { dto, errors } = await parseDto(CashCutQueryDto, req.query);
    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Parámetros inválidos',
        details: formatValidationErrors(errors)
      });
    }

    const summary = await getCashCutSummary({
      tenantId: tenantIdFrom(req),
      branchId: dto.branchId,
      cashierId: dto.cashierId,
      shift: dto.shift,
      date: dto.date
    });

    return res.json(summary);
  } catch (error) {
    return handleError(res, error);
  }
}

// POST /api/cash-cuts/close
export async function close(req: Request, res: Response) {
  try {
    const { dto, errors } = await parseDto(CloseCashCutDto, req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: formatValidationErrors(errors)
      });
    }

    const result = await closeCashCut(
      {
        tenantId: tenantIdFrom(req),
        branchId: dto.branchId,
        cashierId: dto.cashierId,
        shift: dto.shift,
        date: dto.date
      },
      {
        countedCash: dto.countedCash,
        observation: dto.observation,
        closedById: userIdFrom(req, dto.cashierId)
      }
    );

    return res.status(201).json(result);
  } catch (error) {
    return handleError(res, error);
  }
}

// GET /api/cash-cuts
export async function getHistory(req: Request, res: Response) {
  try {
    const cuts = await getCashCutHistory(tenantIdFrom(req));
    return res.json(cuts);
  } catch (error) {
    return handleError(res, error);
  }
}

// GET /api/cash-cuts/:id/export
export async function exportCsv(req: Request, res: Response) {
  try {
    const cutId = Number(req.params.id);
    if (!Number.isFinite(cutId)) {
      return res.status(400).json({ error: 'ID de corte inválido' });
    }

    const csv = await getCashCutCsv(tenantIdFrom(req), cutId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="corte-caja-${cutId}.csv"`
    );
    return res.send('\uFEFF' + csv);
  } catch (error) {
    return handleError(res, error);
  }
}
