import { Router } from 'express';
import { assignDriver } from '../controllers/driver.controller';

const router = Router();

router.post('/assign', assignDriver);

export default router;
