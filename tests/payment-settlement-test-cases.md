# Cartr — Payment Settlement QA Test Suite

**Apps Under Test:** Customer App (React Native), Driver App (React Native), Admin Console (Next.js)
**Backend:** Supabase (Postgres + Edge Functions), Cashfree PG / Payouts
**Date:** 2026-03-07

---

## Test Case Legend

| Symbol | Meaning |
|--------|---------|
| 🟢 | Happy path |
| 🟡 | Alternate flow |
| 🔴 | Negative / edge case |
| **P0** | Critical — blocks release |
| **P1** | High — must fix before production |
| **P2** | Medium — important but not blocking |

---

## 1. CASH PAYMENTS

### TC-CASH-01 🟢 P0 — Customer Selects Cash → Driver Collects at Trip End

**Preconditions:** Customer logged in, valid pickup/drop addresses set, driver available.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Customer opens booking screen, selects vehicle type | Fare estimate displayed (via `calculateFare`) |
| 2 | Customer taps **"Pay Cash — ₹{amount}"** button (`CashfreePayment.tsx → handleCashPayment`) | Booking created via `createBooking()` with `payment_method = 'cash'`, `payment_status = 'pending'` |
| 3 | Verify booking confirmation modal shows **Booking Number** and **Pickup OTP** | Modal displays both fields correctly |
| 4 | Driver accepts ride, picks up, navigates to destination | Booking status transitions: `pending → accepted → picked_up → in_progress` |
| 5 | Driver arrives at `collect-payment.tsx` screen | Screen shows "Amount to Collect: ₹{fare}", status badge = "PENDING" |
| 6 | Driver selects **Receiver** as payer, method defaults to **Cash** | `payer = 'receiver'`, `paymentMethod = 'cash'` |
| 7 | Driver enters 6-digit Delivery OTP and taps **"Confirm Payment & Complete"** | `handleCompleteTrip()` fires: booking updated with `status = 'completed'`, `payment_status = 'paid'`, `payment_method = 'cash'`, `completed_at` set |
| 8 | Driver sees success alert: "Trip Completed! 🎉 You earned ₹{driver_payout}" | Alert shown, navigates to home |

**SQL Verification:**
```sql
SELECT status, payment_status, payment_method, completed_at, driver_payout
FROM bookings WHERE id = '<booking_id>';
-- Expected: status='completed', payment_status='paid', payment_method='cash'
```

**Pass/Fail Criteria:** Booking reaches `completed` + `paid` with `payment_method = 'cash'`. Driver sees correct earnings.

---

### TC-CASH-02 🟢 P0 — Driver App Records Cash Collection Correctly

**Preconditions:** Booking exists, `status = 'in_progress'`, `payment_status = 'pending'`.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Driver opens collect-payment screen | `calculateTotal(booking)` displays `driver_payout` (or `total_fare` fallback) |
| 2 | Driver selects **Sender** as payer, taps **"Sender Paid Cash/Offline"** | `paymentMethod = 'cash'`, payer = 'sender' |
| 3 | Driver enters Delivery OTP, taps Complete | Booking update payload: `{ status: 'completed', payment_status: 'paid', payment_method: 'cash', completed_at, delivery_confirmed_at }` |
| 4 | Check `driver_wallet_transactions` table | New row: `type = 'earning'`, `amount = driver_payout`, `balance_type = 'pending'`, `direction = 'credit'` |

**SQL Verification:**
```sql
SELECT * FROM driver_wallet_transactions
WHERE booking_id = '<booking_id>' AND type = 'earning';
-- Expected: 1 row with credit amount matching driver_payout
```

**Pass/Fail Criteria:** `driver_wallet_transactions` has exactly 1 earning entry matching `driver_payout` from the booking.

---

### TC-CASH-03 🟢 P1 — Admin Console Reflects Cash Settlement in Trip Logs

**Preconditions:** TC-CASH-01 or TC-CASH-02 completed successfully.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Admin logs into console → navigates to **Bookings** page | Booking list loads |
| 2 | Search/filter for the completed booking | Booking row shows: status = `completed`, payment = `paid`, method = `cash` |
| 3 | Click booking to see details | Detail view shows: total fare, driver payout, payment method = "cash", timestamps |
| 4 | Navigate to **Driver** detail page | Driver's earnings section reflects the completed trip |

