import { Router } from 'express';
import { processSms } from '../controllers/sms.controller';

const router = Router();

router.post('/process', processSms);

export default router;
