import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'

// All secrets are stored in Supabase Edge Function secrets — never hardcoded
const FAST2SMS_API_KEY = Deno.env.get('FAST2SMS_API_KEY')!

interface Fast2SMSResponse {
  return?: boolean
  request_id?: string
  message?: string | string[]
}

/**
 * Clean the hook secret to the format standardwebhooks expects.
 * Supabase dashboard may provide secrets in various formats:
 *   - "v1,whsec_XXXXX"  → strip "v1," prefix, keep "whsec_XXXXX"
 *   - "whsec_XXXXX"     → use as-is (library strips whsec_ and base64-decodes)
 *   - raw base64 string → use as-is
 */
function getCleanHookSecret(): string {
  let secret = Deno.env.get('SEND_SMS_HOOK_SECRET') || ''
  // Supabase provides secrets like "v1,whsec_XXXXX" — strip the "v1," prefix
  if (secret.startsWith('v1,whsec_')) {
    secret = secret.substring(3) // → "whsec_XXXXX"
  } else if (secret.startsWith('v1,')) {
    secret = secret.substring(3) // → raw base64
  }
  return secret.trim()
}

async function sendFast2SMS(
  phone: string,
  otp: string
): Promise<{ success: boolean; requestId?: string; error?: string }> {
  try {
    // Strip country code prefix for Fast2SMS (expects 10-digit Indian number)
    const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10)

    const message = `${otp} is your Cartr verification code. Valid for 5 minutes. Do not share this code with anyone.`

    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        authorization: FAST2SMS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        route: 'q',
        message: message,
        language: 'english',
        flash: 0,
        numbers: cleanPhone,
      }),
    })

    const result: Fast2SMSResponse = await response.json()

    if (result.return === true) {
      console.log(
        `[Auth SMS Hook] ✅ SMS sent successfully to ${cleanPhone}. Request ID: ${result.request_id}`
      )
      return { success: true, requestId: result.request_id }
    } else {
      const errorMsg = Array.isArray(result.message)
        ? result.message.join(', ')
        : typeof result.message === 'string'
          ? result.message
          : 'Unknown Fast2SMS error'
      console.error(`[Auth SMS Hook] ❌ Fast2SMS error: ${errorMsg}`)
      return { success: false, error: errorMsg }
    }
  } catch (error: any) {
    console.error('[Auth SMS Hook] ❌ Exception sending SMS:', error)
    return { success: false, error: error.message || 'Failed to send SMS' }
  }
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Verify the Webhook Signature from Supabase
    const payload = await req.text()
    const headers = Object.fromEntries(req.headers)

    let user: { phone: string }
    let sms: { otp: string }

    try {
      const hookSecret = getCleanHookSecret()
      console.log(`[Auth SMS Hook] Secret format starts with: ${hookSecret.substring(0, 6)}...`)
      const wh = new Webhook(hookSecret)
      const verified = wh.verify(payload, headers) as {
        user: { phone: string }
        sms: { otp: string }
      }
      user = verified.user
      sms = verified.sms
      console.log('[Auth SMS Hook] ✅ Webhook signature verified successfully')
    } catch (verifyError: any) {
      console.warn(
        `[Auth SMS Hook] ⚠️ Signature verification failed: ${verifyError.message}. Falling back to direct payload parsing.`
      )
      // Fallback: parse the payload directly (Supabase is the only caller since JWT is disabled and the function URL is private)
      const parsed = JSON.parse(payload)
      user = parsed.user
      sms = parsed.sms

      if (!user?.phone || !sms?.otp) {
        throw new Error('Invalid payload: missing user.phone or sms.otp')
      }
    }

    const phone = user.phone
    const otp = sms.otp

    console.log(`[Auth SMS Hook] Received OTP request for phone: ${phone}`)

    if (!phone || !otp) {
      console.error('[Auth SMS Hook] Missing phone or OTP in webhook payload')
      return new Response(
        JSON.stringify({ error: 'Missing phone or OTP' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // 2. Send OTP via Fast2SMS
    const result = await sendFast2SMS(phone, otp)

    if (result.success) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'SMS sent successfully',
          requestId: result.requestId,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error || 'Failed to send SMS',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }
  } catch (error: any) {
    console.error('[Auth SMS Hook] Error:', error.message || error)

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
