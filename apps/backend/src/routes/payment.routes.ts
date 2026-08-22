import { Router } from 'express';
import { createPaymentOrder, checkoutPage, verifyPayment, paymentWebhook, createUpiQr } from '../controllers/payment.controller';

const router = Router();

router.post('/order', createPaymentOrder);
router.get('/checkout-page', checkoutPage);
router.post('/verify', verifyPayment);
router.post('/webhook', paymentWebhook);
router.post('/create-upi-qr', createUpiQr);

export default router;
