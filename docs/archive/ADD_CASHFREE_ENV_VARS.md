# Add Cashfree Payouts Environment Variables to Supabase

## The Problem
Your edge function is returning 503 error with message: "Cashfree Payouts credentials not configured"

This means the environment variables are missing in Supabase.

## Solution: Add Environment Variables

### Step 1: Get Your Cashfree Payouts Credentials

1. Login to https://merchant.cashfree.com
2. Navigate to **Payouts** section (NOT Payment Gateway)
3. Go to **Developers > API Keys**
4. Copy your:
   - **App ID** (Client ID)
   - **Secret Key** (Client Secret)

### Step 2: Add to Supabase Dashboard

#### Option A: Via Supabase Dashboard (Recommended)

1. Go to https://supabase.com/dashboard
2. Select your project: `epevjbiymsvwmmzybzib`
3. Navigate to **Project Settings** (gear icon in sidebar)
4. Click on **Edge Functions** in the left menu
5. Scroll to **Environment Variables** section
6. Click **Add Variable** and add these THREE variables:

```
Name: CASHFREE_PG_APP_ID
Value: your_payout_app_id_here
```

```
Name: CASHFREE_PG_SECRET_KEY
Value: your_payout_secret_key_here
```

```
Name: CASHFREE_PG_ENV
Value: sandbox
```

7. Click **Save** after adding each variable

#### Option B: Via Supabase CLI

If you prefer using CLI:

```bash
# Set the variables
supabase secrets set CASHFREE_PG_APP_ID=your_payout_app_id_here
supabase secrets set CASHFREE_PG_SECRET_KEY=your_payout_secret_key_here
supabase secrets set CASHFREE_PG_ENV=sandbox
```

### Step 3: Verify Variables Are Set

After adding the variables, you can verify them in the dashboard:

1. Go to **Project Settings > Edge Functions**
2. Check that all three variables appear in the list
3. Values should be masked (hidden) for security

### Step 4: Test Again

The edge functions will automatically use the new environment variables. No need to redeploy!

1. In your driver app, try adding bank details again
2. The 503 error should be gone
3. Check the edge function logs for the actual Cashfree API response

## Important Notes

### About CASHFREE_PG_* Variables

- `CASHFREE_PG_APP_ID` = Payouts Gateway App ID (NOT Payment Gateway)
- `CASHFREE_PG_SECRET_KEY` = Payouts Gateway Secret Key
- `CASHFREE_PG_ENV` = Environment (sandbox or production)

### Don't Confuse With Payment Gateway

You should have TWO sets of Cashfree credentials:

**Payment Gateway** (for customer payments):
- `EXPO_PUBLIC_CASHFREE_APP_ID`
- `CASHFREE_SECRET_KEY`
- `CASHFREE_ENVIRONMENT`

**Payouts Gateway** (for driver withdrawals):
- `CASHFREE_PG_APP_ID` ← Missing!
- `CASHFREE_PG_SECRET_KEY` ← Missing!
- `CASHFREE_PG_ENV` ← Missing!

## After Adding Variables

Once you add the environment variables, the flow should work:

```
Driver adds bank details
    ↓
create-beneficiary edge function runs
    ↓
Reads CASHFREE_PG_* environment variables ✓
    ↓
Calls Cashfree Payouts API
    ↓
Creates beneficiary in Cashfree
    ↓
Updates database: beneficiary_status = 'active'
```

## Troubleshooting

### Still getting 503 error?

1. **Double-check variable names** - Must be exactly:
   - `CASHFREE_PG_APP_ID` (not `CASHFREE_PAYOUT_APP_ID`)
   - `CASHFREE_PG_SECRET_KEY` (not `CASHFREE_PAYOUT_SECRET_KEY`)
   - `CASHFREE_PG_ENV` (not `CASHFREE_PAYOUT_ENV`)

2. **Check for typos** - Copy-paste the variable names to avoid typos

3. **Verify values** - Make sure you copied the correct credentials from Cashfree Payouts section

4. **Wait a moment** - Sometimes it takes a few seconds for variables to propagate

### Getting different error after adding variables?

Good! That means the variables are working. Check the new error:

- **403 - IP not whitelisted** → Add your IP in Cashfree dashboard
- **403 - Token invalid** → Wrong credentials, verify them
- **403 - APIs not enabled** → Email care@cashfree.com
- **409 - Already exists** → Beneficiary already created (this is OK!)
- **200 - Success** → Perfect! Check Cashfree dashboard for beneficiary

## Quick Checklist

- [ ] Logged into Cashfree Merchant Dashboard
- [ ] Navigated to Payouts section (not Payment Gateway)
- [ ] Copied App ID and Secret Key from Payouts
- [ ] Added `CASHFREE_PG_APP_ID` to Supabase
- [ ] Added `CASHFREE_PG_SECRET_KEY` to Supabase
- [ ] Added `CASHFREE_PG_ENV=sandbox` to Supabase
- [ ] Saved all variables
- [ ] Tested from driver app again

## Next Steps

After adding the environment variables:

1. Test the beneficiary creation from driver app
2. Check edge function logs for Cashfree API response
3. Verify beneficiary appears in Cashfree Dashboard
4. If you get other errors, refer to `CASHFREE_PAYOUTS_TROUBLESHOOTING.md`

---

**Need Help?**
- Cashfree Support: care@cashfree.com
- Supabase Docs: https://supabase.com/docs/guides/functions/secrets
