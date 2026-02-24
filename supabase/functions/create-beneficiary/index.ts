// Cashfree Payouts — Create Beneficiary Edge Function
// Registers a driver as a beneficiary in Cashfree Payouts for automated bank transfers
// Requires Cashfree Payouts API credentials (separate from PG credentials)

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

    if (!payoutsAppId || !payoutsSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Cashfree Payouts credentials not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const { driver_id } = await req.json()

    if (!driver_id) {
      return new Response(
        JSON.stringify({ error: 'driver_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch driver details + bank info
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('id, user_id, bank_details, beneficiary_id, beneficiary_status')
      .eq('id', driver_id)
      .single()

    if (driverError || !driver) {
      return new Response(
        JSON.stringify({ error: 'Driver not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Already registered
    if (driver.beneficiary_id && driver.beneficiary_status === 'active') {
      return new Response(
        JSON.stringify({ success: true, beneficiary_id: driver.beneficiary_id, message: 'Already registered' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const bankDetails = driver.bank_details
    if (!bankDetails || !bankDetails.account_number || !bankDetails.ifsc_code) {
      return new Response(
        JSON.stringify({ error: 'Driver bank details incomplete' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user info for beneficiary name
    const { data: user } = await supabase
      .from('users')
      .select('name, email, phone')
      .eq('id', driver.user_id)
      .single()

    const beneficiaryId = `CARTR_DRV_${driver_id.substring(0, 8)}`

    // Cashfree Payouts API — Add Beneficiary
    const baseUrl = payoutsEnv === 'production'
      ? 'https://payout-api.cashfree.com'
      : 'https://payout-gamma.cashfree.com'

    const beneficiaryPayload = {
      beneficiary_id: beneficiaryId,
      beneficiary_name: bankDetails.account_holder_name || user?.name || 'Driver',
      beneficiary_email: user?.email || '',
      beneficiary_phone: user?.phone || '',
      bank_account_number: bankDetails.account_number,
      bank_ifsc: bankDetails.ifsc_code,
      beneficiary_instrument_details: {
        bank_account_number: bankDetails.account_number,
        bank_ifsc: bankDetails.ifsc_code,
      }
    }

    console.log('Creating beneficiary:', beneficiaryId)

    const cfResponse = await fetch(`${baseUrl}/payout/v1/addBeneficiary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': payoutsAppId,
        'X-Client-Secret': payoutsSecretKey,
      },
      body: JSON.stringify(beneficiaryPayload),
    })

    const cfResult = await cfResponse.json()
    console.log('Cashfree response:', cfResult)

    if (cfResponse.ok || cfResult?.subCode === '200' || cfResult?.message?.includes('already')) {
      // Success or already exists
      await supabase
        .from('drivers')
        .update({
          beneficiary_id: beneficiaryId,
          beneficiary_status: 'active',
        })
        .eq('id', driver_id)

      return new Response(
        JSON.stringify({ success: true, beneficiary_id: beneficiaryId }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      // Failed
      await supabase
        .from('drivers')
        .update({ beneficiary_status: 'failed' })
        .eq('id', driver_id)

      return new Response(
        JSON.stringify({ error: 'Cashfree beneficiary creation failed', details: cfResult }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('Beneficiary creation error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal error', message: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
