// Verify Payment Edge Function
// Verifies the status of a Cashfree payment link

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VerifyPaymentRequest {
  order_id: string // This is the link_id from create-payment-order
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

    const body: VerifyPaymentRequest = await req.json()
    const { order_id } = body

    if (!order_id) {
      return new Response(
        JSON.stringify({ error: 'Missing order_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Verifying payment for link_id:', order_id)

    // Get payment link status from Cashfree
    const cashfreeResponse = await fetch(`${cashfreeBaseUrl}/links/${order_id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': cashfreeAppId,
        'x-client-secret': cashfreeSecretKey,
        'x-api-version': '2023-08-01',
      },
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
        JSON.stringify({ error: 'Failed to verify payment', details: errorData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const linkData = JSON.parse(responseText)
    
    // Map Cashfree link status to our status
    // Cashfree link statuses: ACTIVE, PARTIALLY_PAID, PAID, EXPIRED, CANCELLED
    let status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' = 'PENDING'
    
    switch (linkData.link_status) {
      case 'PAID':
        status = 'PAID'
        break
      case 'PARTIALLY_PAID':
        status = 'PENDING' // Consider partial as pending
        break
      case 'EXPIRED':
      case 'CANCELLED':
        status = 'CANCELLED'
        break
      case 'ACTIVE':
      default:
        status = 'PENDING'
        break
    }

    // If payment is successful and it's a wallet top-up, update the wallet
    if (status === 'PAID' && linkData.link_notes) {
      const customerId = linkData.link_notes.cid
      const paymentType = linkData.link_notes.type
      const amount = linkData.link_amount

      if (paymentType === 'wallet' && customerId && amount) {
        // Update wallet balance
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('balance')
          .eq('id', customerId)
          .single()

        if (!userError && userData) {
          const newBalance = (userData.balance || 0) + amount
          await supabase
            .from('users')
            .update({ balance: newBalance })
            .eq('id', customerId)

          // Update wallet transaction status
          await supabase
            .from('wallet_transactions')
            .update({ status: 'completed' })
            .eq('payment_order_id', order_id)
        }
      }

      if (paymentType === 'booking' && linkData.link_notes.bid && linkData.link_notes.bid !== 'none') {
        // Update booking payment status
        await supabase
          .from('bookings')
          .update({ 
            payment_status: 'paid',
            updated_at: new Date().toISOString()
          })
          .eq('id', linkData.link_notes.bid)
      }
    }

    return new Response(
      JSON.stringify({
        status,
        link_status: linkData.link_status,
        amount: linkData.link_amount,
        order_id: order_id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error verifying payment:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
