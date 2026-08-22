# Cashfree Payouts Integration - Troubleshooting Guide

## Issue: Beneficiaries Not Appearing in Cashfree Dashboard

### Root Causes Identified

1. **Incorrect API Payload Structure**
   - The original payload was using wrong field names
   - Cashfree Payouts API v1 expects specific field names
   - Solution: Updated to correct field names (`beneId`, `name`, `email`, etc.)

2. **Missing Required Fields**
   - Cashfree requires address fields even if not used
   - Solution: Added default values for address, city, state, pincode

3. **Possible Configuration Issues**
   - IP not whitelisted
   - Payouts API not enabled
   - Wrong environment (sandbox vs production)

---

## Credentials Clarification

**Important:** You have TWO sets of Cashfree credentials:

1. **Payment Gateway** (for customer payments)
   - `EXPO_PUBLIC_CASHFREE_APP_ID`
   - `CASHFREE_SECRET_KEY`
   - `CASHFREE_ENVIRONMENT`

2. **Payouts Gateway** (for driver withdrawals)
   - `CASHFREE_PG_APP_ID` (PG = Payouts Gateway)
   - `CASHFREE_PG_SECRET_KEY`
   - `CASHFREE_PG_ENV`

The edge functions use the Payouts Gateway credentials (`CASHFREE_PG_*`).

---

## Setup Steps

### Step 1: Get Cashfree Payouts Credentials

You should already have these if you've set up Cashfree Payouts:

- `CASHFREE_PG_APP_ID` (Payouts Gateway App ID)
- `CASHFREE_PG_SECRET_KEY` (Payouts Gateway Secret Key)

**Note:** These are DIFFERENT from your Payment Gateway credentials:
- Payment Gateway uses: `CASHFREE_APP_ID` and `CASHFREE_SECRET_KEY`
- Payouts Gateway uses: `CASHFREE_PG_APP_ID` and `CASHFREE_PG_SECRET_KEY`

If you don't have Payouts credentials yet:
1. Login to Cashfree Merchant Dashboard
2. Navigate to **Payouts** section
3. Go to **Developers > API Keys**
4. Generate/Copy your Payout credentials

### Step 2: Verify Environment Variables in Supabase

1. Go to Supabase Dashboard
2. Navigate to **Edge Functions > Settings** (or **Project Settings > Edge Functions**)
3. Verify these environment variables exist:

```bash
CASHFREE_PG_APP_ID=your_payout_app_id_here
CASHFREE_PG_SECRET_KEY=your_payout_secret_key_here
CASHFREE_PG_ENV=sandbox  # or 'production'
```

If they're missing, add them now.

### Step 3: Whitelist Your IP (Critical!)

1. In Cashfree Payouts Dashboard
2. Go to **Developers > Two-Factor Authentication**
3. Add your Supabase Edge Function IP addresses
   - For Supabase, you may need to use Public Key authentication instead
   - OR generate a public key for signature-based auth

**Alternative: Use Public Key Authentication**
- If you don't have static IPs, generate a public key
- Download the key file
- Password is your registered email ID
- Use this to generate `x-cf-signature` header

### Step 4: Enable Payouts API

1. Contact Cashfree support at care@cashfree.com
2. Request to enable Payouts API for your account
3. Fill out the Support Form if required
4. Wait for confirmation (usually 24-48 hours)

---

## Testing the Integration

### Test 1: Check Edge Function Logs

1. Go to Supabase Dashboard > Edge Functions > create-beneficiary
2. Check the **Logs** tab
3. Look for the Cashfree API response

**Expected Success Response:**
```json
{
  "status": "SUCCESS",
  "subCode": "200",
  "message": "Beneficiary added successfully"
}
```

**Common Error Responses:**

```json
// IP Not Whitelisted
{
  "status": "ERROR",
  "subCode": "403",
  "message": "IP not whitelisted"
}

// Invalid Credentials
{
  "status": "ERROR",
  "subCode": "403",
  "message": "Token is not valid"
}

// API Not Enabled
{
  "status": "ERROR",
  "subCode": "403",
  "message": "APIs not enabled for this merchant"
}

// Invalid Payload
{
  "status": "ERROR",
  "subCode": "412",
  "message": "Post data is empty or not a valid JSON"
}
```

