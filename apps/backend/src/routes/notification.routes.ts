import { Router } from 'express';
import { processNotifications, sendNotification } from '../controllers/notification.controller';

const router = Router();

router.post('/process', processNotifications);
router.post('/send', sendNotification);

export default router;
