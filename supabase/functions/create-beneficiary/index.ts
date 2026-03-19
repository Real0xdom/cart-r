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
    console.log('=== CREATE BENEFICIARY EDGE FUNCTION START ===')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    // Cashfree Payouts credentials - try multiple variable name formats
    const payoutsAppId = Deno.env.get('CASHFREE_PAYOUT_APP_ID') || Deno.env.get('CASHFREE_PG_APP_ID')
    const payoutsSecretKey = Deno.env.get('CASHFREE_PAYOUT_SECRET_KEY') || Deno.env.get('CASHFREE_PG_SECRET_KEY')
    const payoutsEnv = Deno.env.get('CASHFREE_ENV') || Deno.env.get('CASHFREE_PG_ENV') || Deno.env.get('CASHFREE_ENVIRONMENT') || 'sandbox'

    console.log('Environment:', payoutsEnv)
    console.log('Credentials present:', { 
      appId: !!payoutsAppId, 
      secretKey: !!payoutsSecretKey,
      appIdLength: payoutsAppId?.length,
      secretKeyLength: payoutsSecretKey?.length
    })

    if (!payoutsAppId || !payoutsSecretKey) {
      console.error('Missing Cashfree credentials')
      return new Response(
        JSON.stringify({ error: 'Cashfree Payouts credentials not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const { driver_id } = await req.json()

    console.log('Driver ID:', driver_id)

    if (!driver_id) {
      console.error('Missing driver_id in request')
      return new Response(
        JSON.stringify({ error: 'driver_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch driver details + bank info
    console.log('Fetching driver from database...')
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('id, user_id, bank_details, beneficiary_id, beneficiary_status')
      .eq('id', driver_id)
      .single()

    if (driverError || !driver) {
      console.error('Driver not found:', driverError)
      return new Response(
        JSON.stringify({ error: 'Driver not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Driver found:', {
      id: driver.id,
      beneficiary_id: driver.beneficiary_id,
      beneficiary_status: driver.beneficiary_status,
      has_bank_details: !!driver.bank_details
    })

    // Check if already registered (but still try to create in Cashfree to verify)
    const alreadyRegistered = driver.beneficiary_id && driver.beneficiary_status === 'active'
    
    if (alreadyRegistered) {
      console.log('⚠️ Driver already marked as registered in DB, but will verify with Cashfree')
    }

    const bankDetails = driver.bank_details
    if (!bankDetails || !bankDetails.account_number || !bankDetails.ifsc_code) {
      console.error('Incomplete bank details:', bankDetails)
      return new Response(
        JSON.stringify({ error: 'Driver bank details incomplete' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Bank details:', {
      account_holder_name: bankDetails.account_holder_name,
      account_number: bankDetails.account_number?.substring(0, 4) + '****',
      ifsc_code: bankDetails.ifsc_code
    })

    // Get user info for beneficiary name
    console.log('Fetching user info...')
    const { data: user } = await supabase
      .from('users')
      .select('name, email, phone')
      .eq('id', driver.user_id)
      .single()

    console.log('User info:', {
      name: user?.name,
      email: user?.email,
      phone: user?.phone
    })

    const beneficiaryId = `CARTR_DRV_${driver_id.substring(0, 8)}`

    // Cashfree Payouts API V2
    const baseUrl = payoutsEnv === 'production'
      ? 'https://api.cashfree.com'
      : 'https://sandbox.cashfree.com'

    console.log('Cashfree API URL:', baseUrl + '/payout/beneficiary')

    // Cashfree Payouts API V2 payload structure
    const beneficiaryPayload = {
      beneficiary_id: beneficiaryId,
      beneficiary_name: bankDetails.account_holder_name || user?.name || 'Driver',
      beneficiary_instrument_details: {
        bank_account_number: bankDetails.account_number,
        bank_ifsc: bankDetails.ifsc_code
      },
      beneficiary_contact_details: {
        beneficiary_email: user?.email || `driver_${driver_id.substring(0, 8)}@cartr.app`,
        beneficiary_phone: user?.phone || '9999999999'
      }
    }

    console.log('📤 Sending to Cashfree:')
    console.log('Beneficiary ID:', beneficiaryId)
    console.log('Payload:', JSON.stringify(beneficiaryPayload, null, 2))

    // Generate timestamp for signature
    const timestamp = Math.floor(Date.now() / 1000).toString()
    
    // For Cashfree Payouts API with RSA signature-based auth
    // The signature is: base64(RSA_encrypt(clientId.timestamp, publicKey, OAEP-SHA1))
    
    // Read the public key from the PEM file
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
    
    console.log('🔐 Request headers:', {
      'Content-Type': 'application/json',
      'x-client-id': payoutsAppId?.substring(0, 8) + '...',
      'x-client-secret': '***' + payoutsSecretKey?.substring(payoutsSecretKey.length - 4),
      'x-cf-signature': signature.substring(0, 16) + '...',
      'x-cf-timestamp': timestamp,
      'x-api-version': '2024-01-01'
    })

    const cfResponse = await fetch(`${baseUrl}/payout/beneficiary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': payoutsAppId,
        'x-client-secret': payoutsSecretKey,
        'x-cf-signature': signature,
        'x-cf-timestamp': timestamp,
        'x-api-version': '2024-01-01',
      },
      body: JSON.stringify(beneficiaryPayload),
    })

    const cfResult = await cfResponse.json()
    console.log('📥 Cashfree Response:')
    console.log('HTTP Status:', cfResponse.status)
    console.log('Status Text:', cfResponse.statusText)
    console.log('Response Body:', JSON.stringify(cfResult, null, 2))

    // V2 API: 200 = success, 409 = conflict (could be same driver or different driver)
    if (cfResponse.ok) {
      // Success - beneficiary created
      console.log('✅ Success: Beneficiary created successfully')
      console.log('Updating database...')
      
      await supabase
        .from('drivers')
        .update({
          beneficiary_id: beneficiaryId,
          beneficiary_status: 'active',
        })
        .eq('id', driver_id)

      console.log('Database updated successfully')
      
      // Send notification to admin about new bank registration
     try {
      console.log('Sending admin notification...')
      const adminNotification = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`, {
        method: 'POST',
        headers: {
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
         },
         body: JSON.stringify({
          user_id: 'admin',
          title: '🏦 New Bank Account Registered',
           body: `Driver has registered their bank account for payouts`,
           data: {
            type: 'bank_registration',
             driver_id: driver_id,
             beneficiary_id: beneficiaryId,
             bank_name: bankDetails.bank_name || 'Unknown',
           },
         }),
       })
      const notificationResult = await adminNotification.json()
      console.log('Admin notification:', notificationResult)
     } catch (notifError) {
      console.error('Failed to send admin notification:', notifError)
       // Don't fail the main operation if notification fails
     }
      
     console.log('=== CREATE BENEFICIARY EDGE FUNCTION END (SUCCESS) ===')

      return new Response(
        JSON.stringify({ 
          success: true, 
          beneficiary_id: beneficiaryId,
          message: 'Beneficiary created successfully',
          cashfree_response: cfResult
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else if (cfResponse.status === 409) {
      // Conflict- bank account already registered
      // Check if it's registered to THIS driver or a DIFFERENT driver
     const conflictMessage = cfResult?.message || ''
     const conflictCode = cfResult?.code || ''
      
      // Check if this is a "beneficiary_id already exists" error
     const isBeneficiaryExists = conflictCode === 'conflict_with_existing_beneficiary' || 
                                 conflictMessage?.includes('beneficiary_id already exists')
      
      if (isBeneficiaryExists) {
        // Beneficiary exists in Cashfree- verify if it belongs to this driver
       console.log('⚠️ Beneficiary already exists in Cashfree, verifying ownership...')
        
        // Fetch the beneficiary from Cashfree to verify
       const timestamp = Math.floor(Date.now() / 1000).toString()
       const signatureString = `${payoutsAppId}.${timestamp}`
       const encoder = new TextEncoder()
       const data = encoder.encode(signatureString)
        
       const publicKeyPem = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzMg9C1Kcf1/RjfKq2O7S
fgaVvwxE76wq9mlYku7Gp4Z4iyrFRmnaEPqPW/+6MfPJn6Yj8GkTNsnrg1gK1C79
sOCb4wc3kAcHlTT5QIdgxQ04tCAYPPMBJ242dpBWlFxe/dVY700bZRTmtf1vwTLo
q8zOuE819Ei0DFdxao92GeaKznWQR8wRDk+LswKIjYKY3mXrJfh1jVZB0uFbed8p
Avbgiq+5HX5tihKUeD90j1t8dMHVq/oZtHL4Xcc1dNstFL1UWwFpef8taWlfIz8o
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
          {
            name: 'RSA-OAEP',
            hash: 'SHA-1',
          },
          false,
          ['encrypt']
        )
        
       const encryptedBuffer= await crypto.subtle.encrypt(
          {
            name: 'RSA-OAEP',
          },
          publicKey,
          data
        )
        
       const encryptedArray = new Uint8Array(encryptedBuffer)
       const signature = btoa(String.fromCharCode(...encryptedArray))
        
        // Fetch existing beneficiary details
       const getBeneficiaryResponse = await fetch(`${baseUrl}/payout/beneficiary/${beneficiaryId}`, {
         method: 'GET',
         headers: {
            'Content-Type': 'application/json',
            'x-client-id': payoutsAppId,
            'x-client-secret': payoutsSecretKey,
            'x-cf-signature': signature,
            'x-cf-timestamp': timestamp,
            'x-api-version': '2024-01-01',
          },
        })
        
       const existingBeneficiary = await getBeneficiaryResponse.json()
       console.log('Existing beneficiary from Cashfree:', JSON.stringify(existingBeneficiary, null, 2))
        
        // Verify if this beneficiary matches the current driver's bank details
       const isSameDriver = existingBeneficiary?.beneficiary_instrument_details && 
                             existingBeneficiary.beneficiary_instrument_details.bank_account_number === bankDetails.account_number &&
                             existingBeneficiary.beneficiary_instrument_details.bank_ifsc === bankDetails.ifsc_code
        
        if (getBeneficiaryResponse.ok && isSameDriver) {
          // Same driver's beneficiary - update DB and return success
         console.log('✅ Success: Verified beneficiary belongs to this driver')
          
          await supabase
            .from('drivers')
            .update({
              beneficiary_id: beneficiaryId,
              beneficiary_status: 'active',
            })
            .eq('id', driver_id)
          
         console.log('Database updated successfully')
         
         // Send notification to admin about bank verification
       try {
       console.log('Sending admin notification...')
       const adminNotification = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`, {
         method: 'POST',
         headers: {
             'Content-Type': 'application/json',
             'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
           },
           body: JSON.stringify({
           user_id: 'admin',
           title: '🏦 Bank Account Verified',
             body: `Driver's existing bank account has been verified`,
             data: {
             type: 'bank_verification',
               driver_id: driver_id,
               beneficiary_id: beneficiaryId,
             },
           }),
         })
       const notificationResult = await adminNotification.json()
       console.log('Admin notification:', notificationResult)
       } catch (notifError) {
       console.error('Failed to send admin notification:', notifError)
         // Don't fail the main operation if notification fails
       }
        
      console.log('=== CREATE BENEFICIARY EDGE FUNCTION END (SUCCESS - VERIFIED) ===')

          return new Response(
            JSON.stringify({ 
              success: true, 
              beneficiary_id: beneficiaryId,
             message: 'Bank account already registered',
              cashfree_response: existingBeneficiary
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } else {
          // Different driver - bank account already used by someone else
         console.error('❌ Conflict: Bank account belongs to another driver')
          
          await supabase
            .from('drivers')
            .update({ beneficiary_status: 'failed' })
            .eq('id', driver_id)
          
         console.log('=== CREATE BENEFICIARY EDGE FUNCTION END (CONFLICT - OTHER DRIVER) ===')
          
          return new Response(
            JSON.stringify({
              error: 'bank_account_already_registered',
             message: 'This bank account is already registered. Please use a different account or contact support.',
              cashfree_response: cfResult
            }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      } else {
        // Other type of conflict error
       console.error('❌ Conflict Error:', conflictMessage)
        
        await supabase
          .from('drivers')
          .update({ beneficiary_status: 'failed' })
          .eq('id', driver_id)
        
        return new Response(
          JSON.stringify({
            error: 'conflict_error',
           message: conflictMessage || 'Bank account registration conflict',
            cashfree_response: cfResult
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else {
      // Failed — extract Cashfree's human-readable message
      console.error('❌ Cashfree API Error')
      console.error('Status:', cfResponse.status)
      console.error('Response:', JSON.stringify(cfResult, null, 2))
      
      await supabase
        .from('drivers')
        .update({ beneficiary_status: 'failed' })
        .eq('id', driver_id)

      // Build a clear, user-facing message from Cashfree's response
      const cfErrorMessage =
        cfResult?.message ||
        cfResult?.reason ||
        cfResult?.subMessage ||
        'Cashfree beneficiary creation failed'

      console.error('Error message:', cfErrorMessage)
      console.log('=== CREATE BENEFICIARY EDGE FUNCTION END (FAILED) ===')

      return new Response(
        JSON.stringify({
          error: 'beneficiary_creation_failed',
          message: cfErrorMessage,
          cashfree_status: cfResponse.status,
          cashfree_response: cfResult, // Full Cashfree response for debugging
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('💥 Exception in edge function:', error)
    console.error('Error stack:', error.stack)
    console.log('=== CREATE BENEFICIARY EDGE FUNCTION END (EXCEPTION) ===')
    return new Response(
      JSON.stringify({ error: 'Internal error', message: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
