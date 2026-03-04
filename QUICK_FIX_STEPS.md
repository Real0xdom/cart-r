# Quick Fix - Add Missing Environment Variables

## The Issue
Your edge function returns: **503 - Cashfree Payouts credentials not configured**

This means you need to add environment variables to Supabase.

---

## 🚀 Quick Fix (5 minutes)

### Step 1: Get Cashfree Credentials

1. Open https://merchant.cashfree.com
2. Click **Payouts** (top menu)
3. Go to **Developers** → **API Keys**
4. Copy your **App ID** and **Secret Key**

### Step 2: Add to Supabase

1. Open https://supabase.com/dashboard/project/epevjbiymsvwmmzybzib
2. Click **⚙️ Project Settings** (bottom left)
3. Click **Edge Functions** (left sidebar)
4. Scroll down to **Environment Variables**
5. Click **Add Variable** button

Add these 3 variables one by one:

**Variable 1:**
```
Name: CASHFREE_PG_APP_ID
Value: [paste your Cashfree Payouts App ID]
```

**Variable 2:**
```
Name: CASHFREE_PG_SECRET_KEY
Value: [paste your Cashfree Payouts Secret Key]
```

**Variable 3:**
```
Name: CASHFREE_PG_ENV
Value: sandbox
```

6. Click **Save** after each variable

### Step 3: Test

1. Go back to your driver app
2. Try adding bank details again
3. The 503 error should be gone!

---

## ✅ Verification

After adding variables, you should see them listed in:
**Project Settings → Edge Functions → Environment Variables**

The values will be masked (••••••) for security.

---

## 🔍 What Happens Next

Once variables are added:

1. **If you get 200 OK** → Check Cashfree dashboard for beneficiary
2. **If you get 403 - IP not whitelisted** → Add IP in Cashfree dashboard
3. **If you get 403 - Token invalid** → Double-check credentials
4. **If you get 403 - APIs not enabled** → Email care@cashfree.com
5. **If you get 409 - Already exists** → Great! Beneficiary was already created

---

## 📝 Important Notes

- Use **Payouts** credentials (not Payment Gateway)
- Variable names must be EXACT (case-sensitive)
- No need to redeploy edge functions after adding variables
- Start with `sandbox` environment for testing

---

## 🆘 Still Not Working?

Check these documents:
- `ADD_CASHFREE_ENV_VARS.md` - Detailed instructions
- `CASHFREE_PAYOUTS_TROUBLESHOOTING.md` - Common issues
- `test-cashfree-beneficiary.md` - Test API directly

Or contact:
- Cashfree Support: care@cashfree.com
- Your project ref: `epevjbiymsvwmmzybzib`
