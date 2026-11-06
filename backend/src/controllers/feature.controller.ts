import { Request, Response } from 'express';
import { getFeatureData } from '../services/featureData.service';
import { confirmOrderInstructions, recordInstructionDelivery } from '../services/orders.service';
import { recordCriticalNotification, saveResult } from '../services/results.service';

function statusCode(error: unknown) {
  return typeof error === 'object' && error !== null && 'statusCode' in error
    ? Number(error.statusCode)
    : 400;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error al procesar la solicitud.';
}

export async function getFeatureDataController(_req: Request, res: Response) {
  try {
    const tenant = await getFeatureData();
    if (!tenant) return res.status(404).json({ error: 'No hay datos HU. Ejecuta el seed específico.' });
    return res.json(tenant);
  } catch (error) {
    return res.status(500).json({ error: errorMessage(error) });
  }
}

export async function confirmInstructionsController(req: Request, res: Response) {
  try {
    const result = await confirmOrderInstructions(Number(req.params.orderId), req.body.observation ?? null);
    return res.json(result);
  } catch (error) {
    return res.status(statusCode(error)).json({ error: errorMessage(error) });
  }
}

export async function recordDeliveryController(req: Request, res: Response) {
  try {
    const channel = req.body.channel === 'email' ? 'email' : 'whatsapp';
    const result = await recordInstructionDelivery(Number(req.params.orderId), channel);
    return res.json(result);
  } catch (error) {
    return res.status(statusCode(error)).json({ error: errorMessage(error) });
  }
}

export async function recordCriticalNotificationController(req: Request, res: Response) {
  try {
    const result = await recordCriticalNotification(
      Number(req.params.resultId),
      Number(req.body.branchId),
      req.body,
    );
    return res.json(result);
  } catch (error) {
    return res.status(statusCode(error)).json({ error: errorMessage(error) });
  }
}

export async function saveResultController(req: Request, res: Response) {
  try {
    const result = await saveResult(
      Number(req.params.orderItemId),
      Number(req.body.parameterId),
      String(req.body.value),
      String(req.body.flag),
      req.body.notification,
    );
    return res.json(result);
  } catch (error) {
    return res.status(statusCode(error)).json({ error: errorMessage(error) });
  }
}
