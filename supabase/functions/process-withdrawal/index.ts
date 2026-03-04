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
    // Cashfree Payouts credentials - try multiple variable name formats
    const payoutsAppId = Deno.env.get('CASHFREE_PAYOUT_APP_ID') || Deno.env.get('CASHFREE_PG_APP_ID')
    const payoutsSecretKey = Deno.env.get('CASHFREE_PAYOUT_SECRET_KEY') || Deno.env.get('CASHFREE_PG_SECRET_KEY')
    const payoutsEnv = Deno.env.get('CASHFREE_ENV') || Deno.env.get('CASHFREE_PG_ENV') || Deno.env.get('CASHFREE_ENVIRONMENT') || 'sandbox'

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

    // Initiate payout via Cashfree Payouts V2 API
    // V2 API uses direct client-id/secret authentication (no /authorize needed)
    const baseUrl = payoutsEnv === 'production'
      ? 'https://api.cashfree.com'
      : 'https://sandbox.cashfree.com'

    const transferId = `CARTR_WD_${withdrawal_id.substring(0, 8)}_${Date.now()}`

    console.log('Initiating payout with V2 API:', transferId, 'Amount:', withdrawal.amount, 'BeneId:', driver.beneficiary_id)

    // Generate RSA signature for V2 API authentication
    const timestamp = Math.floor(Date.now() / 1000).toString()
    
    // Read the public key from the PEM file (for signature generation)
    const publicKeyPem = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzMg9C1Kcf1/RjfKq2O7S
fgaVvwxE76wq9mlYku7Gp4Z4iyrFRmnaEPqPW/+6MfPJn6Yj8GkTNsnrg1gK1C79
sOCb4wc3kAcHlTT5QIdgxQ04tCAYPPMBJ242dpBWlFxe/dVY700bZRTmtf1vwTLo
q8zOuE819Ei0DFdxao92GeaKznWQR8wRDk+LswKIjYKY3mXrJfh1jVZB0uFbed8p
Avbgiq+5HX5tihKUeD90j1t8dMHVq/oZtHL4Xcc1dNstFK1UWwFpef8taWlfIz8o
rz38ws0JnIHlljJYf5H5bwT1yhiMKiHfdFbnoZ+wv9oXRuvhi/FuBq3YXUDm8MLX
AQIDAQAB
-----END PUBLIC KEY-----`
    
    // Import the public key
    const pemContents = publicKeyPem
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\s/g, '')
    
    const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))
    
    const publicKey = await crypto.subtle.importKey(
      'spki',
      binaryDer,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-1',
      },
      false,
      ['encrypt']
    )
    
    // Create the signature string: clientId.timestamp
    const signatureString = `${payoutsAppId}.${timestamp}`
    const encoder = new TextEncoder()
    const data = encoder.encode(signatureString)
    
    // Encrypt with RSA-OAEP
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: 'RSA-OAEP',
      },
      publicKey,
      data
    )
    
    // Base64 encode the encrypted result
    const encryptedArray = new Uint8Array(encryptedBuffer)
    const signature = btoa(String.fromCharCode(...encryptedArray))
    
    console.log('Generated signature for timestamp:', timestamp)

    // V2 Transfer payload
    const payoutPayload = {
      transfer_id: transferId,
      transfer_amount: withdrawal.amount,
      transfer_mode: 'banktransfer',
      beneficiary_details: {
        beneficiary_id: driver.beneficiary_id
      },
      transfer_remarks: 'CartR driver payout'
    }

    console.log('Transfer payload:', JSON.stringify(payoutPayload, null, 2))

    // Call Cashfree Payouts V2 Transfer API with signature
    const cfResponse = await fetch(`${baseUrl}/payout/transfers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': payoutsAppId,
        'x-client-secret': payoutsSecretKey,
        'x-cf-signature': signature,
        'x-api-version': '2024-01-01',
      },
      body: JSON.stringify(payoutPayload),
    })

    const cfResult = await cfResponse.json()
    console.log('Cashfree V2 payout response:', JSON.stringify(cfResult, null, 2))

    // Check if transfer was successful
    // V2 API returns status: RECEIVED (pending), SUCCESS, FAILED, REVERSED
    // RECEIVED means Cashfree accepted the transfer for processing
    const validStatuses = ['RECEIVED', 'SUCCESS', 'PENDING']
    const transferStatus = cfResult.status || cfResult.status_code
    
    if (cfResponse.ok && validStatuses.includes(transferStatus)) {
      // Transfer initiated successfully
      const referenceId = cfResult.cf_transfer_id || cfResult.transfer_id || transferId
      
      console.log('Transfer successful:', { 
        referenceId, 
        status: transferStatus,
        description: cfResult.status_description 
      })
      
      await supabase
        .from('withdrawals')
        .update({
          payout_reference: referenceId,
          payout_status: transferStatus,
          status: 'paid',
          processed_at: new Date().toISOString(),
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
          transfer_id: referenceId,
          transfer_status: transferStatus,
          message: cfResult.status_description || 'Bank transfer initiated via Cashfree V2',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      // Payout failed
      const errorMessage = cfResult.status_description || cfResult.message || cfResult.error?.message || 'Transfer failed'
      
      console.error('Transfer failed:', errorMessage)
      
      await supabase
        .from('withdrawals')
        .update({
          payout_reference: cfResult.cf_transfer_id || transferId,
          payout_status: transferStatus || 'FAILED',
          payout_error: JSON.stringify(cfResult),
          updated_at: new Date().toISOString(),
        })
        .eq('id', withdrawal_id)

      return new Response(
        JSON.stringify({
          error: 'Cashfree payout failed',
          message: errorMessage,
          details: cfResult,
          transfer_id: cfResult.cf_transfer_id || transferId,
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
