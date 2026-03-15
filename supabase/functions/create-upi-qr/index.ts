// Create UPI QR Edge Function
// Called by the driver app to generate a dynamic Cashfree UPI QR for ride completion.
// It creates or reuses an order, then creates a UPI QR transaction on that order
// so scanning the QR launches the payer's UPI app with the amount prefilled.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const cashfreeAppId = Deno.env.get('CASHFREE_APP_ID')
    const cashfreeSecretKey = Deno.env.get('CASHFREE_SECRET_KEY')
    const cashfreeEnv = Deno.env.get('CASHFREE_ENV') || 'sandbox'

    if (!cashfreeAppId || !cashfreeSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Payment gateway not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const cashfreeBaseUrl = cashfreeEnv === 'production'
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg'

    const supabase = createClient(supabaseUrl, supabaseKey)

    const { booking_id } = await req.json()

    if (!booking_id) {
      return new Response(
        JSON.stringify({ error: 'booking_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const extractQrValue = (payload: any): string | null => {
      if (!payload || typeof payload !== 'object') return null

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
      ]

      for (const value of candidates) {
        if (typeof value === 'string' && value.trim()) {
          return value.trim()
        }
      }

      return null
    }

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
      })

      const text = await response.text()
      let body: any = null
      try {
        body = JSON.parse(text)
      } catch {
        body = { raw: text }
      }

      return { ok: response.ok, status: response.status, body }
    }

    // Fetch booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, total_fare, driver_payout, payment_status, payment_id, payment_session_id, customer_id, driver_id, booking_number, wallet_amount_used')
      .eq('id', booking_id)
      .single()

    if (bookingError || !booking) {
      return new Response(
        JSON.stringify({ error: 'Booking not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (booking.payment_status === 'paid') {
      return new Response(
        JSON.stringify({ error: 'Payment already completed for this booking' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calculate amount to collect (considering partial wallet payments)
    const totalFare = booking.total_fare
    const walletUsed = booking.wallet_amount_used || 0
    const amountToCollect = booking.payment_status === 'partial_paid'
      ? totalFare - walletUsed
      : totalFare

    if (amountToCollect <= 0) {
      return new Response(
        JSON.stringify({ error: 'No amount to collect' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let orderId = booking.payment_id
    let paymentSessionId = booking.payment_session_id

    // If an order already exists, try to reuse its payment session.
    if (orderId) {
      try {
        const existingOrderRes = await fetch(`${cashfreeBaseUrl}/orders/${orderId}`, {
          headers: {
            'x-client-id': cashfreeAppId,
            'x-client-secret': cashfreeSecretKey,
            'x-api-version': '2025-01-01',
          },
        })

        if (existingOrderRes.ok) {
          const existingOrder = await existingOrderRes.json()
          if (existingOrder.order_status === 'ACTIVE' && existingOrder.payment_session_id) {
            paymentSessionId = existingOrder.payment_session_id
            console.log('Reusing active order for QR:', orderId)
          } else {
            orderId = null
            paymentSessionId = null
          }
        } else {
          orderId = null
          paymentSessionId = null
        }
      } catch (e) {
        console.log('Could not fetch existing order, creating new one:', e)
        orderId = null
        paymentSessionId = null
      }
    }

    // Get customer info for the order
    const { data: customer } = await supabase
      .from('users')
      .select('id, name, email, phone')
      .eq('id', booking.customer_id)
      .single()

    if (!orderId || !paymentSessionId) {
      // Create Cashfree PG Order for UPI QR
      orderId = `UPIDR_${booking_id.substring(0, 8).replace(/-/g, '')}_${Date.now()}`

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
          notify_url: `${supabaseUrl}/functions/v1/payment-webhook`,
        },
        order_tags: {
          type: 'booking',
          cid: booking.customer_id,
          bid: booking_id,
          source: 'driver_upi_qr',
        },
        order_expiry_time: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      }

      console.log('Creating UPI QR order:', orderId, 'Amount:', amountToCollect)

      const cashfreeResponse = await fetch(`${cashfreeBaseUrl}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': cashfreeAppId,
          'x-client-secret': cashfreeSecretKey,
          'x-api-version': '2025-01-01',
        },
        body: JSON.stringify(orderPayload),
      })

      const responseText = await cashfreeResponse.text()

      if (!cashfreeResponse.ok) {
        let errorData
        try { errorData = JSON.parse(responseText) } catch { errorData = { message: responseText } }
        console.error('Cashfree order creation failed:', errorData)
        return new Response(
          JSON.stringify({ error: 'Failed to create UPI QR order', details: errorData }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const cashfreeData = JSON.parse(responseText)
      paymentSessionId = cashfreeData.payment_session_id

      if (!paymentSessionId) {
        return new Response(
          JSON.stringify({ error: 'Cashfree did not return a payment session for the QR order' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      await supabase
        .from('bookings')
        .update({
          payment_id: orderId,
          payment_session_id: paymentSessionId,
          payment_method: 'online',
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking_id)
    }

    // Ask Cashfree for a real UPI QR transaction. Prefer pay-on-delivery QR.
    if (!paymentSessionId) {
      return new Response(
        JSON.stringify({ error: 'Missing payment session for UPI QR generation' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let qrTransaction = await createQrTransaction(paymentSessionId, 'podQrCode')
    if (!qrTransaction.ok) {
      console.log('podQrCode unavailable, falling back to qrcode', qrTransaction.body)
      qrTransaction = await createQrTransaction(paymentSessionId, 'qrcode')
    }

    if (!qrTransaction.ok) {
      console.error('Cashfree QR transaction creation failed:', qrTransaction.body)
      return new Response(
        JSON.stringify({ error: 'Failed to create Cashfree UPI QR', details: qrTransaction.body }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const qrPayload = extractQrValue(qrTransaction.body)
    const cashfreeCheckoutUrl = `${cashfreeEnv === 'production' ? 'https://api.cashfree.com' : 'https://sandbox.cashfree.com'}/pg/orders/sessions/pay?payment_session_id=${paymentSessionId}`

    console.log('UPI QR transaction created:', orderId, 'Channel:', qrTransaction.body?.channel)

    return new Response(
      JSON.stringify({
        payment_session_id: paymentSessionId,
        order_id: orderId,
        amount: amountToCollect,
        environment: cashfreeEnv,
        qr_payload: qrPayload,
        qr_action: qrTransaction.body?.action || null,
        qr_channel: qrTransaction.body?.channel || null,
        qr_data: qrTransaction.body?.data || null,
        checkout_url: cashfreeCheckoutUrl,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error creating UPI QR:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
