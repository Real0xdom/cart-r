import { Request, Response } from 'express';
import { supabase } from '../utils/supabase';

interface PaymentOrderRequest {
  booking_id?: string;
  customer_id: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  amount: number;
  return_url?: string;
  topup_target?: 'customer_wallet' | 'driver_wallet';
}

export const createPaymentOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const cashfreeAppId = process.env.CASHFREE_APP_ID;
    const cashfreeSecretKey = process.env.CASHFREE_SECRET_KEY;
    const cashfreeEnv = process.env.CASHFREE_ENV || 'sandbox';
    
    if (!cashfreeAppId || !cashfreeSecretKey) {
      console.error('Missing Cashfree credentials');
      res.status(500).json({ error: 'Payment gateway not configured' });
      return;
    }
    
    const cashfreeBaseUrl = cashfreeEnv === 'production'
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg';

    const body: PaymentOrderRequest = req.body;
    const {
      booking_id,
      customer_id,
      customer_name,
      customer_email,
      customer_phone,
      amount,
      return_url
    } = body;

    if (!customer_id || !amount || amount <= 0) {
      res.status(400).json({ error: 'Missing required fields: customer_id and amount' });
      return;
    }

    const isWalletTopUp = !booking_id;
    const isDriverWalletTopUp = isWalletTopUp && body.topup_target === 'driver_wallet';
    
    const orderId = isWalletTopUp 
      ? (isDriverWalletTopUp
          ? `DRIVERWALLET_${customer_id.substring(0, 8).replace(/-/g, '')}_${Date.now()}`
          : `WALLET_${customer_id.substring(0, 8).replace(/-/g, '')}_${Date.now()}`)
      : `BOOKING_${booking_id!.substring(0, 8).replace(/-/g, '')}_${Date.now()}`;

    let booking: any = null;
    let outstandingAdditional = 0;

    if (!isWalletTopUp) {
      const { data, error: bookingError } = await supabase
        .from('bookings')
        .select('id, total_fare, quoted_total_fare, payment_status, payment_method')
        .eq('id', booking_id)
        .eq('customer_id', customer_id)
        .single();

      if (bookingError || !data) {
        res.status(404).json({ error: 'Booking not found' });
        return;
      }
      booking = data;

      outstandingAdditional = booking.payment_method === 'wallet_plus_cash'
        ? 0
        : Math.max(
            Number(booking.total_fare ?? 0) - Number(booking.quoted_total_fare ?? booking.total_fare ?? 0),
            0
          );

      if (booking.payment_status === 'paid' && outstandingAdditional <= 0) {
        res.status(400).json({ error: 'Payment already completed for this booking' });
        return;
      }
    }

    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;

    const orderPayload = {
      order_id: orderId,
      order_amount: amount,
      order_currency: 'INR',
      customer_details: {
        customer_id: customer_id.replace(/-/g, '').substring(0, 10),
        customer_phone: (customer_phone || '9999999999').replace(/\D/g, '').slice(-10),
        customer_email: customer_email || 'user@cartr.app',
        customer_name: (customer_name || 'CartR User').substring(0, 100),
      },
      order_meta: {
        return_url: return_url || `cartr://payment-complete?order_id=${orderId}`,
        notify_url: `${backendUrl}/api/payment/webhook`,
      },
      order_tags: {
        type: isWalletTopUp ? (isDriverWalletTopUp ? 'driver_wallet' : 'wallet') : 'booking',
        cid: customer_id,
        bid: booking_id || 'none'
      },
      order_expiry_time: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 mins expiry
    };

    console.log('Creating Cashfree Order:', JSON.stringify(orderPayload, null, 2));

    const cashfreeResponse = await fetch(`${cashfreeBaseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': cashfreeAppId,
        'x-client-secret': cashfreeSecretKey,
        'x-api-version': '2023-08-01',
      },
      body: JSON.stringify(orderPayload),
    });

    const responseText = await cashfreeResponse.text();

    if (!cashfreeResponse.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { message: responseText };
      }
      console.error('Cashfree error:', errorData);
      res.status(500).json({ error: 'Failed to create payment order', details: errorData });
      return;
    }

    const cashfreeData = JSON.parse(responseText);
    
    if (isWalletTopUp) {
      try {
        await supabase
          .from('wallet_transactions')
          .insert({
            user_id: customer_id,
            amount: amount,
            type: 'credit',
            status: 'pending',
            payment_order_id: orderId,
            description: isDriverWalletTopUp ? 'Driver wallet top-up' : 'Wallet top-up',
          });
      } catch (err) {
        console.log('Could not store wallet transaction:', err);
      }
    } else if (booking) {
      await supabase
        .from('bookings')
        .update({
          payment_id: orderId,
          payment_method: booking.payment_status === 'paid' && outstandingAdditional > 0
            ? booking.payment_method
            : 'online',
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking_id);
    }

    const checkoutPageUrl = `${backendUrl}/api/payment/checkout-page`;
    const webCheckoutUrl = `${checkoutPageUrl}?session_id=${cashfreeData.payment_session_id}&env=${cashfreeEnv}`;

    res.status(200).json({
      payment_session_id: cashfreeData.payment_session_id,
      order_id: cashfreeData.order_id,
      order_status: cashfreeData.order_status,
      is_wallet_topup: isWalletTopUp,
      environment: cashfreeEnv,
      checkout_url: webCheckoutUrl
    });

  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({ error: 'Internal server error', message: String(error) });
  }
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\\/g, '\\\\');
}

export const checkoutPage = (req: Request, res: Response): void => {
  const paymentSessionId = escapeHtml((req.query.session_id as string) || (req.query.session as string) || '');
  const orderId = escapeHtml((req.query.order_id as string) || (req.query.order as string) || '');
  const env = escapeHtml((req.query.env as string) || 'sandbox');
  const returnUrl = escapeHtml((req.query.return_url as string) || (req.query.return as string) || 'cartr://payment-callback');

  const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CartR Payment</title>
    <script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            text-align: center;
            max-width: 420px;
            width: 92%;
        }
        .logo { font-size: 48px; margin-bottom: 10px; }
        h1 { color: #1a1a2e; margin: 0 0 8px 0; font-size: 24px; }
        p { color: #666; margin: 0 0 30px 0; font-size: 14px; }
        .loader {
            border: 4px solid #f0f0f0;
            border-top: 4px solid #F5B800;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            animation: spin 0.8s linear infinite;
            margin: 20px auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .message {
            padding: 16px 20px;
            border-radius: 12px;
            margin-top: 20px;
            font-size: 14px;
            display: none;
        }
        .error { color: #c0392b; background: #fdeaea; border: 1px solid #f5c6cb; }
        .success { color: #27ae60; background: #d4edda; border: 1px solid #c3e6cb; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🚗</div>
        <h1>CartR Payment</h1>
        <p id="status">Initializing secure payment...</p>
        <div class="loader" id="loader"></div>
        <div class="message error" id="error"></div>
        <div class="message success" id="success"></div>
    </div>
    <script>
        var paymentSessionId = "${paymentSessionId}";
        var orderId = "${orderId}";
        var env = "${env}";
        var returnUrl = decodeURIComponent("${encodeURIComponent(returnUrl)}");

        function postToRN(type, data) {
            try {
                if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, data: data || {} }));
                }
            } catch (e) {}
        }

        function showError(msg) {
            document.getElementById('loader').style.display = 'none';
            document.getElementById('status').textContent = 'Payment Failed';
            document.getElementById('error').style.display = 'block';
            document.getElementById('error').textContent = msg;
        }

        function showSuccess(msg) {
            document.getElementById('loader').style.display = 'none';
            document.getElementById('status').textContent = 'Payment Successful!';
            document.getElementById('success').style.display = 'block';
            document.getElementById('success').textContent = msg;
        }

        if (!paymentSessionId) {
            showError('Missing payment session. Please go back and try again.');
            postToRN('CHECKOUT_ERROR', { error: 'Missing payment session', orderId: orderId });
        } else {
            document.getElementById('status').textContent = 'Opening payment gateway...';

            try {
                var cashfree = Cashfree({ mode: env === 'production' ? 'production' : 'sandbox' });
                postToRN('SDK_INITIALIZED');
                postToRN('CHECKOUT_STARTING', { orderId: orderId });

                cashfree.checkout({
                    paymentSessionId: paymentSessionId,
                    redirectTarget: '_self'
                }).then(function(result) {
                    console.log('Checkout result:', result);
                    if (result.error) {
                        showError(result.error.message || 'Payment could not be completed');
                        postToRN('PAYMENT_ERROR', { error: result.error.message || 'Payment could not be completed', orderId: orderId });
                    } else if (result.paymentDetails) {
                        showSuccess('Payment completed! Redirecting...');
                        postToRN('PAYMENT_COMPLETED', { orderId: orderId, paymentDetails: result.paymentDetails });
                        setTimeout(function() {
                            window.location.href = returnUrl + '?order_id=' + orderId + '&status=success';
                        }, 1500);
                    }
                }).catch(function(err) {
                    console.error('Checkout error:', err);
                    showError(err.message || 'Something went wrong. Please try again.');
                    postToRN('CHECKOUT_ERROR', { error: err.message || 'Something went wrong. Please try again.', orderId: orderId });
                });
            } catch (e) {
                console.error('Init error:', e);
                showError('Failed to initialize payment. Please try again.');
                postToRN('CHECKOUT_ERROR', { error: 'Failed to initialize payment. Please try again.', orderId: orderId });
            }
        }
    </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
};

interface VerifyPaymentRequest {
  order_id: string;
}

export const verifyPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const cashfreeAppId = process.env.CASHFREE_APP_ID;
    const cashfreeSecretKey = process.env.CASHFREE_SECRET_KEY;
    const cashfreeEnv = process.env.CASHFREE_ENV || 'sandbox';
    
    if (!cashfreeAppId || !cashfreeSecretKey) {
      res.status(500).json({ error: 'Missing Cashfree credentials' });
      return;
    }

    const cashfreeBaseUrl = cashfreeEnv === 'production'
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg';

    const body: VerifyPaymentRequest = req.body;
    const { order_id } = body;

    if (!order_id) {
      res.status(400).json({ error: 'Missing order_id' });
      return;
    }

    console.log('Verifying payment order:', order_id);

    const cashfreeResponse = await fetch(`${cashfreeBaseUrl}/orders/${order_id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': cashfreeAppId,
        'x-client-secret': cashfreeSecretKey,
        'x-api-version': '2025-01-01',
      },
    });

    const responseText = await cashfreeResponse.text();
    if (!cashfreeResponse.ok) {
        console.error('Cashfree verify error:', responseText);
        res.status(500).json({ error: 'Failed to verify payment', details: JSON.parse(responseText) });
        return;
    }

    const orderData = JSON.parse(responseText);

    const paymentsResponse = await fetch(`${cashfreeBaseUrl}/orders/${order_id}/payments`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': cashfreeAppId,
        'x-client-secret': cashfreeSecretKey,
        'x-api-version': '2023-08-01',
      },
    });
    
    let paymentDetails = null;
    let status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' = 'PENDING';

    if (paymentsResponse.ok) {
        const paymentsData = await paymentsResponse.json();
        
        const successTxns = paymentsData.filter((t: any) => t.payment_status === "SUCCESS");
        const pendingTxns = paymentsData.filter((t: any) => t.payment_status === "PENDING");

        if (successTxns.length > 0) {
            status = 'PAID';
            paymentDetails = successTxns[0];
        } else if (pendingTxns.length > 0) {
            status = 'PENDING';
        } else if (paymentsData.length === 0) {
            // No payment attempt has been made yet (customer hasn't opened checkout,
            // or is mid-payment) - the order is still awaiting payment, not failed.
            status = (orderData.order_status === 'EXPIRED' || orderData.order_status === 'TERMINATED')
              ? 'FAILED'
              : 'PENDING';
        } else {
            status = 'FAILED';
        }
    } else {
        if (orderData.order_status === 'PAID') {
            status = 'PAID';
        } else if (orderData.order_status === 'EXPIRED' || orderData.order_status === 'TERMINATED') {
            status = 'FAILED';
        }
    }

    const paymentAmount = orderData.order_amount;
    const orderTags = orderData.order_tags || {};

    const type = orderTags.type;
    const cid = orderTags.cid;
    const bid = orderTags.bid;

    let walletCredited = true;
    let creditErrorMessage: string | null = null;

    if (status === 'PAID') {
      if (type === 'wallet' && cid) {
        const { data: wasCredited, error: creditError } = await supabase.rpc('atomic_credit_wallet_idempotent', {
          p_user_id: cid,
          p_amount: paymentAmount,
          p_order_id: order_id
        });

        if (!creditError) {
            if (paymentDetails) {
                await supabase
                    .from('wallet_transactions')
                    .update({ 
                        description: `Wallet top-up via ${paymentDetails.payment_group || 'online'}` 
                    })
                    .eq('payment_order_id', order_id);
            }
        } else {
            console.error('Failed to credit wallet atomically:', creditError);
            walletCredited = false;
            creditErrorMessage = creditError.message;
        }
      } else if (type === 'driver_wallet' && cid) {
        const { data: wasCredited, error: creditError } = await supabase.rpc('atomic_credit_driver_wallet_topup_idempotent', {
          p_user_id: cid,
          p_amount: paymentAmount,
          p_order_id: order_id
        });

        if (creditError) {
          console.error('Failed to credit driver wallet atomically:', creditError);
          walletCredited = false;
          creditErrorMessage = creditError.message;
        } else if (!wasCredited) {
          const { data: txn } = await supabase
            .from('wallet_transactions')
            .select('status')
            .eq('payment_order_id', order_id)
            .maybeSingle();

          walletCredited = txn?.status === 'completed';
          if (!walletCredited) {
            creditErrorMessage = 'Driver wallet payment was captured but wallet credit did not complete.';
          }
        }
      } else if (type === 'booking' && bid && bid !== 'none') {
        await supabase.rpc('apply_booking_online_payment', {
          p_booking_id: bid,
          p_amount: paymentAmount,
          p_payment_order_id: order_id,
        });
      }
    } else if (status === 'FAILED') {
       if (type === 'wallet' || type === 'driver_wallet') {
          await supabase
            .from('wallet_transactions')
            .update({ status: 'failed' })
            .eq('payment_order_id', order_id);
       } else if (type === 'booking' && bid && bid !== 'none') {
          const { data: booking } = await supabase
            .from('bookings')
            .select('payment_status')
            .eq('id', bid)
            .maybeSingle();

          if (booking?.payment_status !== 'paid') {
            await supabase
              .from('bookings')
              .update({
                payment_status: 'failed',
                updated_at: new Date().toISOString()
              })
              .eq('id', bid);
          }
       }
    }

    res.status(200).json({
      status,
      order_status: orderData.order_status,
      amount: orderData.order_amount,
      order_id: order_id,
      wallet_credited: walletCredited,
      credit_error: creditErrorMessage,
    });

  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ error: 'Internal server error', message: String(error) });
  }
};

