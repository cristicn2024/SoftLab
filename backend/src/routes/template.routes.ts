import { Router } from 'express';
import { getActiveTemplate, getTemplateHistory, saveTemplate } from '../controllers/template.controller';

const router = Router();

router.get('/templates/active', getActiveTemplate);
router.post('/templates', saveTemplate);
router.get('/templates', getTemplateHistory);

export default router;