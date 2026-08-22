import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf.toString('utf8');
  },
}));

import driverRoutes from './routes/driver.routes';
import fareRoutes from './routes/fare.routes';
import paymentRoutes from './routes/payment.routes';
import schedulerRoutes from './routes/scheduler.routes';
import notificationRoutes from './routes/notification.routes';
import payoutRoutes from './routes/payout.routes';
import smsRoutes from './routes/sms.routes';

app.use('/api/driver', driverRoutes);
app.use('/api/fare', fareRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/scheduler', schedulerRoutes);
app.use('/api/notification', notificationRoutes);
app.use('/api/payout', payoutRoutes);
app.use('/api/sms', smsRoutes);

app.get('/', (req, res) => {
  res.send('CartR Express Backend is running!');
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});