import crypto from 'crypto';

interface CashfreeWebhookPayload {
  data: {
    order: {
      order_id: string;
      order_amount: number;
      order_currency: string;
      order_status: string;
    };
    payment: {
      cf_payment_id: number;
      payment_status: string;
      payment_amount: number;
      payment_currency: string;
      payment_message: string;
      payment_time: string;
      payment_method: any;
    };
    customer_details: {
      customer_id: string;
      customer_name: string;
      customer_email: string;
      customer_phone: string;
    };
  };
  event_time: string;
  type: string;
}

function verifySignature(payload: string, signature: string, timestamp: string, secretKey: string): boolean {
  try {
    const signedPayload = timestamp + payload;
    const expectedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(signedPayload)
      .digest('base64');
    return signature === expectedSignature;
  } catch {
    return false;
  }
}

export const paymentWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const cashfreeSecretKey = process.env.CASHFREE_SECRET_KEY!;

    const rawPayload = (req as any).rawBody || JSON.stringify(req.body);
    const webhookSignature = req.headers['x-webhook-signature'] as string || '';
    const webhookTimestamp = req.headers['x-webhook-timestamp'] as string || '';

    let payload: Partial<CashfreeWebhookPayload> = req.body;

    if (
      payload.type === 'WEBHOOK_TEST' || 
      payload.type === 'WEBHOOK_VERIFICATION' || 
      rawPayload.includes('WEBHOOK_TEST')
    ) {
      console.log('Received Cashfree dashboard test ping - automatically acknowledging');
      res.status(200).json({ status: 'OK' });
      return;
    }

    if (webhookSignature && webhookTimestamp) {
      const isValid = verifySignature(rawPayload, webhookSignature, webhookTimestamp, cashfreeSecretKey);
      if (!isValid) {
        console.error('Invalid webhook signature - rejecting request');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
    } else {
      console.log('Webhook received without signature headers. Unconditionally accepting as Dashboard Test Ping.');
      res.status(200).json({ status: 'OK', message: 'Test ping acknowledged' });
      return;
    }

    const typedPayload = payload as CashfreeWebhookPayload;

    if (typedPayload.type === 'PAYMENT_SUCCESS' || typedPayload.data?.payment?.payment_status === 'SUCCESS') {
      const orderId = typedPayload.data.order.order_id;
      
      if (orderId.startsWith('WALLET_')) {
        console.log('Wallet top-up payment confirmed via webhook:', orderId);
        
        const { data: txn, error: txnError } = await supabase
          .from('wallet_transactions')
          .select('id, user_id, status')
          .eq('payment_order_id', orderId)
          .single();

        if (txn) {
          const { data: wasCredited, error: creditError } = await supabase.rpc('atomic_credit_wallet_idempotent', {
            p_user_id: txn.user_id,
            p_amount: typedPayload.data.payment.payment_amount,
            p_order_id: orderId
          });

          if (creditError) {
             console.error('Failed to credit wallet from webhook:', creditError);
          } else if (wasCredited) {
             console.log('Successfully credited wallet for top-up via webhook:', orderId);
          } else {
             console.log('Wallet already credited for top-up via webhook:', orderId);
          }
        } else {
          console.error('Wallet transaction not found for top-up:', orderId);
        }

        res.status(200).json({ success: true, type: 'wallet_topup' });
        return;
      }

      const { data: booking, error: findError } = await supabase
        .from('bookings')
        .select('id, customer_id, driver_id, total_fare, payment_status, status, cashfree_order_id')
        .or(`payment_id.eq.${orderId},cashfree_order_id.eq.${orderId}`)
        .single();

      if (findError || !booking) {
        console.error('Booking not found for order:', orderId);
        res.status(404).json({ error: 'Booking not found' });
        return;
      }

      if (booking.payment_status === 'paid') {
        console.log('Booking already paid, skipping:', booking.id);
        res.status(200).json({ success: true, message: 'Already processed' });
        return;
      }

      const newStatus = booking.status === 'payment_pending' ? 'payment_confirmed' : booking.status;
      
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          payment_status: 'paid',
          payment_method: 'online',
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id);

      if (updateError) {
        console.error('Failed to update booking:', updateError);
        res.status(500).json({ error: 'Failed to update booking' });
        return;
      }

      console.log(`Payment confirmed for booking ${booking.id}, status: ${booking.status} -> ${newStatus}`);

      if (booking.status === 'payment_pending' && newStatus === 'payment_confirmed') {
        console.log('Auto-triggering driver assignment for booking:', booking.id);
        try {
          const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;
          const assignResponse = await fetch(`${backendUrl}/api/driver/assign`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ booking_id: booking.id }),
          });

          if (assignResponse.ok) {
            const assignResult = await assignResponse.json();
            console.log('Driver assignment result:', assignResult);
          } else {
            console.error('Driver assignment failed:', await assignResponse.text());
          }
        } catch (assignError) {
          console.error('Error triggering driver assignment:', assignError);
        }
      }

      if (booking.driver_id) {
        const { data: driver } = await supabase
          .from('drivers')
          .select('user_id')
          .eq('id', booking.driver_id)
          .single();

        if (driver) {
          await supabase.from('notifications').insert({
            user_id: driver.user_id,
            title: 'Payment Received! 💰',
            body: `Payment of ₹${typedPayload.data.payment.payment_amount} has been received.`,
            data: { booking_id: booking.id, type: 'payment_received' },
          });
        }
      }
 
      if (booking.customer_id) {
        await supabase.from('notifications').insert({
          user_id: booking.customer_id,
          title: 'Payment Successful ✅',
          body: `Your payment of ₹${typedPayload.data.payment.payment_amount} has been confirmed.`,
          data: { booking_id: booking.id, type: 'payment_success' },
        });
      }

      console.log('Payment processed successfully for booking:', booking.id);
    }

    if (typedPayload.type === 'PAYMENT_FAILED' || typedPayload.data?.payment?.payment_status === 'FAILED') {
      const orderId = typedPayload.data?.order?.order_id;
      if (!orderId) {
         res.status(200).json({ status: 'OK' });
         return;
      }
      
      console.log('Payment failed for order:', orderId, typedPayload.data?.payment?.payment_message);
      
      const { data: booking } = await supabase
        .from('bookings')
        .select('id, customer_id, payment_status')
        .or(`payment_id.eq.${orderId},cashfree_order_id.eq.${orderId}`)
        .single();

      if (booking) {
        if (booking.payment_status === 'paid') {
          console.log('Booking already paid, skipping failure update:', booking.id);
        } else {
          await supabase
            .from('bookings')
            .update({
              payment_status: 'failed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', booking.id);

          await supabase.from('notifications').insert({
            user_id: booking.customer_id,
            title: 'Payment Failed',
            body: 'Your payment could not be processed. Please try again.',
            data: { booking_id: booking.id, type: 'payment_failed' },
          });
        }
      }
    }

    res.status(200).json({ success: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createUpiQr = async (req: Request, res: Response): Promise<void> => {
  try {
    const cashfreeAppId = process.env.CASHFREE_APP_ID;
    const cashfreeSecretKey = process.env.CASHFREE_SECRET_KEY;
    const cashfreeEnv = process.env.CASHFREE_ENV || 'sandbox';

    if (!cashfreeAppId || !cashfreeSecretKey) {
      res.status(500).json({ error: 'Payment gateway not configured' });
      return;
    }

    const cashfreeBaseUrl = cashfreeEnv === 'production'
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg';

    const { booking_id } = req.body;

    if (!booking_id) {
      res.status(400).json({ error: 'booking_id is required' });
      return;
    }

    const extractQrValue = (payload: any): string | null => {
      if (!payload || typeof payload !== 'object') return null;

      const candidates = [
        payload?.data?.payload,
        payload?.data?.qr_code,
        payload?.data?.qrCode,
        payload?.data?.qrCodeUrl,
        payload?.data?.intent_url,
        payload?.data?.intentUrl,
        payload?.data?.url,
        payload?.qr_code,
        payload?.qrCode,
        payload?.qrCodeUrl,
        payload?.payload,
        payload?.url,
      ];

      for (const value of candidates) {
        if (typeof value === 'string' && value.trim()) {
          return value.trim();
        }
      }

      return null;
    };

    const createQrTransaction = async (paymentSessionId: string, channel: 'podQrCode' | 'qrcode') => {
      const response = await fetch(`${cashfreeBaseUrl}/orders/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': cashfreeAppId,
          'x-client-secret': cashfreeSecretKey,
          'x-api-version': '2025-01-01',
        },
        body: JSON.stringify({
          payment_session_id: paymentSessionId,
          payment_method: {
            upi: {
              channel,
            },
          },
        }),
      });

      const text = await response.text();
      let body: any = null;
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text };
      }

      return { ok: response.ok, status: response.status, body };
    };

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, total_fare, driver_payout, payment_status, payment_id, payment_session_id, customer_id, driver_id, booking_number, wallet_amount_used')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    if (booking.payment_status === 'paid') {
      res.status(400).json({ error: 'Payment already completed for this booking' });
      return;
    }

    const totalFare = booking.total_fare;
    const walletUsed = booking.wallet_amount_used || 0;
    const amountToCollect = booking.payment_status === 'partial_paid'
      ? totalFare - walletUsed
      : totalFare;

    if (amountToCollect <= 0) {
      res.status(400).json({ error: 'No amount to collect' });
      return;
    }

    let orderId = booking.payment_id;
    let paymentSessionId = booking.payment_session_id;

    if (orderId) {
      try {
        const existingOrderRes = await fetch(`${cashfreeBaseUrl}/orders/${orderId}`, {
          headers: {
            'x-client-id': cashfreeAppId,
            'x-client-secret': cashfreeSecretKey,
            'x-api-version': '2025-01-01',
          },
        });

        if (existingOrderRes.ok) {
          const existingOrder = await existingOrderRes.json();
          if (existingOrder.order_status === 'ACTIVE' && existingOrder.payment_session_id) {
            paymentSessionId = existingOrder.payment_session_id;
            console.log('Reusing active order for QR:', orderId);
          } else {
            orderId = null;
            paymentSessionId = null;
          }
        } else {
          orderId = null;
          paymentSessionId = null;
        }
      } catch (e) {
        console.log('Could not fetch existing order, creating new one:', e);
        orderId = null;
        paymentSessionId = null;
      }
    }

    const { data: customer } = await supabase
      .from('users')
      .select('id, name, email, phone')
      .eq('id', booking.customer_id)
      .single();

    if (!orderId || !paymentSessionId) {
      orderId = `UPIDR_${booking_id.substring(0, 8).replace(/-/g, '')}_${Date.now()}`;

      const orderPayload = {
        order_id: orderId,
        order_amount: amountToCollect,
        order_currency: 'INR',
        customer_details: {
          customer_id: (booking.customer_id || 'guest').replace(/-/g, '').substring(0, 10),
          customer_phone: (customer?.phone || '9999999999').replace(/\D/g, '').slice(-10),
          customer_email: customer?.email || 'customer@cartr.app',
          customer_name: (customer?.name || 'Customer').substring(0, 100),
        },
        order_meta: {
          return_url: `cartr://payment-complete?order_id=${orderId}`,
          notify_url: `${process.env.BACKEND_URL}/api/payment/webhook`,
        },
        order_tags: {
          type: 'booking',
          cid: booking.customer_id,
          bid: booking_id,
          source: 'driver_upi_qr',
        },
        order_expiry_time: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      };

      console.log('Creating UPI QR order:', orderId, 'Amount:', amountToCollect);

      const cashfreeResponse = await fetch(`${cashfreeBaseUrl}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': cashfreeAppId,
          'x-client-secret': cashfreeSecretKey,
          'x-api-version': '2025-01-01',
        },
        body: JSON.stringify(orderPayload),
      });

      const responseText = await cashfreeResponse.text();

      if (!cashfreeResponse.ok) {
        let errorData;
        try { errorData = JSON.parse(responseText); } catch { errorData = { message: responseText }; }
        console.error('Cashfree order creation failed:', errorData);
        res.status(500).json({ error: 'Failed to create UPI QR order', details: errorData });
        return;
      }

      const cashfreeData = JSON.parse(responseText);
      paymentSessionId = cashfreeData.payment_session_id;

      if (!paymentSessionId) {
        res.status(500).json({ error: 'Cashfree did not return a payment session for the QR order' });
        return;
      }

      await supabase
        .from('bookings')
        .update({
          payment_id: orderId,
          payment_session_id: paymentSessionId,
          payment_method: 'online',
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking_id);
    }

    if (!paymentSessionId) {
      res.status(500).json({ error: 'Missing payment session for UPI QR generation' });
      return;
    }

    let qrTransaction = await createQrTransaction(paymentSessionId, 'podQrCode');
    if (!qrTransaction.ok) {
      console.log('podQrCode unavailable, falling back to qrcode', qrTransaction.body);
      qrTransaction = await createQrTransaction(paymentSessionId, 'qrcode');
    }

    if (!qrTransaction.ok) {
      console.error('Cashfree QR transaction creation failed:', qrTransaction.body);
      res.status(500).json({ error: 'Failed to create Cashfree UPI QR', details: qrTransaction.body });
      return;
    }

    const qrPayload = extractQrValue(qrTransaction.body);
    const cashfreeCheckoutUrl = `${cashfreeEnv === 'production' ? 'https://api.cashfree.com' : 'https://sandbox.cashfree.com'}/pg/orders/sessions/pay?payment_session_id=${paymentSessionId}`;

    console.log('UPI QR transaction created:', orderId, 'Channel:', qrTransaction.body?.channel);

    res.status(200).json({
      payment_session_id: paymentSessionId,
      order_id: orderId,
      amount: amountToCollect,
      environment: cashfreeEnv,
      qr_payload: qrPayload,
      qr_action: qrTransaction.body?.action || null,
      qr_channel: qrTransaction.body?.channel || null,
      qr_data: qrTransaction.body?.data || null,
      checkout_url: cashfreeCheckoutUrl,
    });

  } catch (error) {
    console.error('Error creating UPI QR:', error);
    res.status(500).json({ error: 'Internal server error', message: String(error) });
  }
};
