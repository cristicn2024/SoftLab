import { Router } from 'express';
import { getOrderPdf, verifyReport } from '../controllers/report.controller';

const router = Router();
router.get('/reports/orders/:orderId/pdf', getOrderPdf);
router.post('/reports/orders/:orderId/pdf', getOrderPdf);
router.get('/verify-report/:token', verifyReport);
export default router;
