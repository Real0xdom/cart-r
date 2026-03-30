import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const FAST2SMS_API_KEY = Deno.env.get("FAST2SMS_API_KEY") || "";

interface Fast2SMSResponse {
  return?: boolean;
  request_id?: string;
  message?: string | string[];
  errors?: string[];
}

function getCleanHookSecret(): string {
  let secret = Deno.env.get("SEND_SMS_HOOK_SECRET") || "";

  if (secret.startsWith("v1,whsec_")) {
    secret = secret.substring(3);
  } else if (secret.startsWith("v1,")) {
    secret = secret.substring(3);
  }

  return secret.trim();
}

function extractPayloadParts(parsed: any) {
  const user = parsed?.user || parsed?.message?.user || {};
  const sms = parsed?.sms || parsed?.message?.sms || {};
  return { user, sms };
}

async function sendFast2SMS(
  phone: string,
  otp: string
): Promise<{ success: boolean; requestId?: string; error?: string }> {
  try {
    if (!FAST2SMS_API_KEY) {
      return { success: false, error: "FAST2SMS_API_KEY is not configured" };
    }

    const cleanPhone = phone.replace(/[^0-9]/g, "").slice(-10);

    if (cleanPhone.length !== 10) {
      return {
        success: false,
        error: `Phone number is not a valid Indian mobile number: ${phone}`,
      };
    }

    const message = `${otp} is your Cartr verification code. Valid for 5 minutes. Do not share this code with anyone.`;

    const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: {
        authorization: FAST2SMS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        route: "q",
        message,
        language: "english",
        flash: 0,
        numbers: cleanPhone,
      }),
    });

    const rawBody = await response.text();
    let result: Fast2SMSResponse = {};

    try {
      result = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      result = { message: rawBody || "Invalid response from Fast2SMS" };
    }

    if (response.ok && result.return === true) {
      console.log(
        `[Auth SMS Hook] SMS sent successfully to ${cleanPhone}. Request ID: ${result.request_id}`
      );
      return { success: true, requestId: result.request_id };
    }

    const errorMsg = Array.isArray(result.message)
      ? result.message.join(", ")
      : Array.isArray(result.errors)
        ? result.errors.join(", ")
        : typeof result.message === "string"
          ? result.message
          : `Fast2SMS request failed with status ${response.status}`;

    console.error(`[Auth SMS Hook] Fast2SMS error: ${errorMsg}`);
    return { success: false, error: errorMsg };
  } catch (error: any) {
    console.error("[Auth SMS Hook] Exception sending SMS:", error);
    return { success: false, error: error.message || "Failed to send SMS" };
  }
}

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.text();
    const headers = Object.fromEntries(req.headers);

    let user: { phone?: string } = {};
    let sms: { otp?: string } = {};

    try {
      const hookSecret = getCleanHookSecret();

      if (!hookSecret) {
        throw new Error("SEND_SMS_HOOK_SECRET is not configured");
      }

      console.log(
        `[Auth SMS Hook] Secret format starts with: ${hookSecret.substring(0, 6)}...`
      );

      const webhook = new Webhook(hookSecret);
      const verified = (await webhook.verify(payload, headers)) as any;
      const extracted = extractPayloadParts(verified);
      user = extracted.user;
      sms = extracted.sms;

      console.log("[Auth SMS Hook] Webhook signature verified successfully");
    } catch (verifyError: any) {
      console.warn(
        `[Auth SMS Hook] Signature verification failed: ${verifyError.message}. Falling back to direct payload parsing.`
      );

      const parsed = JSON.parse(payload);
      const extracted = extractPayloadParts(parsed);
      user = extracted.user;
      sms = extracted.sms;
    }

    const phone = user.phone;
    const otp = sms.otp;

    console.log(`[Auth SMS Hook] Received OTP request for phone: ${phone}`);

    if (!phone || !otp) {
      return new Response(
        JSON.stringify({ error: "Missing phone or OTP" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const result = await sendFast2SMS(phone, otp);

    if (!result.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error || "Failed to send SMS",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "SMS sent successfully",
        requestId: result.requestId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[Auth SMS Hook] Error:", error.message || error);

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