**Pass/Fail Criteria:** Admin console shows correct cash payment data matching database records.

---

### TC-CASH-04 🔴 P1 — Customer Cancels After Cash Booking → No Settlement

**Preconditions:** Customer booked with cash, driver assigned, ride NOT yet completed.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Customer cancels the booking (sets `cancellation_reason`) | Booking status → `cancelled`, `payment_status` remains `pending` (NOT `paid`) |
| 2 | Driver app receives cancellation via `subscribeToBooking` | Alert: "Ride Cancelled" with reason, driver redirected to home |
| 3 | Verify no wallet transaction created for driver | `driver_wallet_transactions` has NO entry for this `booking_id` |
| 4 | Admin console shows cancelled booking | Status = `cancelled`, no payment settlement visible |

**SQL Verification:**
```sql
SELECT status, payment_status FROM bookings WHERE id = '<booking_id>';
-- Expected: status='cancelled', payment_status='pending'

SELECT count(*) FROM driver_wallet_transactions WHERE booking_id = '<booking_id>';
-- Expected: 0
```

**Pass/Fail Criteria:** No payment settlement occurs. Driver wallet unaffected.

---

## 2. WALLET PAYMENTS

### TC-WALLET-01 🟢 P0 — Customer Pays Full Booking via Wallet

**Preconditions:** Customer has wallet balance ≥ booking fare. Booking in `in_progress` state.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Customer selects "Pay from Wallet" on payment screen | `calculatePaymentSplit()` returns `canPayFull: true` |
| 2 | Customer confirms payment | `payWithWallet(bookingId, userId, true)` calls RPC `pay_with_wallet` |
| 3 | Check response | `{ success: true, fully_paid: true, wallet_deducted: <fare>, new_wallet_balance: <prev - fare> }` |
| 4 | Verify booking database state | `payment_status = 'paid'`, `payment_method = 'wallet'`, `wallet_amount_used = <fare>` |
| 5 | Verify customer wallet | `users.balance` reduced by exact fare amount |
| 6 | Driver app receives payment notification | `subscribeToBooking` fires, `payment_status = 'paid'` shown, QR area shows "PAID" badge |

**SQL Verification:**
```sql
SELECT payment_status, payment_method, wallet_amount_used FROM bookings WHERE id = '<booking_id>';
SELECT balance FROM users WHERE id = '<customer_id>';
SELECT * FROM wallet_transactions WHERE booking_id = '<booking_id>';
```

**Pass/Fail Criteria:** Booking marked `paid`, wallet balance correctly deducted, `wallet_transactions` has debit entry.

---

### TC-WALLET-02 🟡 P0 — Insufficient Wallet Balance → Prompt for Top-up or Alternate Payment

**Preconditions:** Customer has ₹50, booking total is ₹200.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Customer attempts full wallet payment | `calculatePaymentSplit(50, 200)` → `{ canPayFull: false, walletAmount: 50, onlineAmount: 150, needsOnlinePayment: true }` |
| 2 | If `useFullWallet = true`, RPC called | `pay_with_wallet` returns `{ success: false, error: "Insufficient balance", shortfall: 150, required: 200, available: 50 }` |
| 3 | App shows options: "Use ₹50 wallet + Pay ₹150 online" OR "Top up wallet" | Both options visible to user |
| 4 | Customer chooses partial: wallet + online | `payWithWallet(bookingId, userId, false, paymentSessionId)` succeeds with partial deduction |
| 5 | Verify booking state after partial | `payment_status = 'partial_paid'`, `wallet_amount_used = 50` |
| 6 | Customer completes ₹150 via Cashfree | `completePartialPayment()` finalizes: `payment_status = 'paid'`, `payment_method = 'wallet_plus_online'` |

**SQL Verification:**
```sql
SELECT pay_with_wallet('<booking_id>', '<user_id>', true);
-- Expected: {"success": false, "error": "Insufficient balance", ...}

SELECT payment_status, payment_method, wallet_amount_used FROM bookings WHERE id = '<booking_id>';
-- After partial+online: payment_status='paid', payment_method='wallet_plus_online', wallet_amount_used=50
```

