import { Router } from 'express';
import {
  close,
  exportCsv,
  getContext,
  getHistory,
  getSummary
} from '../controllers/cashCut.controller';

const router = Router();

router.get('/cash-cuts/context', getContext);
router.get('/cash-cuts/summary', getSummary);
router.get('/cash-cuts/:id/export', exportCsv);
router.get('/cash-cuts', getHistory);
router.post('/cash-cuts/close', close);

export default router;
