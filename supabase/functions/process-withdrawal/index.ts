// Cashfree Payouts — Process Withdrawal Edge Function
// Initiates a bank transfer via Cashfree Payouts API for an approved withdrawal
// Called by admin after approving a withdrawal request

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
    const payoutsAppId = Deno.env.get('CASHFREE_PG_APP_ID') || Deno.env.get('CASHFREE_APP_ID')
    const payoutsSecretKey = Deno.env.get('CASHFREE_PG_SECRET_KEY') || Deno.env.get('CASHFREE_SECRET_KEY')
    const payoutsEnv = Deno.env.get('CASHFREE_PG_ENV') || Deno.env.get('CASHFREE_ENV') || 'sandbox'

    const supabase = createClient(supabaseUrl, supabaseKey)
    const { withdrawal_id } = await req.json()

    if (!withdrawal_id) {
      return new Response(
        JSON.stringify({ error: 'withdrawal_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch withdrawal + driver details
    const { data: withdrawal, error: wError } = await supabase
      .from('withdrawals')
      .select('*, driver:drivers(id, beneficiary_id, beneficiary_status, bank_details)')
      .eq('id', withdrawal_id)
      .single()

    if (wError || !withdrawal) {
      return new Response(
        JSON.stringify({ error: 'Withdrawal not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (withdrawal.status !== 'approved') {
      return new Response(
        JSON.stringify({ error: `Withdrawal must be approved first (current: ${withdrawal.status})` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // If Cashfree Payouts not configured, mark for manual processing
    if (!payoutsAppId || !payoutsSecretKey) {
      console.log('Cashfree Payouts not configured — marking for manual processing')
      await supabase
        .from('withdrawals')
        .update({
          payout_status: 'MANUAL',
          admin_notes: (withdrawal.admin_notes || '') + ' | Auto-payout not available. Process manually.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', withdrawal_id)

      return new Response(
        JSON.stringify({
          success: true,
          mode: 'manual',
          message: 'Cashfree Payouts not configured. Marked for manual bank transfer.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const driver = withdrawal.driver
    if (!driver?.beneficiary_id || driver.beneficiary_status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Driver is not registered as Cashfree beneficiary. Register first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initiate payout via Cashfree
    const baseUrl = payoutsEnv === 'production'
      ? 'https://payout-api.cashfree.com'
      : 'https://payout-gamma.cashfree.com'

    const transferId = `CARTR_WD_${withdrawal_id.substring(0, 8)}_${Date.now()}`

    const payoutPayload = {
      bene_id: driver.beneficiary_id,
      amount: String(withdrawal.amount),
      transfer_id: transferId,
      transfer_mode: 'banktransfer',
      remarks: `CartR driver payout - Withdrawal #${withdrawal_id.substring(0, 8)}`,
    }

    console.log('Initiating payout:', transferId, 'Amount:', withdrawal.amount)

    const cfResponse = await fetch(`${baseUrl}/payout/v1/requestTransfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': payoutsAppId,
        'X-Client-Secret': payoutsSecretKey,
      },
      body: JSON.stringify(payoutPayload),
    })

    const cfResult = await cfResponse.json()
    console.log('Cashfree payout response:', cfResult)

    if (cfResponse.ok || cfResult?.subCode === '200') {
      // Transfer initiated successfully
      await supabase
        .from('withdrawals')
        .update({
          payout_reference: transferId,
          payout_status: 'INITIATED',
          status: 'completed', // Mark as completed so it no longer blocks the driver
          updated_at: new Date().toISOString(),
        })
        .eq('id', withdrawal_id)
        
      // Also update the transaction status
      await supabase
        .from('driver_wallet_transactions')
        .update({ status: 'completed' })
        .eq('withdrawal_id', withdrawal_id)
        .eq('type', 'withdrawal')

      return new Response(
        JSON.stringify({
          success: true,
          mode: 'automatic',
          transfer_id: transferId,
          message: 'Bank transfer initiated via Cashfree',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      // Payout failed
      await supabase
        .from('withdrawals')
        .update({
          payout_reference: transferId,
          payout_status: 'FAILED',
          payout_error: JSON.stringify(cfResult),
          updated_at: new Date().toISOString(),
        })
        .eq('id', withdrawal_id)

      return new Response(
        JSON.stringify({
          error: 'Cashfree payout failed',
          details: cfResult,
          transfer_id: transferId,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('Process withdrawal error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal error', message: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
