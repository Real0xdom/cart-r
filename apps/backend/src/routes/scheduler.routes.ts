import { Router } from 'express';
import { dispatchScheduledRides } from '../controllers/scheduler.controller';

const router = Router();

router.post('/dispatch', dispatchScheduledRides);

export default router;
