// Create Payment Order Edge Function
// Creates a Cashfree payment link for wallet top-up or booking payments

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PaymentOrderRequest {
  booking_id?: string
  customer_id: string
  customer_name?: string
  customer_email?: string
  customer_phone?: string
  amount: number
  return_url?: string
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
    
    if (!cashfreeAppId || !cashfreeSecretKey) {
      console.error('Missing Cashfree credentials')
      return new Response(
        JSON.stringify({ error: 'Payment gateway not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const cashfreeEnv = Deno.env.get('CASHFREE_ENV') || 'sandbox'
    const cashfreeBaseUrl = cashfreeEnv === 'production'
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg'

    const supabase = createClient(supabaseUrl, supabaseKey)

    const body: PaymentOrderRequest = await req.json()
    const {
      booking_id,
      customer_id,
      customer_name,
      customer_email,
      customer_phone,
      amount,
      return_url
    } = body

    if (!customer_id || !amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: customer_id and amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const isWalletTopUp = !booking_id
    const linkId = isWalletTopUp 
      ? `CARTR_WALLET_${customer_id.substring(0, 8)}_${Date.now()}`
      : `CARTR_BOOKING_${booking_id!.substring(0, 8)}_${Date.now()}`

    // For booking payments, verify the booking exists
    if (!isWalletTopUp) {
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('id, total_fare, payment_status')
        .eq('id', booking_id)
        .eq('customer_id', customer_id)
        .single()

      if (bookingError || !booking) {
        return new Response(
          JSON.stringify({ error: 'Booking not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (booking.payment_status === 'paid') {
        return new Response(
          JSON.stringify({ error: 'Payment already completed' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Create Payment Link using Cashfree Payment Links API
    const paymentLinkPayload = {
      link_id: linkId,
      link_amount: amount,
      link_currency: 'INR',
      link_purpose: isWalletTopUp ? 'CartR Wallet Top-up' : 'CartR Ride Payment',
      customer_details: {
        customer_phone: (customer_phone || '9999999999').replace(/\D/g, '').slice(-10),
        customer_email: customer_email || 'user@cartr.app',
        customer_name: (customer_name || 'CartR User').substring(0, 100),
      },
      link_notify: {
        send_sms: false,
        send_email: false,
      },
      link_meta: {
        return_url: return_url || 'cartr://payment-complete',
        notify_url: `${supabaseUrl}/functions/v1/payment-webhook`,
      },
      link_notes: {
        cid: customer_id.replace(/-/g, '').substring(0, 50),
        bid: (booking_id || 'none').replace(/-/g, '').substring(0, 50),
        type: isWalletTopUp ? 'wallet' : 'booking',
      },
      link_expiry_time: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }

    console.log('Creating Cashfree payment link:', JSON.stringify(paymentLinkPayload, null, 2))

    const cashfreeResponse = await fetch(`${cashfreeBaseUrl}/links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': cashfreeAppId,
        'x-client-secret': cashfreeSecretKey,
        'x-api-version': '2023-08-01',
      },
      body: JSON.stringify(paymentLinkPayload),
    })

    const responseText = await cashfreeResponse.text()
    console.log('Cashfree response status:', cashfreeResponse.status)
    console.log('Cashfree response:', responseText)

    if (!cashfreeResponse.ok) {
      let errorData
      try {
        errorData = JSON.parse(responseText)
      } catch {
        errorData = { message: responseText }
      }
      console.error('Cashfree error:', errorData)
      return new Response(
        JSON.stringify({ error: 'Failed to create payment link', details: errorData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const cashfreeData = JSON.parse(responseText)
    
    // The payment link URL is directly usable in any browser
    const paymentUrl = cashfreeData.link_url

    // Store transaction for tracking
    if (isWalletTopUp) {
      try {
        await supabase
          .from('wallet_transactions')
          .insert({
            user_id: customer_id,
            amount: amount,
            type: 'credit',
            status: 'pending',
            payment_order_id: linkId,
            description: 'Wallet top-up',
          })
      } catch (err) {
        console.log('Could not store wallet transaction:', err)
      }
    } else {
      await supabase
        .from('bookings')
        .update({
          payment_id: linkId,
          payment_method: 'online',
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking_id)
    }

    return new Response(
      JSON.stringify({
        link_id: cashfreeData.link_id,
        link_url: paymentUrl,
        checkout_url: paymentUrl,
        order_status: cashfreeData.link_status,
        is_wallet_topup: isWalletTopUp,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error creating payment:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
