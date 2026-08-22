# Cashfree Payouts - Quick Setup Guide

## What You Need to Do Right Now

### 1. Verify Your Cashfree Payouts Credentials

You should already have these configured:
- `CASHFREE_PG_APP_ID` (Payouts Gateway App ID)
- `CASHFREE_PG_SECRET_KEY` (Payouts Gateway Secret Key)

**Important:** Don't confuse these with Payment Gateway credentials:
- **Payment Gateway** (for customer payments): `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`
- **Payouts Gateway** (for driver withdrawals): `CASHFREE_PG_APP_ID`, `CASHFREE_PG_SECRET_KEY`

### 2. Verify Environment Variables in Supabase

1. Go to your Supabase Dashboard
2. Navigate to **Project Settings > Edge Functions**
3. Verify these three variables exist:

```
CASHFREE_PG_APP_ID=your_payout_app_id_here
CASHFREE_PG_SECRET_KEY=your_payout_secret_key_here
CASHFREE_PG_ENV=sandbox
```

**Note:** Start with `sandbox` for testing. Change to `production` when ready.

### 3. Whitelist Your IP or Setup Public Key Auth

**Option A: IP Whitelisting (Simpler)**
1. In Cashfree Dashboard: **Developers > Two-Factor Authentication**
2. Add your server IP addresses
3. For Supabase, you may need to contact their support for IP ranges

**Option B: Public Key Auth (Recommended if no static IP)**
1. In Cashfree Dashboard: **Developers > Two-Factor Authentication**
2. Generate a Public Key
3. Download the key file
4. Password is your registered email ID
5. Use this to generate `x-cf-signature` header (advanced)

### 4. Enable Payouts API

1. Email **care@cashfree.com** from your registered email
2. Subject: "Enable Payouts API"
3. Include:
   - Your Client ID
   - Environment (Test/Production)
   - Brief description of use case (driver payouts)

Wait for confirmation (usually 24-48 hours).

### 5. Redeploy Edge Functions

After adding environment variables:

```bash
# If using Supabase CLI
supabase functions deploy create-beneficiary
supabase functions deploy process-withdrawal
```

Or redeploy from Supabase Dashboard.

### 6. Test the Integration

1. In your driver app, add bank account details
2. Check Supabase Edge Function logs for `create-beneficiary`
3. Look for Cashfree API response in logs
4. Verify beneficiary appears in Cashfree Dashboard under **Payouts > Beneficiaries**

---

## Expected Flow

```
Driver adds bank details in app
    ↓
Driver app calls create-beneficiary edge function
    ↓
Edge function calls Cashfree Payouts API
    ↓
Beneficiary created in Cashfree
    ↓
Database updated: beneficiary_status = 'active'
    ↓
Driver can now request withdrawals
```

---

## Troubleshooting

### Beneficiary not appearing in Cashfree?

Check these in order:

1. **Environment Variables Set?**
   - Go to Supabase Dashboard > Edge Functions > Settings
   - Verify all three variables are present

2. **Using Correct Credentials?**
   - Must be Payouts Gateway credentials (`CASHFREE_PG_APP_ID`)
   - NOT Payment Gateway credentials (`CASHFREE_APP_ID`)
   - Check in Cashfree Payouts section

3. **IP Whitelisted?**
   - Check Cashfree Dashboard > Developers > Two-Factor Authentication
   - Add your server IPs

4. **API Enabled?**
   - Email care@cashfree.com if you haven't already
   - Check for confirmation email

5. **Check Edge Function Logs**
   - Supabase Dashboard > Edge Functions > create-beneficiary > Logs
   - Look for error messages from Cashfree

6. **Correct Environment?**
   - If using sandbox, check Test dashboard
   - If using production, check Production dashboard
   - Don't mix them up!

### Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "IP not whitelisted" | Server IP not added | Add IP in Cashfree dashboard |
| "Token is not valid" | Wrong credentials | Verify using `CASHFREE_PG_*` variables |
| "APIs not enabled" | Payouts API not activated | Email care@cashfree.com |
| "Post data is empty" | Invalid payload | Check edge function logs |

---

## What Changed in the Code

We fixed the API payload structure:

1. **API Payload Field Names**
   - Before: Used incorrect field names (`beneficiary_id`, `beneficiary_name`, etc.)
   - After: Uses correct Cashfree Payouts API v1 format (`beneId`, `name`, `email`, etc.)

2. **Required Fields**
   - Added mandatory address fields with default values
   - Added default email/phone if driver data is incomplete

Files updated:
- `supabase/functions/create-beneficiary/index.ts`
- `supabase/functions/process-withdrawal/index.ts`

**Note:** The environment variables (`CASHFREE_PG_*`) were already correct.

---

## Next Steps After Setup

Once beneficiaries are working:

1. Test withdrawal request from driver app
2. Test admin approval in admin panel
3. Test actual payout processing
4. Monitor transactions in Cashfree dashboard
5. Set up production credentials when ready

---

## Need Help?

- **Cashfree Support:** care@cashfree.com
- **Cashfree Docs:** https://docs.cashfree.com/docs/payouts
- **API Reference:** https://docs.cashfree.com/reference/add-beneficiary

For detailed troubleshooting, see `CASHFREE_PAYOUTS_TROUBLESHOOTING.md`
