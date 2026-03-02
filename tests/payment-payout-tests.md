# CartR — Payment, Payout & Flow Test Suite
**Stack:** React Native (Expo) / Next.js Admin / Supabase  
**Test Tool:** Playwright (admin web) + manual API tests via Supabase SQL Editor  
**Auto Runner:** `npx playwright test` for admin tests; Supabase SQL for DB-level tests

---

## ⚠️ CRITICAL GAP FOUND (Fix Before Testing)

> **Driver wallet balance is calculated from completed bookings (`driver_payout` field), NOT from a separate wallet.**
> When a customer pays from wallet, the money is deducted from `users.balance`, booking is marked `paid` — **but no money is automatically credited to the driver's payout balance.**
> 
> **How the driver gets paid:**  
> `get_driver_balance(driver_id)` = SUM of `driver_payout` on all `completed` bookings by that driver  
> The driver's wallet balance **is not a separate table** — it is derived at query time from bookings.  
> So the flow is:
> 1. Booking is created → `driver_payout` field is set (total_fare minus platform cut)
> 2. Booking is completed → driver's wallet balance automatically goes up (derived)
> 3. Driver requests withdrawal → deducted from that derived balance
> 
> **What this means for wallet payments:**  
> Customer wallet payment → marks booking `paid`, sets `payment_method = 'wallet'`  
> Then booking completes → driver's balance includes `driver_payout` from that booking ✅  
> **This WORKS correctly — but only if the booking is marked `completed` after the ride ends.**

---

## TEST CATEGORIES

### 🟢 CATEGORY 1: Customer Wallet Flow

#### TC-W01: Add Money to Customer Wallet
- **Precondition:** Customer logged in, no balance  
- **Steps:**  
  1. Go to Wallet screen  
  2. Tap "Add Money" → enter ₹500  
  3. Pay via Cashfree PG (use test card: 4111 1111 1111 1111)  
  4. After success, check wallet balance  
- **Expected:** `users.balance += 500`, `wallet_transactions` has a `credit` entry  
- **SQL Verify:**  
  ```sql
  SELECT balance FROM users WHERE id = '<customer_id>';
  SELECT * FROM wallet_transactions WHERE user_id = '<customer_id>' ORDER BY created_at DESC LIMIT 1;
  ```

#### TC-W02: Customer Pays Full Booking from Wallet
- **Precondition:** Customer has ₹500+ balance, completed booking awaiting payment  
- **Steps:**  
  1. At payment screen, select "Pay from Wallet"  
  2. Confirm payment  
- **Expected:**  
  - `users.balance` decreases by `total_fare`  
  - `bookings.payment_status = 'paid'`  
  - `bookings.payment_method = 'wallet'`  
  - `wallet_transactions` has a `debit` entry  
- **SQL Verify:**  
  ```sql
  SELECT payment_status, payment_method, wallet_amount_used FROM bookings WHERE id = '<booking_id>';
  SELECT * FROM wallet_transactions WHERE booking_id = '<booking_id>';
  ```

#### TC-W03: Insufficient Wallet Balance — Should Fail Gracefully
- **Precondition:** Customer has ₹50, booking total is ₹200  
- **Steps:** Select "Pay from Wallet" and confirm  
- **Expected:** Error message "Insufficient balance", booking stays `unpaid`  
- **SQL Direct Test:**  
  ```sql
  SELECT pay_with_wallet('<booking_id>', '<user_id>', true);
  -- Should return: {"success": false, "error": "Insufficient balance", ...}
  ```

#### TC-W04: Partial Wallet + Online Payment
- **Precondition:** Customer has ₹100, booking total is ₹200  
- **Steps:** Select "Use wallet + Pay remaining online", complete Cashfree payment  
- **Expected:**  
  - `wallet_amount_used = 100`  
  - `payment_method = 'wallet_plus_online'`  
  - `payment_status = 'paid'`  
- **SQL Verify:**  
  ```sql
  SELECT payment_status, payment_method, wallet_amount_used FROM bookings WHERE id = '<booking_id>';
  ```

#### TC-W05: Double Payment — Idempotency Check
- **Steps:** Call `pay_with_wallet` RPC twice with same booking ID  
- **Expected:** Second call returns `{"success": false, "error": "Already paid"}`  
- **SQL Direct Test:**  
  ```sql
  -- First call succeeds
  SELECT pay_with_wallet('<booking_id>', '<user_id>', true);
  -- Second call should fail
  SELECT pay_with_wallet('<booking_id>', '<user_id>', true);
  ```

---

### 🟡 CATEGORY 2: Driver Earnings & Wallet Flow

#### TC-D01: Driver Balance Increases After Ride Completes
- **Precondition:** Driver has accepted a booking, ride is `in_progress`  
- **Steps:** Mark ride as `completed` (delivery OTP confirmed)  
- **Expected:** `get_driver_balance(driver_id)` increases by `driver_payout` of that booking  
- **SQL Verify:**  
  ```sql
  SELECT get_driver_balance('<driver_id>');
  SELECT driver_payout, status, payment_method FROM bookings 
  WHERE driver_id = '<driver_id>' AND status = 'completed' ORDER BY completed_at DESC LIMIT 5;
  ```

