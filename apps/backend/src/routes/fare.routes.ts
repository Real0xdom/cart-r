import { Router } from 'express';
import { calculateFare } from '../controllers/fare.controller';

const router = Router();

router.post('/calculate', calculateFare);

export default router;
