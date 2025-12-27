// Payment Webhook Edge Function
// Handles Cashfree payment webhooks to update booking status

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'https://deno.land/std@0.168.0/crypto/mod.ts'

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

    // Verify signature in production
    if (Deno.env.get('CASHFREE_ENV') === 'production') {
      const isValid = await verifySignature(rawPayload, webhookSignature, webhookTimestamp, cashfreeSecretKey)
      if (!isValid) {
        console.error('Invalid webhook signature')
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    const payload: CashfreeWebhookPayload = JSON.parse(rawPayload)
    
    console.log('Received webhook:', payload.type, payload.data.order.order_id)

    // Handle payment success
    if (payload.type === 'PAYMENT_SUCCESS' || payload.data.payment.payment_status === 'SUCCESS') {
      const orderId = payload.data.order.order_id
      
      // Find booking by payment_id
      const { data: booking, error: findError } = await supabase
        .from('bookings')
        .select('id, customer_id, driver_id')
        .eq('payment_id', orderId)
        .single()

      if (findError || !booking) {
        console.error('Booking not found for order:', orderId)
        return new Response(
          JSON.stringify({ error: 'Booking not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Update booking payment status
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          payment_status: 'paid',
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
        // Get driver's user_id
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

      console.log('Payment processed successfully for booking:', booking.id)
    }

    // Handle payment failure
    if (payload.type === 'PAYMENT_FAILED' || payload.data.payment.payment_status === 'FAILED') {
      const orderId = payload.data.order.order_id
      
      console.log('Payment failed for order:', orderId, payload.data.payment.payment_message)
      
      // Optionally update booking or create notification
      const { data: booking } = await supabase
        .from('bookings')
        .select('id, customer_id')
        .eq('payment_id', orderId)
        .single()

      if (booking) {
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