**Pass/Fail Criteria:** Graceful error for insufficient balance. Partial + online flow completes correctly.

---

### TC-WALLET-03 🟢 P0 — Wallet Deduction and Driver Credit

**Preconditions:** Customer pays via wallet, booking then completed by driver.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Customer wallet payment succeeds (TC-WALLET-01) | `booking.payment_status = 'paid'` |
| 2 | On booking update, `on_booking_payment_received` trigger fires | Driver wallet credited automatically |
| 3 | Driver checks wallet via `getDriverWalletInfo(driverId)` | `pending_balance` increases by `driver_payout` amount |
| 4 | Driver completes trip | After completion, balance moves from `pending` to `available` (per settlement logic) |

**SQL Verification:**
```sql
SELECT get_driver_wallet_info('<driver_id>');
-- Check pending_balance includes driver_payout from this booking

SELECT * FROM driver_wallet_transactions
WHERE booking_id = '<booking_id>' AND type = 'earning';
-- Expected: 1 row, amount = driver_payout, direction = 'credit'
```

**Pass/Fail Criteria:** Driver wallet credited with `driver_payout`. Transaction record exists.

---

### TC-WALLET-04 🟢 P1 — Admin Reconciliation: Wallet Debit Matches Driver Payout

**Preconditions:** Wallet payment completed end-to-end.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Query booking record | `total_fare`, `driver_payout`, `wallet_amount_used` all populated |
| 2 | Verify: `wallet_amount_used` = customer debit | Customer `wallet_transactions` debit amount matches `wallet_amount_used` |
| 3 | Verify: `driver_payout` = driver credit | `driver_wallet_transactions` credit amount matches `driver_payout` |
| 4 | Verify: `total_fare - driver_payout` = platform commission | Difference equals platform cut |
| 5 | Admin console → booking detail page | All amounts match: fare, commission, driver payout, wallet usage |

**SQL Verification:**
```sql
SELECT total_fare, driver_payout, wallet_amount_used,
       (total_fare - driver_payout) as platform_commission
FROM bookings WHERE id = '<booking_id>';

-- Cross-check: customer debit
SELECT amount FROM wallet_transactions WHERE booking_id = '<booking_id>' AND type = 'debit';

-- Cross-check: driver credit
SELECT amount FROM driver_wallet_transactions WHERE booking_id = '<booking_id>' AND type = 'earning';
```

**Pass/Fail Criteria:** `wallet_amount_used == customer_debit`, `driver_payout == driver_credit`, `total_fare == driver_payout + commission`.

---

### TC-WALLET-05 🔴 P0 — Double Payment Idempotency

**Preconditions:** Booking exists, customer has sufficient wallet balance.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `pay_with_wallet` RPC first time | `{ success: true, fully_paid: true }` |
| 2 | Call `pay_with_wallet` RPC second time (same booking) | `{ success: false, error: "Already paid" }` |
| 3 | Verify wallet balance deducted only once | `users.balance` decreased by exactly 1× fare, not 2× |

**Pass/Fail Criteria:** Second call rejected. No double deduction.

---

### TC-WALLET-06 🔴 P1 — Partial Payment Rollback on Failed Online Payment

**Preconditions:** Customer has ₹100, booking = ₹300. Partial wallet deduction done.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `payWithWallet(bookingId, userId, false)` → partial deduction of ₹100 | `payment_status = 'partial_paid'`, `wallet_amount_used = 100` |
| 2 | Online payment for remaining ₹200 **fails** (Cashfree returns FAILED) | Customer sees "Payment Failed" notification |
| 3 | `rollbackPartialPayment(bookingId)` called | RPC `rollback_partial_wallet_payment` restores ₹100 to customer wallet |
| 4 | Verify customer balance restored | `users.balance` back to original ₹100 |
| 5 | Verify booking reset | `payment_status` back to `pending`, `wallet_amount_used = 0` |

**SQL Verification:**
```sql
SELECT rollback_partial_wallet_payment('<booking_id>');
-- Expected: {"success": true, "restored_amount": 100}

SELECT balance FROM users WHERE id = '<customer_id>';
-- Expected: original balance restored
```

