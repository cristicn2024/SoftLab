import { Router } from 'express';
import { cancelPayment, getBilling, registerPayments } from '../controllers/payment.controller';

// HU 5.3 · Total y estado de pago
const router = Router();

router.get('/orders/:id/billing', getBilling);
router.post('/orders/:id/payments', registerPayments);
router.post('/payments/:id/cancel', cancelPayment);

export default router;
