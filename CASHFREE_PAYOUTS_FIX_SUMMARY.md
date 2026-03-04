# Cashfree Payouts Integration - Fix Summary

## Problem
Beneficiaries were not appearing in Cashfree Payouts dashboard even though the edge function returned 200 OK.

## Root Cause
The API payload structure was incorrect. The edge function was using wrong field names that don't match Cashfree Payouts API v1 specification.

## What Was Fixed

### 1. API Payload Structure (MAIN FIX)

**Before (Incorrect):**
```typescript
const beneficiaryPayload = {
  beneficiary_id: beneficiaryId,
  beneficiary_name: bankDetails.account_holder_name,
  beneficiary_email: user?.email || '',
  beneficiary_phone: user?.phone || '',
  bank_account_number: bankDetails.account_number,
  bank_ifsc: bankDetails.ifsc_code,
  beneficiary_instrument_details: {
    bank_account_number: bankDetails.account_number,
    bank_ifsc: bankDetails.ifsc_code,
  }
}
```

**After (Correct):**
```typescript
const beneficiaryPayload = {
  beneId: beneficiaryId,
  name: bankDetails.account_holder_name || user?.name || 'Driver',
  email: user?.email || `driver_${driver_id.substring(0, 8)}@cartr.app`,
  phone: user?.phone || '9999999999',
  bankAccount: bankDetails.account_number,
  ifsc: bankDetails.ifsc_code,
  address1: 'Driver Address',
  city: 'City',
  state: 'State',
  pincode: '000000'
}
```

### 2. Added Required Fields
- `address1`, `city`, `state`, `pincode` are required by Cashfree API
- Added default values to prevent validation errors
- Added fallback email/phone if driver data is incomplete

### 3. Clarified Environment Variables
- Confirmed `CASHFREE_PG_APP_ID` and `CASHFREE_PG_SECRET_KEY` are correct
- These are Payouts Gateway credentials (PG = Payouts Gateway)
- Different from Payment Gateway credentials (`CASHFREE_APP_ID`)

## Files Modified

1. **supabase/functions/create-beneficiary/index.ts**
   - Fixed API payload field names
   - Added required address fields
   - Added fallback values for email/phone

2. **.env.example**
   - Added clarifying comments about credential types
   - Documented both Payment Gateway and Payouts Gateway variables

## What You Need to Do Now

### Step 1: Redeploy Edge Function
The code has been updated, so you need to redeploy:

```bash
# Using Supabase CLI
supabase functions deploy create-beneficiary

# Or redeploy from Supabase Dashboard
```

### Step 2: Verify Environment Variables
Make sure these are set in Supabase Edge Functions settings:

```
CASHFREE_PG_APP_ID=your_payout_app_id
CASHFREE_PG_SECRET_KEY=your_payout_secret_key
CASHFREE_PG_ENV=sandbox
```

### Step 3: Check Other Requirements

Before testing, ensure:

- [ ] IP is whitelisted in Cashfree Dashboard (or public key auth configured)
- [ ] Payouts API is enabled (contact care@cashfree.com if not)
- [ ] Using correct environment (sandbox vs production)
- [ ] Edge function is redeployed with new code

### Step 4: Test Again

1. In driver app, add/update bank account details
2. Check Supabase Edge Function logs for Cashfree response
3. Verify beneficiary appears in Cashfree Dashboard
4. Check database: `beneficiary_status` should be `active`

## Expected Behavior After Fix

```
Driver adds bank details
    ↓
Driver app calls create-beneficiary edge function
    ↓
Edge function sends correct payload to Cashfree
    ↓
Cashfree creates beneficiary (returns 200 SUCCESS)
    ↓
Beneficiary appears in Cashfree Dashboard
    ↓
Database updated: beneficiary_status = 'active'
```

## Troubleshooting

If it still doesn't work after redeploying:

1. **Check Edge Function Logs**
   - Look for "Cashfree response:" in logs
   - Check for error messages

2. **Test API Directly**
   - Use the cURL command in `test-cashfree-beneficiary.md`
   - This will show you the exact error

3. **Common Issues**
   - IP not whitelisted → Add IP in Cashfree dashboard
   - API not enabled → Email care@cashfree.com
   - Wrong environment → Check sandbox vs production dashboard

## Additional Resources

- `CASHFREE_PAYOUTS_SETUP.md` - Quick setup guide
- `CASHFREE_PAYOUTS_TROUBLESHOOTING.md` - Detailed troubleshooting
- `test-cashfree-beneficiary.md` - Direct API testing guide

## API Reference

- **Endpoint:** `POST /payout/v1/addBeneficiary`
- **Sandbox:** `https://payout-gamma.cashfree.com`
- **Production:** `https://payout-api.cashfree.com`
- **Docs:** https://docs.cashfree.com/reference/add-beneficiary

## Summary

The main issue was incorrect field names in the API payload. The updated code now uses the correct Cashfree Payouts API v1 field names (`beneId`, `name`, `email`, etc.) and includes all required fields. After redeploying the edge function, beneficiaries should be created successfully.