**Pass/Fail Criteria:** Wallet fully restored. No money lost. Booking returns to payable state.

---

## 3. FAILED TRANSACTION RETRIES

### TC-RETRY-01 🟡 P0 — UPI/Card Payment Fails → App Prompts Retry

**Preconditions:** Customer has booking, attempts online payment via Cashfree.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Customer initiates Cashfree payment via `initiateCashfreePayment()` | Browser opens Cashfree checkout URL |
| 2 | Payment fails (user cancels or bank declines) | Cashfree redirects back with `status = 'FAILED'` |
| 3 | `handlePaymentCallback(orderId, 'FAILED')` called | Returns `{ success: false, error: 'Payment failed' }` |
| 4 | App shows retry UI | "Payment Failed. Retry?" with options: Retry same method, Try different method, Pay Cash |
| 5 | Customer taps "Retry" | New `createPaymentOrder()` call with fresh idempotency key |

**Pass/Fail Criteria:** User sees clear error message and can retry without being stuck.

---

### TC-RETRY-02 🟡 P0 — Webhook Handles Failed Payment Correctly

**Preconditions:** Cashfree sends `PAYMENT_FAILED` webhook.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Webhook receives payload with `type = 'PAYMENT_FAILED'` | `payment-webhook/index.ts` processes the event |
| 2 | Booking found by `payment_id = order_id` | Booking located in database |
| 3 | Notification created for customer | `notifications` table: `title = 'Payment Failed'`, `body = 'Your payment could not be processed. Please try again.'`, `data.type = 'payment_failed'` |
| 4 | Booking `payment_status` remains `pending` (NOT set to `failed` by webhook) | Webhook does NOT update booking status for failures — only `verify-payment` does |

**SQL Verification:**
```sql
SELECT payment_status FROM bookings WHERE payment_id = '<order_id>';
-- Expected: 'pending' (webhook doesn't change status on failure)

SELECT * FROM notifications WHERE data->>'booking_id' = '<booking_id>' AND data->>'type' = 'payment_failed';
-- Expected: 1 row
```

**Pass/Fail Criteria:** Failed notification sent. Booking stays payable for retry.

---

### TC-RETRY-03 🔴 P0 — No Double Charge on Multiple Retries

**Preconditions:** Customer retries payment 3 times (first 2 fail, 3rd succeeds).

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Attempt 1: `createPaymentOrder()` → payment fails | Order 1 status = FAILED, booking unchanged |
| 2 | Attempt 2: `createPaymentOrder()` → payment fails | Order 2 status = FAILED, booking unchanged |
| 3 | Attempt 3: `createPaymentOrder()` → payment succeeds | Order 3 status = PAID |
| 4 | Webhook fires for Order 3 (`PAYMENT_SUCCESS`) | Booking updated: `payment_status = 'paid'`, `payment_method = 'online'` |
| 5 | Delayed webhook arrives for Order 1 (late success — edge case) | Webhook checks `booking.payment_status === 'paid'` → skips with "Already processed" (idempotency) |
| 6 | Verify only 1 charge on customer | Only 1 successful payment recorded |

**SQL Verification:**
```sql
SELECT payment_status, payment_method FROM bookings WHERE id = '<booking_id>';
-- Expected: payment_status='paid' (set only once)

-- Check no duplicate wallet entries
SELECT count(*) FROM wallet_transactions WHERE booking_id = '<booking_id>';
```

**Pass/Fail Criteria:** Exactly 1 charge. Idempotency guard in `payment-webhook` prevents double processing.

---

### TC-RETRY-04 🟡 P1 — Verify-Payment Edge Function Handles force_fail

**Preconditions:** Payment order exists in Cashfree with PENDING transactions.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `verify-payment` with `{ order_id, force_fail: false }` | If transactions are PENDING → returns `status: 'PENDING'` |
| 2 | Call `verify-payment` with `{ order_id, force_fail: true }` | Even if PENDING transactions exist → returns `status: 'FAILED'` |
| 3 | Booking updated to `payment_status = 'failed'` | User can now retry cleanly |

**Pass/Fail Criteria:** `force_fail` parameter correctly overrides PENDING to FAILED.