#### TC-D02: Driver Adds Bank Account — Auto Beneficiary Created
- **Precondition:** Driver logged in, no bank details  
- **Steps:**  
  1. Go to Bank Details screen  
  2. Fill in: Name, Account Number, IFSC, Bank Name  
  3. Tap "Save"  
- **Expected:**  
  - `drivers.bank_details` updated  
  - `drivers.beneficiary_id` = `CARTR_DRV_<first 8 chars of driver_id>`  
  - `drivers.beneficiary_status = 'active'`  
  - Cashfree sandbox shows the beneficiary  
- **SQL Verify:**  
  ```sql
  SELECT bank_details, beneficiary_id, beneficiary_status FROM drivers WHERE id = '<driver_id>';
  ```

#### TC-D03: Driver Requests Withdrawal
- **Precondition:** Driver has ≥ ₹100 balance and has bank details  
- **Steps:** Enter ₹100 in withdrawal field, tap Withdraw  
- **Expected:**  
  - `withdrawals` table has new row: `status = 'pending'`, `amount = 100`  
  - `get_driver_balance(driver_id)` decreases by 100 (pending withdrawals are deducted)  
- **SQL Verify:**  
  ```sql
  SELECT * FROM withdrawals WHERE driver_id = '<driver_id>' ORDER BY created_at DESC LIMIT 1;
  SELECT get_driver_balance('<driver_id>');
  ```

#### TC-D04: Driver Cannot Overdraw Balance
- **Steps:** Try requesting withdrawal for more than available balance  
- **Expected:** Error "Insufficient balance: ₹X"  
- **SQL Direct Test:**  
  ```sql
  SELECT request_withdrawal('<driver_id>', 999999.00, 'test-key-01');
  ```

#### TC-D05: Duplicate Withdrawal Request — Idempotency
- **Steps:** Call `request_withdrawal` twice with the same idempotency key  
- **Expected:** Second returns `{"success": false, "error": "Withdrawal already requested with this key"}`  
- **SQL Direct Test:**  
  ```sql
  SELECT request_withdrawal('<driver_id>', 100.00, 'test-idem-key-abc');
  SELECT request_withdrawal('<driver_id>', 100.00, 'test-idem-key-abc'); -- should fail
  ```

---

### 🔵 CATEGORY 3: Admin Payout Approval Flow

#### TC-A01: Admin Sees All Pending Withdrawals
- **Steps:** Log into admin console → Payouts tab  
- **Expected:** All `pending` withdrawals visible with driver name, amount, bank details  
- **API Test:**  
  ```
  GET /api/withdrawals?status=pending
  → Should return array of withdrawals with driver info
  ```

#### TC-A02: Admin Approves Withdrawal — Auto Bank Transfer Triggered
- **Steps:**  
  1. Find a pending withdrawal in admin console  
  2. Click "Approve"  
- **Expected:**  
  - `withdrawals.status = 'approved'`  
  - `process-withdrawal` edge function fires  
  - Cashfree `/authorize` is called successfully  
  - Cashfree `/requestTransfer` is called  
  - `withdrawals.payout_status = 'INITIATED'`  
  - `withdrawals.payout_reference` has the transfer ID  
- **SQL Verify:**  
  ```sql
  SELECT status, payout_status, payout_reference, payout_error 
  FROM withdrawals WHERE id = '<withdrawal_id>';
  ```

#### TC-A03: Admin Rejects Withdrawal — Balance Refunded to Driver
- **Steps:**  
  1. Find a pending withdrawal  
  2. Click "Reject" → enter reason → confirm  
- **Expected:**  
  - `withdrawals.status = 'rejected'`  
  - Driver's available balance goes back up (pending withdrawal removed from deduction)  
- **SQL Verify:**  
  ```sql
  SELECT status FROM withdrawals WHERE id = '<withdrawal_id>';
  SELECT get_driver_balance('<driver_id>'); -- should be higher than before
  ```

#### TC-A04: Admin Marks Withdrawal as Paid (Manual)
- **Steps:** Find an `approved` withdrawal → click "Mark Paid"  
- **Expected:** `withdrawals.status = 'paid'`, `processed_at` timestamp set  
- **SQL Verify:**  
  ```sql
  SELECT status, processed_at FROM withdrawals WHERE id = '<withdrawal_id>';
  ```

#### TC-A05: Admin Cannot Double-Approve
- **Steps:** Try calling approve API on an already `approved` or `paid` withdrawal  
- **Expected:** `process-withdrawal` edge function returns error  
  `"Withdrawal must be approved first (current: approved)"`

---

### 🔴 CATEGORY 4: Beneficiary Registration Edge Cases

#### TC-B01: Driver Without Beneficiary Cannot Trigger Auto-Payout
- **Precondition:** Driver has bank details but `beneficiary_status != 'active'`  
- **Steps:** Admin approves their withdrawal  
- **Expected:** `process-withdrawal` returns error:  
  `"Driver is not registered as Cashfree beneficiary. Register first."`  
