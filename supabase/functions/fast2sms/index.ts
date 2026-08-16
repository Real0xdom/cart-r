import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FAST2SMS_API_KEY = Deno.env.get('FAST2SMS_API_KEY')!;
const FAST2SMS_SENDER_ID = Deno.env.get('FAST2SMS_SENDER_ID') || 'FSTSMS';
const FAST2SMS_ROUTE = Deno.env.get('FAST2SMS_ROUTE') || 'p'; // 'p' for promotional, 't' for transactional
const ENVIRONMENT = Deno.env.get('ENVIRONMENT') || 'production';

// Dev testing configuration - numbers that bypass actual SMS API
const DEV_PHONE_NUMBERS = ['7744066077', '+917744066077', '+917744066077'];
const DEV_FIXED_OTP = '123456';

interface Fast2SMSResponse {
  return?: boolean;
  request_id?: string;
  message?: string[];
}

// Check if phone is a dev/testing number
function isDevPhoneNumber(phone: string): boolean {
  // Normalize phone number (remove +91, +, spaces)
  const normalized = phone.replace(/\+91/g, '').replace(/\+/g, '').replace(/\s/g, '');
  return DEV_PHONE_NUMBERS.some(devPhone => {
    const normalizedDev = devPhone.replace(/\+91/g, '').replace(/\+/g, '').replace(/\s/g, '');
    return normalized === normalizedDev;
  });
}

// Send SMS via Fast2SMS API
async function sendFast2SMS(phone: string, message: string): Promise<{ success: boolean; requestId?: string; error?: string }> {
  try {
    // Fast2SMS API endpoint
    const url = 'https://www.fast2sms.com/dev/bulkV2';

    const params = new URLSearchParams({
      authorization: FAST2SMS_API_KEY,
      message: message,
      language: 'english',
      route: FAST2SMS_ROUTE,
      numbers: phone.replace('+91', '').replace('+', ''), // Remove +91 prefix
    });

    const response = await fetch(`${url}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'cache-control': 'no-cache',
      },
    });

    const result: Fast2SMSResponse = await response.json();

    if (result.return === true) {
      return { success: true, requestId: result.request_id };
    } else {
      return { success: false, error: result.message?.join(', ') || 'Unknown error' };
    }
  } catch (error: any) {
    console.error('Fast2SMS Error:', error);
    return { success: false, error: error.message || 'Failed to send SMS' };
  }
}

// Send OTP SMS
async function sendOTP(phone: string, otp: string, purpose: string): Promise<{ success: boolean; requestId?: string; error?: string; devMode?: boolean }> {
  // Check if this is a dev/testing number
  if (isDevPhoneNumber(phone)) {
    console.log(`[DEV MODE] Bypassing SMS API for dev number: ${phone}`);
    console.log(`[DEV MODE] Fixed OTP for testing: ${DEV_FIXED_OTP}`);
    return { 
      success: true, 
      requestId: 'dev-mode-bypass',
      devMode: true
    };
  }

  let message: string;

  switch (purpose) {
    case 'auth':
    case 'registration':
      message = `${otp} is your Cartr verification code. Valid for 5 minutes. Do not share this code with anyone.`;
      break;
    case 'delivery':
      message = `CARTR Delivery: Your delivery OTP is ${otp}. Share this with the driver upon delivery.`;
      break;
    default:
      message = `Your Cartr OTP is ${otp}. Valid for 5 minutes.`;
  }

  return sendFast2SMS(phone, message);
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { action, phone, otp, purpose, bookingId } = await req.json();

    // Action: Send OTP
    if (action === 'send-otp') {
      if (!phone || !otp || !purpose) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing required parameters: phone, otp, purpose' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = await sendOTP(phone, otp, purpose);

      if (result.success) {
        return new Response(
          JSON.stringify({ success: true, requestId: result.requestId }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        return new Response(
          JSON.stringify({ success: false, error: result.error }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Action: Send Custom SMS
    if (action === 'send-sms') {
      if (!phone || !message) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing required parameters: phone, message' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = await sendFast2SMS(phone, message);

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Process SMS Queue (called by cron job)
    if (action === 'process-queue') {
      // Get pending items from queue
      const { data: pendingItems, error: fetchError } = await supabase
        .from('sms_queue')
        .select('*')
        .eq('status', 'pending')
        .lt('attempts', 3)
        .order('created_at', { ascending: true })
        .limit(10);

      if (fetchError) {
        console.error('Error fetching queue:', fetchError);
        return new Response(
          JSON.stringify({ success: false, error: fetchError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!pendingItems?.length) {
        return new Response(
          JSON.stringify({ success: true, message: 'No pending items', processed: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let successCount = 0;
      let failCount = 0;

      for (const item of pendingItems) {
        const requestId = crypto.randomUUID();
        console.log(`[${new Date().toISOString()}] [ReqID:${requestId}] Processing SMS for: ${item.phone_number}`);

        try {
          const result = await sendFast2SMS(item.phone_number, item.message);

          if (result.success) {
            await supabase
              .from('sms_queue')
              .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
                metadata: { ...item.metadata, fast2sms_request_id: result.requestId }
              })
              .eq('id', item.id);

            successCount++;
            console.log(`[${new Date().toISOString()}] [ReqID:${requestId}] ✅ SMS Sent Successfully`);
          } else {
            throw new Error(result.error || 'Failed to send SMS');
          }
        } catch (error: any) {
          console.error(`[${new Date().toISOString()}] [ReqID:${requestId}] 💥 Failed:`, error);

          const errorMessage = error.message || String(error);
          const isPermanentError = errorMessage.includes('Invalid phone') ||
                                 errorMessage.includes('Invalid API key');

          await supabase
            .from('sms_queue')
            .update({
              status: isPermanentError ? 'failed_permanent' : 'failed',
              attempts: item.attempts + 1,
              last_attempt_at: new Date().toISOString(),
              error_message: errorMessage.substring(0, 1000),
            })
            .eq('id', item.id);

          failCount++;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Queue processing complete',
          total: pendingItems.length,
          sent: successCount,
          failed: failCount,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action. Use: send-otp, send-sms, or process-queue' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in function:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