---

### TC-RETRY-05 🟢 P1 — Admin Console Shows Failed Transaction Logs

**Preconditions:** Multiple payment attempts on same booking (some failed, one succeeded).

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Admin navigates to booking detail | Payment history shows all attempts |
| 2 | Each failed attempt shows: order_id, timestamp, error reason | Error codes from Cashfree (e.g., `TRANSACTION_DECLINED`, `USER_CANCELLED`) visible |
| 3 | Final successful attempt highlighted | `payment_status = 'paid'` with final order_id |
| 4 | Check `notifications` table | 1 failure notification per failed attempt, 1 success notification |

**Pass/Fail Criteria:** Admin can see full payment attempt history with error details.

---

## 4. SETTLEMENT LOGIC

### TC-SETTLE-01 🟢 P0 — Driver Completes Trip → Payout Credited to Driver Wallet

**Preconditions:** Booking `status = 'in_progress'`, `payment_status = 'paid'` (via any method).

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Driver taps "Complete Trip" on collect-payment screen | `handleCompleteTrip()`: booking → `status = 'completed'`, `completed_at` set |
| 2 | `on_booking_payment_received` trigger fires | `driver_wallet_transactions` row created: `type = 'earning'`, `amount = driver_payout`, `balance_type = 'pending'`, `direction = 'credit'` |
| 3 | `getDriverWalletInfo(driverId)` called | `pending_balance` increased by `driver_payout` |
| 4 | After settlement period, `pending_balance` → `available_balance` | Driver can now request withdrawal |

**SQL Verification:**
```sql
SELECT * FROM driver_wallet_transactions
WHERE booking_id = '<booking_id>' ORDER BY created_at DESC LIMIT 1;
-- Expected: type='earning', amount=<driver_payout>, balance_type='pending'

SELECT get_driver_wallet_info('<driver_id>');
```

**Pass/Fail Criteria:** Driver wallet correctly credited. Amounts match `driver_payout` from booking.

---

### TC-SETTLE-02 🟢 P0 — Payout Timing: Withdrawal Request → Admin Approval → Bank Transfer

**Preconditions:** Driver has `available_balance ≥ ₹100`, bank details saved, `beneficiary_status = 'active'`.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Driver calls `requestWithdrawal(driverId, 100)` | `withdrawals` row: `status = 'pending'`, `amount = 100` |
| 2 | `getDriverWalletInfo` reflects pending withdrawal | `pending_withdrawals = 100`, `available_balance` reduced by 100 |
| 3 | Admin approves withdrawal in console | `withdrawals.status = 'approved'` |
| 4 | `process-withdrawal` edge function fires | Calls Cashfree `/authorize` + `/requestTransfer`, sets `payout_status = 'INITIATED'`, `payout_reference` populated |
| 5 | Cashfree sends payout webhook (SUCCESS) | `withdrawals.status = 'paid'`, `processed_at` set |

**SQL Verification:**
```sql
SELECT status, payout_status, payout_reference, payout_error, processed_at
FROM withdrawals WHERE driver_id = '<driver_id>' ORDER BY created_at DESC LIMIT 1;
```

**Pass/Fail Criteria:** Full withdrawal lifecycle completes. `withdrawals.status` transitions: `pending → approved → paid`.

---

### TC-SETTLE-03 🔴 P1 — Delayed Settlement Due to Network/API Issues

**Preconditions:** Admin approves withdrawal, but Cashfree API is unreachable.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Admin approves withdrawal | `process-withdrawal` edge function fires |
| 2 | Cashfree API call fails (timeout/5xx) | `withdrawals.payout_status = 'FAILED'`, `payout_error` contains error message |
| 3 | Admin sees failed payout in console | `payout_error` field visible with specific error |
| 4 | Admin retries approval | Same withdrawal can be re-processed (if `payout_status = 'FAILED'`) |
| 5 | On retry success | `payout_status = 'INITIATED'` |

**Pass/Fail Criteria:** Failed payouts logged with error. Retry mechanism works. Driver money not lost.

---

### TC-SETTLE-04 🟢 P1 — Admin Reconciliation: Trip Fare = Commission + Driver Payout