- **What to do:** Driver must re-save bank details to re-trigger `create-beneficiary`

#### TC-B02: Re-registering Already Active Beneficiary
- **Steps:** Driver with `beneficiary_status = 'active'` saves bank details again  
- **Expected:** `create-beneficiary` returns early with `{"success": true, "message": "Already registered"}` — no duplicate created in Cashfree

#### TC-B03: Invalid Bank Account Details
- **Steps:** Driver enters an invalid IFSC code (e.g. `INVALID000`)  
- **Expected:** Cashfree rejects — `beneficiary_status = 'failed'`, driver sees error alert

---

### 🟣 CATEGORY 5: End-to-End Full Payment Flow

#### TC-E01: Full Happy Path — Wallet Payment to Driver Payout
1. **Customer** tops up wallet with ₹500 via Cashfree PG
2. **Customer** books a ride
3. **Driver** accepts and completes the ride
4. **Customer** pays ₹200 from wallet → booking marked `paid`
5. **Driver** checks wallet balance → should now show ₹200 (from `driver_payout`)
6. **Driver** requests withdrawal of ₹200 → status `pending`
7. **Admin** approves → `process-withdrawal` fires → Cashfree initiates bank transfer
8. Admin sees `payout_status = 'INITIATED'`

**SQL Full Verification:**
```sql
-- Step 1: Customer wallet topped up?
SELECT balance FROM users WHERE id = '<customer_id>';

-- Step 4: Booking paid with wallet?
SELECT payment_status, payment_method, wallet_amount_used FROM bookings WHERE id = '<booking_id>';

-- Step 5: Driver balance reflects completed ride?
SELECT get_driver_balance('<driver_id>');

-- Step 6: Withdrawal request created?
SELECT * FROM withdrawals WHERE driver_id = '<driver_id>' ORDER BY created_at DESC LIMIT 1;

-- Step 8: Bank transfer initiated?
SELECT payout_status, payout_reference, payout_error FROM withdrawals WHERE driver_id = '<driver_id>' AND status = 'approved';
```

#### TC-E02: Customer Cancels After Driver Assigned — Refund Check
1. Customer books → driver accepts → customer cancels
2. If customer paid via wallet before cancel → check if refund is issued  
**Note:** Check cancellation RPC for refund logic. If missing, wallet is NOT auto-refunded — this is a gap!

---

## 🛠 HOW TO RUN TESTS

### Option A: Admin Playwright Tests (Web)
```bash
# Install (one-time)
npm install -D @playwright/test
npx playwright install chromium

# Create test file: tests/admin.spec.ts
# Run tests
npx playwright test tests/admin.spec.ts --headed
```

### Option B: Supabase SQL Direct (DB Tests — Run in Supabase SQL Editor)
Copy any SQL block from this document into the **Supabase SQL Editor** in your project dashboard.  
Replace `<customer_id>`, `<driver_id>`, `<booking_id>`, `<withdrawal_id>` with actual IDs from your DB.

### Option C: API Tests (Admin REST API)
Use **Hoppscotch** (free, browser-based) or **Bruno** (free, open source Postman alternative):
```
Base URL: http://localhost:3000
GET  /api/withdrawals?status=all
GET  /api/withdrawals?status=pending
POST /api/withdrawals  { "action": "approve", "withdrawalId": "..." }
POST /api/withdrawals  { "action": "reject", "withdrawalId": "...", "reason": "..." }
POST /api/withdrawals  { "action": "mark_paid", "withdrawalId": "..." }
```

---

## 📋 QUICK TEST CHECKLIST

| Test | Status | Notes |
|------|--------|-------|
| TC-W01: Customer tops up wallet | ⬜ | |
| TC-W02: Full wallet payment | ⬜ | |
| TC-W03: Insufficient balance error | ⬜ | |
| TC-W04: Partial wallet + online | ⬜ | |
| TC-W05: Idempotency — double payment | ⬜ | |
| TC-D01: Driver balance after ride | ⬜ | |
| TC-D02: Bank account → auto beneficiary | ⬜ | |
| TC-D03: Withdrawal request | ⬜ | |
| TC-D04: Overdraw prevented | ⬜ | |
| TC-D05: Idempotency — duplicate withdrawal | ⬜ | |
| TC-A01: Admin sees withdrawals | ⬜ | |
| TC-A02: Approve → auto bank transfer | ⬜ | |
| TC-A03: Reject → balance refunded | ⬜ | |
| TC-A04: Mark paid | ⬜ | |
| TC-A05: No double-approve | ⬜ | |
| TC-B01: No beneficiary → payout blocked | ⬜ | |
| TC-B02: Re-register idempotency | ⬜ | |
| TC-B03: Invalid IFSC → fails gracefully | ⬜ | |
| TC-E01: Full end-to-end happy path | ⬜ | |
| TC-E02: Cancel after payment — refund | ⬜ | |
