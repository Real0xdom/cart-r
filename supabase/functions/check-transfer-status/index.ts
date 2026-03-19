// Cashfree Payouts — Check Transfer Status Edge Function
// Polls Cashfree API to check the status of pending transfers
// Can be called manually or scheduled via cron

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
    const payoutsAppId = Deno.env.get('CASHFREE_PAYOUT_APP_ID')
    const payoutsSecretKey = Deno.env.get('CASHFREE_PAYOUT_SECRET_KEY')
    const payoutsEnv = Deno.env.get('CASHFREE_ENV') || Deno.env.get('CASHFREE_ENVIRONMENT') || 'sandbox'

    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Get withdrawal_id from request (optional - if not provided, check all pending)
    const { withdrawal_id } = await req.json().catch(() => ({}))

    console.log('Checking transfer status...', withdrawal_id ? `for withdrawal: ${withdrawal_id}` : 'for all pending')

    // Fetch pending/processing withdrawals
    let query = supabase
      .from('withdrawals')
      .select('id, payout_reference, payout_status, amount, driver_id')
      .not('payout_reference', 'is', null)

    if (withdrawal_id) {
      // If specific withdrawal requested, fetch it regardless of status
      query = query.eq('id', withdrawal_id)
    } else {
      // Otherwise, only fetch pending/processing ones
      query = query.in('payout_status', ['RECEIVED', 'PENDING', 'ERROR'])
    }

    const { data: withdrawals, error: fetchError } = await query

    if (fetchError) {
      console.error('Error fetching withdrawals:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch withdrawals' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!withdrawals || withdrawals.length === 0) {
      console.log('No pending withdrawals found')
      return new Response(
        JSON.stringify({ 
          message: withdrawal_id ? `Withdrawal ${withdrawal_id} not found or has no payout reference` : 'No pending withdrawals', 
          checked: 0 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${withdrawals.length} withdrawal(s) to check`)
    if (withdrawal_id) {
      console.log(`Specific withdrawal: ${withdrawals[0].id}, Current payout_status: ${withdrawals[0].payout_status}`)
    }

    if (!payoutsAppId || !payoutsSecretKey) {
      console.error('Cashfree credentials not configured')
      return new Response(
        JSON.stringify({ error: 'Cashfree credentials not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const baseUrl = payoutsEnv === 'production'
      ? 'https://api.cashfree.com'
      : 'https://sandbox.cashfree.com'

    // Generate RSA signature for V2 API authentication
    const timestamp = Math.floor(Date.now() / 1000).toString()
    
    const publicKeyPem = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzMg9C1Kcf1/RjfKq2O7S
fgaVvwxE76wq9mlYku7Gp4Z4iyrFRmnaEPqPW/+6MfPJn6Yj8GkTNsnrg1gK1C79
sOCb4wc3kAcHlTT5QIdgxQ04tCAYPPMBJ242dpBWlFxe/dVY700bZRTmtf1vwTLo
q8zOuE819Ei0DFdxao92GeaKznWQR8wRDk+LswKIjYKY3mXrJfh1jVZB0uFbed8p
Avbgiq+5HX5tihKUeD90j1t8dMHVq/oZtHL4Xcc1dNstFK1UWwFpef8taWlfIz8o
rz38ws0JnIHlljJYf5H5bwT1yhiMKiHfdFbnoZ+wv9oXRuvhi/FuBq3YXUDm8MLX
AQIDAQAB
-----END PUBLIC KEY-----`
    
    const pemContents = publicKeyPem
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\s/g, '')
    
    const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))
    
    const publicKey = await crypto.subtle.importKey(
      'spki',
      binaryDer,
      { name: 'RSA-OAEP', hash: 'SHA-1' },
      false,
      ['encrypt']
    )
    
    const signatureString = `${payoutsAppId}.${timestamp}`
    const encoder = new TextEncoder()
    const data = encoder.encode(signatureString)
    
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'RSA-OAEP' },
      publicKey,
      data
    )
    
    const encryptedArray = new Uint8Array(encryptedBuffer)
    const signature = btoa(String.fromCharCode(...encryptedArray))
    
    console.log('Generated signature for timestamp:', timestamp)

    // Get bearer token for V1 API
    const authResponse = await fetch(`${baseUrl}/payout/v1/authorize`, {
      method: 'POST',
      headers: {
        'x-client-id': payoutsAppId,
        'x-client-secret': payoutsSecretKey,
        'x-cf-signature': signature,
        'x-cf-timestamp': timestamp,
        'Content-Type': 'application/json',
      },
    })

    const authResult = await authResponse.json()
    console.log('Auth response:', JSON.stringify(authResult))
    
    const bearerToken = authResult.data?.token || authResult.token
    console.log('Got bearer token:', bearerToken ? 'yes' : 'no')

    const results = []

    // Check status for each withdrawal
    for (const withdrawal of withdrawals) {
      try {
        console.log(`Checking status for: ${withdrawal.payout_reference}`)
        
        // Try V2 API first - try cf_transfer_id parameter
        let statusResponse = await fetch(
          `${baseUrl}/payout/transfers?cf_transfer_id=${withdrawal.payout_reference}`,
          {
            method: 'GET',
            headers: {
              'x-client-id': payoutsAppId,
              'x-client-secret': payoutsSecretKey,
              'x-cf-signature': signature,
              'x-cf-timestamp': timestamp,
              'x-api-version': '2024-01-01',
            },
          }
        )

        let statusResult = await statusResponse.json()
        console.log(`V2 cf_transfer_id response for ${withdrawal.payout_reference}:`, JSON.stringify(statusResult))
        
        // If not found with cf_transfer_id, try with transfer_id
        if (statusResult.code === 'transfer_id_not_found' || statusResult.type === 'invalid_request_error') {
          statusResponse = await fetch(
            `${baseUrl}/payout/transfers?transfer_id=${withdrawal.payout_reference}`,
            {
              method: 'GET',
              headers: {
                'x-client-id': payoutsAppId,
                'x-client-secret': payoutsSecretKey,
                'x-cf-signature': signature,
                'x-cf-timestamp': timestamp,
                'x-api-version': '2024-01-01',
              },
            }
          )
          statusResult = await statusResponse.json()
          console.log(`V2 transfer_id response for ${withdrawal.payout_reference}:`, JSON.stringify(statusResult))
        }
        
        // Log full response for debugging
        console.log(`Final status response for ${withdrawal.payout_reference}:`, JSON.stringify(statusResult))
        
        // Check if this is an API error (not a transfer status)
        if (statusResult.status === 'ERROR' && statusResult.subCode) {
          console.error(`API authentication error for ${withdrawal.payout_reference}:`, statusResult.message)
          results.push({
            withdrawal_id: withdrawal.id,
            payout_reference: withdrawal.payout_reference,
            error: `API Error: ${statusResult.message}`,
            api_error: true,
          })
          continue
        }
        
        // Check if API returned an error response
        if (!statusResponse.ok) {
          console.error(`API request failed for ${withdrawal.payout_reference}:`, statusResult)
          results.push({
            withdrawal_id: withdrawal.id,
            payout_reference: withdrawal.payout_reference,
            error: statusResult.message || 'API request failed',
            api_error: true,
          })
          continue
        }
        
        // Extract status from V2 API response structure
        const transferData = statusResult.data || statusResult
        const newStatus = transferData.status || transferData.status_code
        
        console.log(`Extracted status for ${withdrawal.payout_reference}:`, newStatus)
        
        // Update if status changed
        if (newStatus && newStatus !== withdrawal.payout_status) {
          console.log(`Status changed: ${withdrawal.payout_status} → ${newStatus}`)
          
          const updateData: any = {
            payout_status: newStatus,
            updated_at: new Date().toISOString(),
          }

          if (newStatus === 'SUCCESS') {
            updateData.status = 'paid'
            updateData.processed_at = new Date().toISOString()
            
            // Update transaction status
            await supabase
              .from('driver_wallet_transactions')
              .update({ status: 'completed' })
              .eq('withdrawal_id', withdrawal.id)
              .eq('type', 'withdrawal')
          } else if (newStatus === 'FAILED' || newStatus === 'REVERSED' || newStatus === 'ERROR' || newStatus === 'REJECTED') {
            updateData.status = 'failed'
            updateData.payout_error = transferData.status_description || transferData.reason || transferData.remarks || 'Transfer failed'
            
            // Refund to driver's wallet
            const { data: driver } = await supabase
              .from('drivers')
              .select('available_balance')
              .eq('id', withdrawal.driver_id)
              .single()
            
            if (driver) {
              const newBalance = Number(driver.available_balance || 0) + Number(withdrawal.amount)
              
              await supabase
                .from('drivers')
                .update({ available_balance: newBalance })
                .eq('id', withdrawal.driver_id)
              
              await supabase
                .from('driver_wallet_transactions')
                .insert({
                  driver_id: withdrawal.driver_id,
                  type: 'refund',
                  amount: withdrawal.amount,
                  description: `Withdrawal refund - ${transferData.status_description || transferData.reason || transferData.remarks || 'Transfer failed'}`,
                  status: 'completed',
                  withdrawal_id: withdrawal.id,
                })
            }
          }

          await supabase
            .from('withdrawals')
            .update(updateData)
            .eq('id', withdrawal.id)

          results.push({
            withdrawal_id: withdrawal.id,
            payout_reference: withdrawal.payout_reference,
            old_status: withdrawal.payout_status,
            new_status: newStatus,
            updated: true,
          })
        } else {
          results.push({
            withdrawal_id: withdrawal.id,
            payout_reference: withdrawal.payout_reference,
            status: newStatus,
            updated: false,
          })
        }
      } catch (error) {
        console.error(`Error checking status for ${withdrawal.payout_reference}:`, error)
        results.push({
          withdrawal_id: withdrawal.id,
          payout_reference: withdrawal.payout_reference,
          error: String(error),
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked: withdrawals.length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Check transfer status error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal error', message: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