**Preconditions:** Multiple completed bookings exist with various payment methods.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Query all completed bookings for a driver | List of bookings with `total_fare`, `driver_payout` |
| 2 | For each booking: `total_fare - driver_payout = platform_commission` | Commission is non-negative and within expected range |
| 3 | Sum of `driver_payout` across completed bookings = total driver earnings | Matches `get_driver_wallet_info` total |
| 4 | Admin console "Driver" detail page shows matching totals | Earnings, withdrawals, available balance all consistent |

**SQL Verification:**
```sql
SELECT
  SUM(total_fare) as total_revenue,
  SUM(driver_payout) as total_driver_earnings,
  SUM(total_fare - driver_payout) as total_commission
FROM bookings
WHERE driver_id = '<driver_id>' AND status = 'completed';

SELECT get_driver_wallet_info('<driver_id>');
```

**Pass/Fail Criteria:** All financial sums balance. No unaccounted money.

---

### TC-SETTLE-05 🔴 P1 — Driver Cannot Overdraw Balance

**Preconditions:** Driver has available balance of ₹200.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Driver requests withdrawal of ₹500 | `request_withdrawal` RPC returns `{ success: false, error: "Insufficient balance: ₹200" }` |
| 2 | Verify no withdrawal row created | `withdrawals` table unchanged |
| 3 | Driver requests ₹200 (exact balance) | `{ success: true }`, withdrawal created |

**Pass/Fail Criteria:** Overdraw blocked. Exact-balance withdrawal allowed.

---

### TC-SETTLE-06 🔴 P0 — Withdrawal Idempotency

**Preconditions:** Driver is eligible for withdrawal.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `request_withdrawal(driverId, 100, 'test-key-123')` — first call | `{ success: true }` |
| 2 | `request_withdrawal(driverId, 100, 'test-key-123')` — same key | `{ success: false, error: "Withdrawal already requested with this key" }` |
| 3 | Verify only 1 withdrawal row exists for that key | Exactly 1 row in `withdrawals` |

**Pass/Fail Criteria:** Duplicate withdrawal prevented by idempotency key.

---

## 5. EDGE CASES

### TC-EDGE-01 🔴 P1 — Customer Switches Payment Method Mid-Trip (Cash → UPI QR)

**Preconditions:** Customer booked with cash. Trip in progress. Driver at collect-payment screen.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Driver opens collect-payment screen, selects **Receiver** | Cash collection option shown + "Show UPI QR Code" button visible |
| 2 | Receiver says "I'll pay UPI" → Driver taps **"Show UPI QR Code"** | `handleShowQR()` calls `create-upi-qr` edge function, QR displayed |
| 3 | Receiver scans QR and pays via UPI | Cashfree webhook fires: `PAYMENT_SUCCESS` |
| 4 | `payment-webhook` updates booking: `payment_status = 'paid'`, `payment_method = 'online'` | ✅ even though original booking was "cash" |
| 5 | `subscribeToBooking` fires → driver screen shows "PAID" badge, `qrPaid = true` | Alert: "Payment Received! 💰" |
| 6 | Driver completes trip (OTP verified) | `handleCompleteTrip()` skips payment update since already `paid` |

**Pass/Fail Criteria:** Payment method correctly updated from cash to online. No double-charge.

---

### TC-EDGE-02 🔴 P2 — Driver App Crash During Settlement → Recovery Flow

**Preconditions:** Driver was on collect-payment screen, about to complete trip. App killed/crashed.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Driver reopens app | App resumes to active booking (checks for `in_progress` booking on launch) |
| 2 | Driver navigates back to collect-payment screen | `fetchBooking()` reloads booking data from Supabase |
| 3 | If payment was already processed (webhook already fired) | Screen shows "PAID" status, driver can complete trip normally |
| 4 | If payment NOT yet processed | Screen shows "PENDING", driver can retry payment collection |
| 5 | Driver completes trip | No data corruption — booking state is authoritative from DB |

**Pass/Fail Criteria:** App recovers cleanly. No orphaned bookings. DB state is source of truth.

---

### TC-EDGE-03 🔴 P1 — Network Drop During Online Payment → Retry or Fallback

