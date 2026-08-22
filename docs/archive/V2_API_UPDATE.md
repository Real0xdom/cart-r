# ✅ Updated to Cashfree Payouts V2 API

## What Changed

The edge functions have been updated from Cashfree Payouts V1 API to V2 API.

---

## Key Differences: V1 vs V2

### Base URLs

**V1:**
- Sandbox: `https://payout-gamma.cashfree.com`
- Production: `https://payout-api.cashfree.com`

**V2:**
- Sandbox: `https://sandbox.cashfree.com`
- Production: `https://api.cashfree.com`

### Headers

**V1:**
```
X-Client-Id: your_client_id
X-Client-Secret: your_client_secret
```

**V2:**
```
x-client-id: your_client_id
x-client-secret: your_client_secret
x-api-version: 2024-01-01
```

### Create Beneficiary Endpoint

**V1:**
- Endpoint: `POST /payout/v1/addBeneficiary`
- Payload:
```json
{
  "beneId": "DRIVER_123",
  "name": "Driver Name",
  "email": "driver@email.com",
  "phone": "9876543210",
  "bankAccount": "00111122233",
  "ifsc": "HDFC0000001",
  "address1": "Address",
  "city": "City",
  "state": "State",
  "pincode": "000000"
}
```

**V2:**
- Endpoint: `POST /payout/beneficiary`
- Payload:
```json
{
  "beneficiary_id": "DRIVER_123",
  "beneficiary_name": "Driver Name",
  "beneficiary_instrument_details": {
    "bank_account_number": "00111122233",
    "bank_ifsc": "HDFC0000001"
  },
  "beneficiary_contact_details": {
    "beneficiary_email": "driver@email.com",
    "beneficiary_phone": "9876543210"
  }
}
```

### Transfer Endpoint

**V1:**
- Endpoint: `POST /payout/v1/requestTransfer`
- Payload:
```json
{
  "bene_id": "DRIVER_123",
  "amount": "1000",
  "transfer_id": "TXN_123",
  "transfer_mode": "banktransfer",
  "remarks": "Payout"
}
```

**V2:**
- Endpoint: `POST /payout/transfer`
- Payload:
```json
{
  "transfer_id": "TXN_123",
  "beneficiary_id": "DRIVER_123",
  "amount": 1000,
  "remarks": "Payout"
}
```

---

## What Was Updated

### 1. create-beneficiary Edge Function

**Changes:**
- ✅ Updated base URL to V2 endpoints
- ✅ Changed headers to lowercase with `x-api-version`
- ✅ Updated payload structure to V2 format
- ✅ Removed unnecessary address fields (not required in V2)
- ✅ Nested bank details in `beneficiary_instrument_details`
- ✅ Nested contact details in `beneficiary_contact_details`

### 2. process-withdrawal Edge Function

**Changes:**
- ✅ Updated base URL to V2 endpoints
- ✅ Changed headers to lowercase with `x-api-version`
- ✅ Updated payload structure to V2 format
- ✅ Changed `bene_id` to `beneficiary_id`
- ✅ Changed amount from string to number
- ✅ Removed `transfer_mode` (not needed in V2)

---

## Deployment Status

✅ Both functions deployed successfully with V2 API support

---

## Testing

### Test Create Beneficiary

1. Open driver app
2. Go to Profile → Bank Details
3. Add bank account details
4. Click Save

### Check Logs

Go to Supabase Dashboard → Edge Functions → create-beneficiary → Logs

Look for:
```
Creating beneficiary: CARTR_DRV_xxxxxxxx
Payload: {
  "beneficiary_id": "CARTR_DRV_xxxxxxxx",
  "beneficiary_name": "Driver Name",
  "beneficiary_instrument_details": {
    "bank_account_number": "1234567890",
    "bank_ifsc": "HDFC0001234"
  },
  "beneficiary_contact_details": {
    "beneficiary_email": "driver@email.com",
    "beneficiary_phone": "9876543210"
  }
}
Cashfree HTTP status: 200
Cashfree response: { ... }
```

### Verify in Cashfree Dashboard

1. Login to https://merchant.cashfree.com
2. Go to **Payouts** → **Beneficiaries**
3. Look for beneficiary: `CARTR_DRV_xxxxxxxx`
4. Status should be **ACTIVE**

---

## Expected V2 API Responses

### Success (200 OK)
```json
{
  "beneficiary_id": "CARTR_DRV_12345678",
  "beneficiary_name": "Driver Name",
  "beneficiary_instrument_details": {
    "bank_account_number": "1234567890",
    "bank_ifsc": "HDFC0001234"
  },
  "beneficiary_contact_details": {
    "beneficiary_email": "driver@email.com",
    "beneficiary_phone": "9876543210"
  },
  "status": "ACTIVE"
}
```

### Already Exists (409 Conflict)
```json
{
  "message": "Beneficiary already exists",
  "code": "beneficiary_already_exists"
}
```

### Invalid Request (400 Bad Request)
```json
{
  "message": "Invalid bank account number",
  "code": "invalid_bank_account"
}
```

### Unauthorized (401)
```json
{
  "message": "Invalid credentials",
  "code": "unauthorized"
}
```

### IP Not Whitelisted (403)
```json
{
  "message": "IP not whitelisted",
  "code": "ip_not_whitelisted"
}
```

---

## Troubleshooting V2 API

### Issue: 403 - IP Not Whitelisted

**Solution:**
1. Go to Cashfree Dashboard
2. Navigate to **Payouts** → **Developers** → **Two-Factor Authentication**
3. Click **IP Whitelist**
4. Add your Supabase Edge Function IP addresses

**Alternative:** Use signature-based authentication (more complex)

### Issue: 401 - Unauthorized

**Causes:**
- Wrong Client ID or Client Secret
- Using Payment Gateway credentials instead of Payouts credentials

**Solution:**
1. Verify `CASHFREE_PAYOUT_APP_ID` in Supabase
2. Verify `CASHFREE_PAYOUT_SECRET_KEY` in Supabase
3. Get correct credentials from Cashfree Dashboard → Payouts → Developers → API Keys

### Issue: 400 - Invalid Bank Details

**Causes:**
- Invalid IFSC code format
- Invalid account number
- Missing required fields

**Solution:**
- Validate IFSC format: 4 letters + 7 digits (e.g., HDFC0001234)
- Ensure account number is numeric
- Check all required fields are present

### Issue: 200 OK but No Beneficiary in Dashboard

**Causes:**
- Checking wrong environment (sandbox vs production)
- Wrong Cashfree account

**Solution:**
1. Check `CASHFREE_ENV` value
2. If `sandbox`, check Test dashboard (click "Switch to Test")
3. If `production`, check Production dashboard
4. Verify you're logged into the correct Cashfree account

---

## API Documentation

- **V2 API Docs:** https://docs.cashfree.com/reference/payouts-api-overview
- **Create Beneficiary:** https://docs.cashfree.com/reference/create-beneficiary-v2
- **Create Transfer:** https://docs.cashfree.com/reference/create-transfer-v2
- **Getting Started:** https://docs.cashfree.com/docs/payouts-getting-started

---

## Summary

✅ Updated to Cashfree Payouts V2 API
✅ Fixed base URLs and endpoints
✅ Updated payload structures
✅ Updated headers with API version
✅ Deployed both edge functions

The integration now uses the latest V2 API. Test from your driver app and beneficiaries should appear in Cashfree dashboard!
