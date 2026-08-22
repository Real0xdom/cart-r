# Bank Registration Testing Guide

## ✅ Deployment Status

**create-beneficiary** function has been successfully deployed!
- **Status**: ACTIVE
- **Version**: 16
- **Deployed**: March 9, 2026 at 04:49:04 UTC
- **Project**: epevjbiymsvwmmzybzib

## 🧪 How to Test

### Option 1: Through the Driver App (Recommended)

1. **Open the Driver App** on your Android device/emulator
2. **Navigate to Profile/Bank Details** section
3. **Add Bank Details** using the sandbox test credentials:
   ```
   Account Holder Name: John Doe
   Bank Name: Yes Bank
   Account Number: 026291800001191
   IFSC Code: YESB0000262
   ```
4. **Click "Save Details"**

### Expected Results:

#### First-Time Registration:
```
✅ Success alert: "Bank details saved"
✅ Bank card appears in UI showing:
   - Bank name (masked account number)
   - Account holder name
   - "Primary" badge
✅ Admin receives notification: "🏦 New Bank Account Registered"
✅ Console logs show:
   - Edge function response with beneficiary_id
   - Cashfree response with status "VERIFIED"
```

#### Duplicate Registration (Same Driver):
```
⚠️ Alert: "This bank account is already registered"
✅ But still succeeds (no error)
✅ UI updates to show bank details
✅ No duplicate entry created
```

### Option 2: Using Browser Console

If you have the driver app running in a web browser or React Native debugger:

1. Open browser console (F12 or Cmd+Option+J)
2. Run the test script:
   ```bash
   node test_bank_registration.js
   ```
   Or copy-paste the function from `test_bank_registration.js` into the console

### Option 3: Direct API Test

```bash
curl -X POST'https://epevjbiymsvwmmzybzib.supabase.co/functions/v1/create-beneficiary' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"driver_id": "YOUR_DRIVER_ID"}'
```

## 📊 What to Monitor

### Console Logs to Watch For:

**Success Flow:**
```
=== CREATE BENEFICIARY EDGE FUNCTION START ===
Environment: sandbox
Credentials present: { appId: true, secretKey: true }
Driver found: { id: ..., beneficiary_id: null }
Sending to Cashfree...
📥 Cashfree Response: { success: true, ... }
✅ Success: Beneficiary created successfully
Sending admin notification...
Admin notification: { sent: true }
=== CREATE BENEFICIARY EDGE FUNCTION END (SUCCESS) ===
```

**Conflict Resolution (Already Exists):**
```
=== CREATE BENEFICIARY EDGE FUNCTION START ===
📥 Cashfree Response: { code: 'conflict_with_existing_beneficiary', ... }
⚠️ Beneficiary already exists in Cashfree, verifying ownership...
Existing beneficiary from Cashfree: { ... }
✅ Success: Verified beneficiary belongs to this driver
Sending admin notification...
=== CREATE BENEFICIARY EDGE FUNCTION END (SUCCESS - VERIFIED) ===
```

**Error (Different Driver):**
```
=== CREATE BENEFICIARY EDGE FUNCTION START ===
❌ Conflict: Bank account belongs to another driver
=== CREATE BENEFICIARY EDGE FUNCTION END (CONFLICT - OTHER DRIVER) ===
```

## ✅ Success Indicators

1. **UI Updates Immediately**:
   - Bank details card appears after successful registration
   - Shows masked account number (e.g., `****1191`)
   - Edit button available

2. **Database Updated**:
   ```sql
   SELECT beneficiary_id, beneficiary_status 
   FROM drivers 
   WHERE id = 'YOUR_DRIVER_ID';
   
   -- Expected:
   -- beneficiary_id: CARTR_DRV_xxxxxxxx
   -- beneficiary_status: active
   ```

3. **Admin Notification Received**:
   - Push notification with title"🏦 New Bank Account Registered"
   - Contains driver_id and beneficiary_id in data

4. **Cashfree Dashboard**:
   - Log into Cashfree Payouts dashboard
   - Check beneficiaries list
   - Should see `CARTR_DRV_xxxxxxxx` with status "VERIFIED"

## ⚠️ Troubleshooting

### Issue: "Failed to register bank for payouts"

**Check:**
1. Cashfree credentials are set in Supabase secrets
2. Verify CASHFREE_PAYOUT_APP_ID and CASHFREE_PAYOUT_SECRET_KEY
3. Check edge function logs for specific error

### Issue: "Bank account already registered"

**This is expected behavior if:**
- The same bank account was used before
- The system will verify ownership and still succeed
- UI should update normally

### Issue: No admin notification

**Check:**
1. send-notification function is deployed
2. Admin user exists in users table
3. Expo push token is configured (if testing push notifications)

## 🔍 Debug Commands

### Check Function Status:
```bash
supabase functions list
```

### View Function Logs:
```bash
supabase functions logs create-beneficiary
```

### Test with Debug Mode:
```bash
supabase functions deploy create-beneficiary --debug
```

## 📝 Test Cases Checklist

- [ ] **New driver adds bank account** → Should succeed
- [ ] **Same driver adds same account again** → Should show message but succeed
- [ ] **Different driver tries same account** → Should fail with clear error
- [ ] **Invalid IFSC code** → Should fail with validation error
- [ ] **Invalid account number** → Should fail with validation error
- [ ] **Admin receives notification** → Check notification center
- [ ] **UI updates immediately** → Bank card appears without refresh
- [ ] **Database synced** → beneficiary_id and status updated

## 🎯 Next Steps After Testing

1. **Verify all test cases pass**
2. **Check admin notifications are received**
3. **Monitor Cashfree dashboard for beneficiary creation**
4. **Test withdrawal flow with registered bank**
5. **Update production environment when ready**

---

**Testing Support**: If you encounter any issues, check the edge function logs and share the complete error message.
