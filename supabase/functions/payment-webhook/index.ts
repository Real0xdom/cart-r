// Payment Webhook Edge Function
// Handles Cashfree payment webhooks to update booking status

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature, x-webhook-timestamp',
}

interface CashfreeWebhookPayload {
  data: {
    order: {
      order_id: string
      order_amount: number
      order_currency: string
      order_status: string
    }
    payment: {
      cf_payment_id: number
      payment_status: string
      payment_amount: number
      payment_currency: string
      payment_message: string
      payment_time: string
      payment_method: {
        upi?: { upi_id: string }
        card?: { card_number: string }
        netbanking?: { netbanking_bank_name: string }
      }
    }
    customer_details: {
      customer_id: string
      customer_name: string
      customer_email: string
      customer_phone: string
    }
  }
  event_time: string
  type: string
}

// Verify Cashfree webhook signature
async function verifySignature(
  payload: string,
  signature: string,
  timestamp: string,
  secretKey: string
): Promise<boolean> {
  try {
    const signedPayload = timestamp + payload
    const expectedSignature = await computeHmacSha256(signedPayload, secretKey)
    return signature === expectedSignature
  } catch {
    return false
  }
}

async function computeHmacSha256(data: string, key: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(key)
  const dataBuffer = encoder.encode(data)
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer)
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const cashfreeSecretKey = Deno.env.get('CASHFREE_SECRET_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const rawPayload = await req.text()
    const webhookSignature = req.headers.get('x-webhook-signature') || ''
    const webhookTimestamp = req.headers.get('x-webhook-timestamp') || ''

    // 1. Check if this is just a Cashfree configuration test ping
    let payload: Partial<CashfreeWebhookPayload> = {}
    try {
      payload = JSON.parse(rawPayload)
    } catch (e) {
      console.log('Failed to parse webhook JSON:', e)
    }

    if (
      payload.type === 'WEBHOOK_TEST' || 
      payload.type === 'WEBHOOK_VERIFICATION' || 
      rawPayload.includes('WEBHOOK_TEST')
    ) {
      console.log('Received Cashfree dashboard test ping - automatically acknowledging')
      return new Response(JSON.stringify({ status: 'OK' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. FOR ALL OTHER EVENTS: Verify webhook signature strictly
    if (webhookSignature && webhookTimestamp) {
      const isValid = await verifySignature(rawPayload, webhookSignature, webhookTimestamp, cashfreeSecretKey)
      if (!isValid) {
        console.error('Invalid webhook signature')
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else {
      // Cashfree dashboard test pings often don't include signature headers at all,
      // and their payload can be completely empty or malformed.
      // We unconditionally return 200 OK to satisfy their URL verification, but we
      // RETURN EARLY so no actual payment processing logic is ever executed without a valid signature.
      console.log('Webhook received without signature headers. Unconditionally accepting as Dashboard Test Ping. Payload:', rawPayload)
      return new Response(
        JSON.stringify({ status: 'OK', message: 'Test ping acknowledged' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Re-parse payload after signature check, ensuring it's valid JSON for further processing
    // This is safe because we've already handled malformed/test payloads above.
    payload = JSON.parse(rawPayload) as CashfreeWebhookPayload;

    // Handle payment success
    if (payload.type === 'PAYMENT_SUCCESS' || payload.data.payment.payment_status === 'SUCCESS') {
      const orderId = payload.data.order.order_id
      
      // Check if this is a wallet top-up (order starts with WALLET_)
      if (orderId.startsWith('WALLET_')) {
        console.log('Wallet top-up payment confirmed via webhook:', orderId)
        
        // Find the wallet transaction to get the user ID
        const { data: txn, error: txnError } = await supabase
          .from('wallet_transactions')
          .select('id, user_id, status')
          .eq('payment_order_id', orderId)
          .single()

        if (txn) {
          // Use atomic RPC with built-in idempotency checks
          const { data: wasCredited, error: creditError } = await supabase.rpc('atomic_credit_wallet_idempotent', {
            p_user_id: txn.user_id,
            p_amount: payload.data.payment.payment_amount,
            p_order_id: orderId
          })

          if (creditError) {
             console.error('Failed to credit wallet from webhook:', creditError)
          } else if (wasCredited) {
             console.log('Successfully credited wallet for top-up via webhook:', orderId)
          } else {
             console.log('Wallet already credited for top-up via webhook:', orderId)
          }
        } else {
          console.error('Wallet transaction not found for top-up:', orderId)
        }

        // Wallet top-ups are handled, acknowledge
        return new Response(
          JSON.stringify({ success: true, type: 'wallet_topup' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Find booking by payment_id (handles both regular online payments and UPI QR payments)
      const { data: booking, error: findError } = await supabase
        .from('bookings')
        .select('id, customer_id, driver_id, total_fare, payment_status')
        .eq('payment_id', orderId)
        .single()

      if (findError || !booking) {
        console.error('Booking not found for order:', orderId)
        return new Response(
          JSON.stringify({ error: 'Booking not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Skip if already paid (idempotency)
      if (booking.payment_status === 'paid') {
        console.log('Booking already paid, skipping:', booking.id)
        return new Response(
          JSON.stringify({ success: true, message: 'Already processed' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Update booking payment status
      // NOTE: This UPDATE triggers on_booking_payment_received which auto-credits the driver wallet
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          payment_status: 'paid',
          payment_method: 'online', // UPI is an online payment method
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id)

      if (updateError) {
        console.error('Failed to update booking:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to update booking' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Notify driver about payment received
      if (booking.driver_id) {
        const { data: driver } = await supabase
          .from('drivers')
          .select('user_id')
          .eq('id', booking.driver_id)
          .single()

        if (driver) {
          await supabase.from('notifications').insert({
            user_id: driver.user_id,
            title: 'Payment Received! 💰',
            body: `Payment of ₹${payload.data.payment.payment_amount} has been received.`,
            data: { booking_id: booking.id, type: 'payment_received' },
          })
        }
      }

      // Notify customer about successful payment  
      if (booking.customer_id) {
        await supabase.from('notifications').insert({
          user_id: booking.customer_id,
          title: 'Payment Successful ✅',
          body: `Your payment of ₹${payload.data.payment.payment_amount} has been confirmed.`,
          data: { booking_id: booking.id, type: 'payment_success' },
        })
      }

      console.log('Payment processed successfully for booking:', booking.id)
    }

    // Handle payment failure
    if (payload.type === 'PAYMENT_FAILED' || payload.data?.payment?.payment_status === 'FAILED') {
      const orderId = payload.data?.order?.order_id
      if (!orderId) {
         return new Response(JSON.stringify({ status: 'OK' }), { status: 200, headers: corsHeaders })
      }
      
      console.log('Payment failed for order:', orderId, payload.data?.payment?.payment_message)
      
      // Optionally update booking or create notification
      const { data: booking } = await supabase
        .from('bookings')
        .select('id, customer_id')
        .eq('payment_id', orderId)
        .single()

      if (booking) {
        // Update booking payment status to 'failed' so UI reflects the failure
        // Guard: never overwrite a successful payment with 'failed'
        await supabase
          .from('bookings')
          .update({
            payment_status: 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', booking.id)
          .neq('payment_status', 'paid')

        await supabase.from('notifications').insert({
          user_id: booking.customer_id,
          title: 'Payment Failed',
          body: 'Your payment could not be processed. Please try again.',
          data: { booking_id: booking.id, type: 'payment_failed' },
        })
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Webhook processing error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