**Preconditions:** Customer is in process of online payment via Cashfree.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Customer initiates payment, network drops during Cashfree redirect | Browser shows network error or times out |
| 2 | Customer reconnects and returns to app | App calls `checkPaymentStatus(bookingId)` to verify state |
| 3a | If Cashfree processed payment (webhook arrived) | `payment_status = 'paid'` → app shows success |
| 3b | If payment is still PENDING on Cashfree | App calls `verify-payment` edge function to force-check |
| 3c | If payment genuinely failed | `payment_status` remains `pending`, customer prompted to retry |
| 4 | Customer can retry or switch to cash | New payment order created or booking stays in cash-payable state |

**Pass/Fail Criteria:** No stuck states. Customer always has a path to complete payment.

---

### TC-EDGE-04 🔴 P1 — Dispute: Customer Claims Overcharge → Admin Adjustment

**Preconditions:** Completed booking with `total_fare = ₹500`, customer disputes.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Customer contacts support, claims overcharge | Support ticket created (out of app scope) |
| 2 | Admin reviews booking in console | All details visible: route, fare calculation, payment method, timestamps |
| 3 | Admin issues adjustment (if warranted) | Manual DB operation: credit customer wallet, adjust `driver_wallet_transactions` with `type = 'adjustment'` |
| 4 | Customer wallet balance updated | `users.balance` increased by refund amount |
| 5 | Driver wallet adjusted if needed | `driver_wallet_transactions` debit entry with `type = 'adjustment'` |

**SQL Verification:**
```sql
-- Credit customer
UPDATE users SET balance = balance + <refund_amount> WHERE id = '<customer_id>';

-- Create adjustment transaction for driver
INSERT INTO driver_wallet_transactions (driver_id, type, amount, direction, status, description)
VALUES ('<driver_id>', 'adjustment', <amount>, 'debit', 'completed', 'Fare dispute adjustment');
```

**Pass/Fail Criteria:** Refund correctly applied. Both customer and driver balances updated. Audit trail in transactions table.

---

### TC-EDGE-05 🔴 P2 — Sender Pays Online (Push Notification Flow)

**Preconditions:** Driver selects **Sender** as payer on collect-payment screen.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Driver taps to request online payment from sender | `requestOnlinePayment()` fires: `send_notification_to_user` RPC called |
| 2 | Customer (sender) receives push: "Payment Requested - ₹{amount}" | Notification data includes `booking_id`, `type: 'payment_request'`, `amount` |
| 3 | Customer opens app and pays via wallet or Cashfree | Payment processed normally |
| 4 | Driver screen auto-updates via `subscribeToBooking` | `payment_status = 'paid'` → "Payment Received! 💰" alert |
| 5 | For partial-paid bookings, outstanding amount shown correctly | `amountToCollect = fare - wallet_amount_used` |

**Pass/Fail Criteria:** Push notification delivered. Payment completes. Driver screen reflects real-time status.

---

### TC-EDGE-06 🔴 P1 — Wallet Top-Up Payment Fails → No Credit

**Preconditions:** Customer attempts wallet top-up via Cashfree.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `createPaymentOrder` with wallet top-up (order starts with `WALLET_`) | Order created in Cashfree |
| 2 | Payment fails | `verify-payment` checks transactions → status = FAILED |
| 3 | `wallet_transactions` row updated | `status = 'failed'` (NOT `completed`) |
| 4 | `users.balance` unchanged | No credit applied |
| 5 | Customer retries | New order created, separate transaction |

**SQL Verification:**
```sql
SELECT status FROM wallet_transactions WHERE payment_order_id = '<order_id>';
-- Expected: 'failed'

SELECT balance FROM users WHERE id = '<customer_id>';
-- Expected: unchanged from before attempt
```

**Pass/Fail Criteria:** No wallet credit on failed payment. Clean retry path available.

---

### TC-EDGE-07 🔴 P0 — Webhook Signature Validation (Production Only)

**Preconditions:** `CASHFREE_ENV = 'production'`.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send webhook with valid signature | Webhook processes normally (200 OK) |
| 2 | Send webhook with invalid/missing `x-webhook-signature` | Response: `{ error: 'Invalid signature' }`, status 401 |
| 3 | Send webhook with tampered payload + original signature | Signature mismatch → 401 |
| 4 | In sandbox mode (`CASHFREE_ENV != 'production'`) | Signature check skipped, webhook processes |

