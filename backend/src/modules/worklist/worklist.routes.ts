import { Router } from 'express';
import { resolveTenant } from '../../middleware/tenant';
import type { WorklistController } from './worklist.controller';

export function createWorklistRouter(controller: WorklistController): Router {
  const router = Router();

  router.use(resolveTenant);
  router.get('/', controller.list);
  router.get('/orders/:orderId', controller.show);
  router.post('/orders/:orderId/results', controller.save);

  return router;
}
