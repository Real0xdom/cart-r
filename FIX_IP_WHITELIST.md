# Fix: IP Not Whitelisted Error

## The Problem

Cashfree is returning: **"IP not whitelisted"** (403 Forbidden)

Your Supabase Edge Functions are calling Cashfree from Supabase's servers, but those IP addresses are not whitelisted in your Cashfree account.

---

## Solution: Whitelist Supabase IPs

### Step 1: Get Supabase Edge Function IP Addresses

Supabase Edge Functions run on Cloudflare Workers. You need to whitelist Cloudflare's IP ranges.

**Option A: Contact Supabase Support**
1. Go to https://supabase.com/dashboard/support
2. Ask for the IP addresses used by Edge Functions in region: `ap-south-1`
3. They'll provide you with the specific IPs

**Option B: Use Cloudflare IP Ranges (Broader)**
Supabase Edge Functions use Cloudflare. You can whitelist Cloudflare's IP ranges:
- Get the list from: https://www.cloudflare.com/ips/

However, this is a large list and Cashfree may not accept all of them.

### Step 2: Whitelist IPs in Cashfree Dashboard

1. Login to https://merchant.cashfree.com
2. Navigate to **Payouts** section
3. Go to **Developers** → **Two-Factor Authentication**
4. Click **IP Whitelist** tab
5. Click **Add IP Address**
6. Add each Supabase IP address
7. Click **Save**

---

## Alternative Solution: Use Public Key Authentication

If you can't get static IPs or Cashfree won't accept them, use signature-based authentication instead.

### Step 1: Generate Public Key in Cashfree

1. Go to Cashfree Dashboard → **Payouts** → **Developers** → **Two-Factor Authentication**
2. Click **Generate Public Key**
3. Download the `.pem` file
4. Note: Password is your registered email address

### Step 2: Update Edge Function to Use Signature

This is more complex and requires:
1. Uploading the public key to Supabase
2. Generating `x-cf-signature` header using the key
3. Updating the edge function code

**This is advanced and requires additional implementation.**

---

## Quick Test: Disable IP Whitelist (Sandbox Only)

**WARNING: Only for testing in sandbox environment!**

Some Cashfree sandbox accounts may allow you to temporarily disable IP whitelist:

1. Go to Cashfree Dashboard (Test mode)
2. Navigate to **Payouts** → **Developers** → **Two-Factor Authentication**
3. Check if there's an option to disable IP whitelist for testing
4. If available, disable it temporarily

**Note:** This may not be available for all accounts, and should NEVER be done in production.

---

## Recommended Approach

### For Sandbox/Testing:

1. **Contact Supabase Support** to get Edge Function IPs for `ap-south-1` region
2. **Whitelist those IPs** in Cashfree sandbox dashboard
3. Test the integration

### For Production:

1. **Use the same whitelisted IPs** from sandbox
2. **OR implement Public Key authentication** for better security
3. **Monitor logs** to ensure no IP-related issues

---

## How to Contact Supabase Support

1. Go to https://supabase.com/dashboard/support
2. Click **New Support Ticket**
3. Subject: "Edge Function IP Addresses for ap-south-1"
4. Message:
   ```
   Hi,
   
   I need the IP addresses used by Edge Functions in the ap-south-1 region
   for whitelisting in a third-party API (Cashfree Payouts).
   
   Project ref: epevjbiymsvwmmzybzib
   
   Thank you!
   ```

They usually respond within 24 hours.

---

## Temporary Workaround: Use a Proxy Server

If you need this working immediately:

1. Set up a small proxy server on a VPS (DigitalOcean, AWS, etc.)
2. Whitelist that server's IP in Cashfree
3. Have your Edge Function call the proxy
4. Proxy forwards the request to Cashfree

**This adds complexity and latency, so only use as a last resort.**

---

## Check Current Status

After whitelisting IPs, test again from your driver app. The logs should show:

```
📥 Cashfree Response:
HTTP Status: 200
Response Body: {
  "beneficiary_id": "CARTR_DRV_4ef55e99",
  "status": "ACTIVE"
}
✅ Success: Beneficiary created successfully
```

---

## Summary

**Problem:** Supabase Edge Function IPs not whitelisted in Cashfree
**Solution:** Get Supabase IPs and whitelist them in Cashfree dashboard
**Alternative:** Use Public Key authentication (more complex)

Contact Supabase support to get the IP addresses, then whitelist them in Cashfree!