**Pass/Fail Criteria:** Production webhooks reject unauthorized requests. Sandbox allows for testing.

---

## QUICK CHECKLIST

| # | Test Case | Priority | Status |
|---|-----------|----------|--------|
| | **CASH PAYMENTS** | | |
| TC-CASH-01 | Cash booking → driver collects at trip end | P0 | ⬜ |
| TC-CASH-02 | Driver records cash collection correctly | P0 | ⬜ |
| TC-CASH-03 | Admin console reflects cash in trip logs | P1 | ⬜ |
| TC-CASH-04 | Customer cancels cash booking → no settlement | P1 | ⬜ |
| | **WALLET PAYMENTS** | | |
| TC-WALLET-01 | Full wallet payment | P0 | ⬜ |
| TC-WALLET-02 | Insufficient balance → partial or top-up | P0 | ⬜ |
| TC-WALLET-03 | Wallet deduction + driver credit | P0 | ⬜ |
| TC-WALLET-04 | Admin reconciliation: debit = payout | P1 | ⬜ |
| TC-WALLET-05 | Double payment idempotency | P0 | ⬜ |
| TC-WALLET-06 | Partial payment rollback on failed online | P1 | ⬜ |
| | **FAILED RETRIES** | | |
| TC-RETRY-01 | Payment fails → app prompts retry | P0 | ⬜ |
| TC-RETRY-02 | Webhook handles PAYMENT_FAILED | P0 | ⬜ |
| TC-RETRY-03 | No double charge on multiple retries | P0 | ⬜ |
| TC-RETRY-04 | verify-payment force_fail handling | P1 | ⬜ |
| TC-RETRY-05 | Admin sees failed transaction logs | P1 | ⬜ |
| | **SETTLEMENT LOGIC** | | |
| TC-SETTLE-01 | Trip complete → driver wallet credit | P0 | ⬜ |
| TC-SETTLE-02 | Withdrawal → approval → bank transfer | P0 | ⬜ |
| TC-SETTLE-03 | Delayed settlement (API failure + retry) | P1 | ⬜ |
| TC-SETTLE-04 | Admin reconciliation math check | P1 | ⬜ |
| TC-SETTLE-05 | Driver cannot overdraw | P1 | ⬜ |
| TC-SETTLE-06 | Withdrawal idempotency | P0 | ⬜ |
| | **EDGE CASES** | | |
| TC-EDGE-01 | Switch payment method mid-trip | P1 | ⬜ |
| TC-EDGE-02 | Driver app crash → recovery | P2 | ⬜ |
| TC-EDGE-03 | Network drop during payment → retry | P1 | ⬜ |
| TC-EDGE-04 | Dispute → admin adjustment | P1 | ⬜ |
| TC-EDGE-05 | Sender pays online (push notification) | P2 | ⬜ |
| TC-EDGE-06 | Wallet top-up fails → no credit | P1 | ⬜ |
| TC-EDGE-07 | Webhook signature validation | P0 | ⬜ |

**Total: 27 test cases** (P0: 11, P1: 13, P2: 3)

---

## HOW TO RUN TESTS

### Option A: SQL Direct Verification (via Supabase SQL Editor)
Copy any `SQL Verification` block from this doc into **Supabase SQL Editor**.
Replace placeholder IDs (`<booking_id>`, `<customer_id>`, `<driver_id>`) with actual values.

### Option B: API Tests (Existing)
```bash
# Run existing payment API tests
cd e2e && npx playwright test tests/api/payment.test.ts

# Run payment split unit tests
cd .. && npx vitest run tests/unit/payment-split.test.ts
```

### Option C: Manual App Testing
1. Start customer + driver apps via Expo
2. Use Cashfree sandbox test credentials (card: `4111 1111 1111 1111`)
3. Follow each TC step-by-step, verify DB state after each step

### Option D: Admin Console (Playwright)
```bash
cd e2e && npx playwright test --headed
# Filter for booking/payment related tests
```