### Test 2: Verify in Cashfree Dashboard

1. Login to Cashfree Merchant Dashboard
2. Go to **Payouts > Beneficiaries**
3. Check if beneficiary appears with ID format: `CARTR_DRV_xxxxxxxx`

### Test 3: Check Database Status

```sql
SELECT 
  id,
  beneficiary_id,
  beneficiary_status,
  bank_details
FROM drivers
WHERE id = 'your_driver_id';
```

**Expected:**
- `beneficiary_id`: `CARTR_DRV_xxxxxxxx`
- `beneficiary_status`: `active`

---

## API Payload Reference

### Correct Cashfree Payouts API v1 Payload

```json
{
  "beneId": "CARTR_DRV_12345678",
  "name": "Driver Name",
  "email": "driver@example.com",
  "phone": "9999999999",
  "bankAccount": "1234567890",
  "ifsc": "HDFC0001234",
  "address1": "Driver Address",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400001"
}
```

### API Endpoint

- **Sandbox:** `https://payout-gamma.cashfree.com/payout/v1/addBeneficiary`
- **Production:** `https://payout-api.cashfree.com/payout/v1/addBeneficiary`

### Required Headers

```
Content-Type: application/json
X-Client-Id: your_payout_client_id
X-Client-Secret: your_payout_client_secret
```

---

## Common Issues & Solutions

### Issue 1: 200 OK but No Beneficiary in Dashboard

**Cause:** Using wrong environment (sandbox vs production)

**Solution:**
- Check `CASHFREE_PAYOUT_ENV` variable
- Ensure you're checking the correct dashboard (Test vs Production)
- Switch environment in dashboard using "Switch to Test" button

### Issue 2: 403 - IP Not Whitelisted

**Solution:**
- Whitelist Supabase Edge Function IPs
- OR use Public Key authentication with `x-cf-signature` header
- Contact Supabase support for their IP ranges

### Issue 3: 403 - APIs Not Enabled

**Solution:**
- Email care@cashfree.com from registered email
- Request Payouts API enablement
- Mention your Client ID and environment (Test/Production)

### Issue 4: Beneficiary Already Exists

**Cause:** Trying to create duplicate beneficiary

**Solution:**
- The edge function now handles this gracefully
- Returns success if already registered
- Check `beneficiary_status` in database

### Issue 5: Invalid Bank Details

**Cause:** Missing or incorrect IFSC/Account Number

**Solution:**
- Validate IFSC format: 4 letters + 7 digits (e.g., HDFC0001234)
- Ensure account number is numeric
- Verify account holder name matches bank records

---

## Debugging Checklist

- [ ] Cashfree Payouts credentials configured (NOT PG credentials)
- [ ] Environment variables set in Supabase Edge Functions
- [ ] IP whitelisted OR public key configured
- [ ] Payouts API enabled by Cashfree support
- [ ] Using correct environment (sandbox/production)
- [ ] Bank details complete (account number, IFSC, holder name)
- [ ] Edge function logs show 200 response
- [ ] Database shows `beneficiary_status = 'active'`
- [ ] Checking correct Cashfree dashboard (Test vs Production)

---

## Support Contacts

- **Cashfree Support:** care@cashfree.com
- **Documentation:** https://docs.cashfree.com/docs/payouts
- **API Reference:** https://docs.cashfree.com/reference/add-beneficiary

---

## Next Steps After Fixing

Once beneficiaries are being created successfully:

1. Test withdrawal request flow
2. Test admin approval process
3. Test `process-withdrawal` edge function
4. Verify actual bank transfer in sandbox
5. Monitor transaction logs
6. Set up webhook for payout status updates (optional)

---

## Updated Code Changes

The following files have been updated:

1. **supabase/functions/create-beneficiary/index.ts**
   - Fixed environment variable names
   - Corrected API payload structure
   - Added default values for required fields

2. **.env.example**
   - Added Cashfree Payouts credentials section
   - Documented the difference from PG credentials

Make sure to redeploy the edge function after updating environment variables!
