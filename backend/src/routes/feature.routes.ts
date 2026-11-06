import { Router } from 'express';
import {
  confirmInstructionsController,
  getFeatureDataController,
  recordCriticalNotificationController,
  recordDeliveryController,
  saveResultController,
} from '../controllers/feature.controller';

const router = Router();

router.get('/feature-data', getFeatureDataController);
router.post('/orders/:orderId/confirmation', confirmInstructionsController);
router.post('/orders/:orderId/deliveries', recordDeliveryController);
router.post('/results/:resultId/notification', recordCriticalNotificationController);
router.post('/results/:orderItemId', saveResultController);

export default router;
