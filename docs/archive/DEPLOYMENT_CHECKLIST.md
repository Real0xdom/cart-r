# Cashfree Payouts Integration - Deployment Checklist

## Current Status: ❌ Environment Variables Missing

Your edge functions have been updated with the correct code, but they need environment variables to work.

---

## ✅ Completed

- [x] Fixed API payload structure in `create-beneficiary` edge function
- [x] Fixed API payload structure in `process-withdrawal` edge function
- [x] Added proper logging for debugging
- [x] Added fallback values for required fields
- [x] Updated documentation

---

## ⏳ Pending - YOU NEED TO DO THIS

### 1. Add Environment Variables to Supabase ⚠️ CRITICAL

**Where:** Supabase Dashboard → Project Settings → Edge Functions → Environment Variables

**What to add:**

| Variable Name | Value | Where to Get |
|---------------|-------|--------------|
| `CASHFREE_PG_APP_ID` | Your Payouts App ID | Cashfree Dashboard → Payouts → Developers → API Keys |
| `CASHFREE_PG_SECRET_KEY` | Your Payouts Secret Key | Cashfree Dashboard → Payouts → Developers → API Keys |
| `CASHFREE_PG_ENV` | `sandbox` | Use `sandbox` for testing, `production` for live |

**Status:** ❌ NOT DONE (causing 503 error)

**Instructions:** See `QUICK_FIX_STEPS.md` or `ADD_CASHFREE_ENV_VARS.md`

---

### 2. Verify Cashfree Configuration

- [ ] IP whitelisted in Cashfree Dashboard (or public key auth configured)
- [ ] Payouts API enabled (contact care@cashfree.com if not)
- [ ] Using correct Cashfree credentials (Payouts, not Payment Gateway)
- [ ] Checking correct dashboard (Test for sandbox, Production for production)

---

### 3. Deploy Edge Functions (Optional)

The code changes are already in your local files. You can deploy them:

**Option A: Via Supabase Dashboard**
1. Go to Edge Functions section
2. Click on `create-beneficiary`
3. Click **Deploy** button
4. Repeat for `process-withdrawal`

**Option B: Via Supabase CLI**
```bash
supabase functions deploy create-beneficiary
supabase functions deploy process-withdrawal
```

**Note:** If you can't deploy via CLI (Docker not running), you can:
1. Copy the updated code from `supabase/functions/create-beneficiary/index.ts`
2. Paste it in the Supabase Dashboard editor
3. Click Deploy

---

## 🧪 Testing Steps

After adding environment variables:

1. **Test from Driver App**
   - Open driver app
   - Go to Profile → Bank Details
   - Add/update bank account information
   - Save

2. **Check Edge Function Logs**
   - Go to Supabase Dashboard
   - Navigate to Edge Functions → create-beneficiary
   - Click **Logs** tab
   - Look for "Cashfree response:" in logs

3. **Verify in Cashfree Dashboard**
   - Login to Cashfree Merchant Dashboard
   - Go to Payouts → Beneficiaries
   - Look for beneficiary with ID: `CARTR_DRV_xxxxxxxx`

4. **Check Database**
   ```sql
   SELECT 
     id,
     beneficiary_id,
     beneficiary_status,
     bank_details
   FROM drivers
   WHERE id = 'your_driver_id';
   ```
   - `beneficiary_id` should be set
   - `beneficiary_status` should be `active`

---

## 📊 Expected Results

### Success Flow
```
Driver adds bank details
    ↓
Edge function reads environment variables ✓
    ↓
Calls Cashfree API with correct payload ✓
    ↓
Cashfree creates beneficiary
    ↓
Returns 200 SUCCESS
    ↓
Database updated: beneficiary_status = 'active'
    ↓
Beneficiary appears in Cashfree Dashboard
```

### Current Flow (Before Fix)
```
Driver adds bank details
    ↓
Edge function tries to read environment variables
    ↓
Variables not found ❌
    ↓
Returns 503 error: "Cashfree Payouts credentials not configured"
```

---

## 🔧 Troubleshooting

### Error: 503 - Credentials not configured
**Cause:** Environment variables not set
**Fix:** Add `CASHFREE_PG_*` variables to Supabase (see Step 1 above)

### Error: 403 - IP not whitelisted
**Cause:** Server IP not added to Cashfree
**Fix:** Whitelist IP in Cashfree Dashboard → Developers → Two-Factor Authentication

### Error: 403 - Token is not valid
**Cause:** Wrong credentials or typo
**Fix:** Verify you're using Payouts credentials (not Payment Gateway)

### Error: 403 - APIs not enabled
**Cause:** Payouts API not activated for your account
**Fix:** Email care@cashfree.com to enable Payouts API

### Error: 409 - Beneficiary already exists
**Cause:** Beneficiary was created in a previous attempt
**Fix:** This is actually OK! Check Cashfree dashboard to verify

### Success: 200 but no beneficiary in dashboard
**Cause:** Checking wrong environment (sandbox vs production)
**Fix:** Verify `CASHFREE_PG_ENV` matches the dashboard you're checking

---

## 📚 Documentation Files

- `QUICK_FIX_STEPS.md` - Fast 5-minute fix guide
- `ADD_CASHFREE_ENV_VARS.md` - Detailed environment variable setup
- `CASHFREE_PAYOUTS_FIX_SUMMARY.md` - What was changed in the code
- `CASHFREE_PAYOUTS_SETUP.md` - Complete setup guide
- `CASHFREE_PAYOUTS_TROUBLESHOOTING.md` - Detailed troubleshooting
- `test-cashfree-beneficiary.md` - Direct API testing with cURL

---

## 🎯 Priority Actions

**RIGHT NOW:**
1. Add the 3 environment variables to Supabase (5 minutes)
2. Test from driver app
3. Check edge function logs

**AFTER THAT:**
1. Verify beneficiary appears in Cashfree dashboard
2. Test withdrawal request flow
3. Test admin approval and payout processing

---

## ✉️ Support Contacts

- **Cashfree Support:** care@cashfree.com
- **Supabase Docs:** https://supabase.com/docs/guides/functions/secrets
- **Cashfree Payouts API:** https://docs.cashfree.com/reference/add-beneficiary

---

## Summary

The code is fixed and ready. You just need to add the environment variables to Supabase, and everything should work. Follow `QUICK_FIX_STEPS.md` for the fastest path to success!
