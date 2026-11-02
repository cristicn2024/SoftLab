import { Router } from 'express';
import { 
  searchConcepts, 
  checkOpenOrderToday, 
  createDoctorExpress, 
  createOrder 
} from '../controllers/orderCapture.controller';

const router = Router();

router.get('/concepts/search', searchConcepts);
router.get('/orders/check-open', checkOpenOrderToday);
router.post('/doctors/express', createDoctorExpress);
router.post('/orders', createOrder);

export default router;