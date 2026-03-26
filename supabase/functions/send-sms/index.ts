import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FAST2SMS_API_KEY = Deno.env.get('FAST2SMS_API_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper: clean phone to plain 10-digit Indian number
function cleanPhoneNumber(phone: string): string {
  // Strip everything except digits
  const digits = phone.replace(/[^0-9]/g, '');
  // Take last 10 digits (handles +91, 91, 0 prefixes)
  return digits.slice(-10);
}

// Helper function to send Fast2SMS
async function sendFast2SMS(phone: string, message: string): Promise<{ success: boolean; requestId?: string; error?: string; rawResponse?: any }> {
  try {
    const cleanPhone = cleanPhoneNumber(phone);
    console.log(`[Fast2SMS] Raw phone: "${phone}" → Cleaned: "${cleanPhone}" (${cleanPhone.length} digits)`);

    if (cleanPhone.length !== 10) {
      return { success: false, error: `Invalid phone number after cleaning: "${cleanPhone}" (expected 10 digits, got ${cleanPhone.length})` };
    }

    console.log(`[Fast2SMS] Sending message: "${message.substring(0, 50)}..." to ${cleanPhone}`);

    const requestBody = {
      route: 'q',
      message: message,
      language: 'english',
      flash: 0,
      numbers: cleanPhone,
    };

    console.log(`[Fast2SMS] Request body:`, JSON.stringify(requestBody));

    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        authorization: FAST2SMS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log(`[Fast2SMS] Raw API response (status ${response.status}):`, responseText);

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      return { success: false, error: `Fast2SMS returned non-JSON response: ${responseText.substring(0, 200)}` };
    }

    if (result.return === true) {
      console.log(`[Fast2SMS] ✅ Success! Request ID: ${result.request_id}`);
      return { success: true, requestId: result.request_id, rawResponse: result };
    } else {
      const errorMsg = Array.isArray(result.message) 
        ? result.message.join(', ') 
        : (typeof result.message === 'string' ? result.message : JSON.stringify(result));
      console.log(`[Fast2SMS] ❌ API returned failure:`, errorMsg);
      return { success: false, error: errorMsg, rawResponse: result };
    }
  } catch (error: any) {
    console.error(`[Fast2SMS] 💥 Exception:`, error);
    return { success: false, error: error.message || 'Failed to send SMS' };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log(`[send-sms] Invoked at ${new Date().toISOString()}`);
    console.log(`[send-sms] FAST2SMS_API_KEY present: ${!!FAST2SMS_API_KEY} (length: ${FAST2SMS_API_KEY?.length || 0})`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get pending items from queue
    const { data: pendingItems, error: fetchError } = await supabase
      .from('sms_queue')
      .select('*')
      .eq('status', 'pending')
      .lt('attempts', 3)
      .order('created_at', { ascending: true })
      .limit(10);

    if (fetchError) {
      console.error('[send-sms] Error fetching queue:', fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log(`[send-sms] Found ${pendingItems?.length || 0} pending items in queue`);

    if (!pendingItems?.length) {
      return new Response(JSON.stringify({ message: 'No pending items', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let successCount = 0;
    let failCount = 0;

    for (const item of pendingItems) {
      const requestId = crypto.randomUUID();
      console.log(`\n[${new Date().toISOString()}] [ReqID:${requestId}] ========================`);
      console.log(`[ReqID:${requestId}] Processing SMS #${item.id} for Booking: ${item.booking_id}`);
      console.log(`[ReqID:${requestId}] Phone: "${item.phone_number}", Message length: ${item.message?.length || 0}`);
      console.log(`[ReqID:${requestId}] Attempts so far: ${item.attempts}`);
      
      try {
        if (!item.booking_id) throw new Error('No booking_id associated with this message');
        if (!item.phone_number) throw new Error('No phone_number associated with this message');
        
        const smsResult = await sendFast2SMS(item.phone_number, item.message);

        if (!smsResult.success) {
            throw new Error(`Fast2SMS API Error: ${smsResult.error}`);
        }
        console.log(`[ReqID:${requestId}] ✅ SMS Sent Successfully. Fast2SMS Request ID: ${smsResult.requestId}`);

        // Mark as success
        const { error: updateError } = await supabase
          .from('sms_queue')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            error_message: `Sent via Fast2SMS. Request ID: ${smsResult.requestId}`
          })
          .eq('id', item.id);

        if (updateError) {
          console.error(`[ReqID:${requestId}] Warning: Failed to update queue status:`, updateError);
        }

        successCount++;

      } catch (error: any) {
        console.error(`[ReqID:${requestId}] 💥 Failed:`, error.message);
        
        const errorMessage = error.message || String(error);
        const isPermanentError = errorMessage.includes('Invalid phone') || 
                                 errorMessage.includes('Invalid API key') ||
                                 errorMessage.includes('No phone_number') ||
                                 errorMessage.includes('expected 10 digits');

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

    console.log(`\n[send-sms] Processing complete. Sent: ${successCount}, Failed: ${failCount}`);

    return new Response(
      JSON.stringify({
        message: 'SMS processing complete',
        total: pendingItems.length,
        sent: successCount,
        failed: failCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[send-sms] Fatal error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
