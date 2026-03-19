# Driver Commission And Settlement Handoff

## Scope

This document covers the current CartR booking, payment, commission, driver wallet, and payout flow as implemented in the codebase on March 19, 2026.

It is focused on these business cases:

1. Customer books a ride and pays the driver in cash at completion.
2. Customer books a ride and pays through CartR online payment flow.
3. Customer uses wallet-only or wallet-plus-online payment.
4. Driver receives earnings, platform commission is deducted, and payout/withdrawal happens later.

No code changes were made while preparing this document. This is a read-only analysis.

## Executive Summary

The codebase already contains most of the backend settlement infrastructure:

- Customer wallet ledger and wallet payment RPCs exist.
- Driver wallet tables, transaction ledger, and withdrawal pipeline exist.
- Platform commission settings exist in `platform_settings`.
- Booking payment triggers exist for online payment receipt and booking completion.
- Cash commission logic also exists in SQL.

However, the mobile app integration is incomplete and inconsistent:

- The production driver payment collection screen does not actually wire the online/QR path.
- The driver collect-payment screen hardcodes 20% commission visually, while backend commission is configurable.
- Booking creation writes `driver_payout` as a gross/preliminary value, but settlement SQL later rewrites it to the net driver share.
- The current cash commission mechanism debits the driver wallet's `available_balance`, which can fail when the driver has insufficient wallet balance because the wallet schema does not allow negative balances.
- There is schema drift between app expectations and versioned migrations for statuses/functions like `failed` and `rollback_partial_wallet_payment`.

The best path forward is to keep the settlement source of truth in database RPCs/triggers, then finish wiring the app flows to those mechanisms cleanly.

## Primary Files

### Customer app

- [apps/customer/lib/bookings.ts](/C:/cart-r-main/apps/customer/lib/bookings.ts)
- [apps/customer/lib/bookingFlow.ts](/C:/cart-r-main/apps/customer/lib/bookingFlow.ts)
- [apps/customer/lib/walletPayment.ts](/C:/cart-r-main/apps/customer/lib/walletPayment.ts)
- [apps/customer/lib/payment.ts](/C:/cart-r-main/apps/customer/lib/payment.ts)
- [apps/customer/app/review-booking.tsx](/C:/cart-r-main/apps/customer/app/review-booking.tsx)
- [apps/customer/app/pay-booking.tsx](/C:/cart-r-main/apps/customer/app/pay-booking.tsx)
- [apps/customer/components/PaymentConfirmationModal.tsx](/C:/cart-r-main/apps/customer/components/PaymentConfirmationModal.tsx)

### Driver app

- [apps/driver/lib/bookings.ts](/C:/cart-r-main/apps/driver/lib/bookings.ts)
- [apps/driver/lib/wallet.ts](/C:/cart-r-main/apps/driver/lib/wallet.ts)
- [apps/driver/app/ride/collect-payment.tsx](/C:/cart-r-main/apps/driver/app/ride/collect-payment.tsx)
- [apps/driver/app/ride/verify-drop-otp.tsx](/C:/cart-r-main/apps/driver/app/ride/verify-drop-otp.tsx)
- [apps/driver/app/(tabs)/earnings.tsx](/C:/cart-r-main/apps/driver/app/%28tabs%29/earnings.tsx)
- [apps/driver/app/(tabs)/home.tsx](/C:/cart-r-main/apps/driver/app/%28tabs%29/home.tsx)

### Supabase edge functions

- [supabase/functions/create-payment-order/index.ts](/C:/cart-r-main/supabase/functions/create-payment-order/index.ts)
- [supabase/functions/payment-webhook/index.ts](/C:/cart-r-main/supabase/functions/payment-webhook/index.ts)
- [supabase/functions/verify-payment/index.ts](/C:/cart-r-main/supabase/functions/verify-payment/index.ts)
- [supabase/functions/create-upi-qr/index.ts](/C:/cart-r-main/supabase/functions/create-upi-qr/index.ts)
- [supabase/functions/process-withdrawal/index.ts](/C:/cart-r-main/supabase/functions/process-withdrawal/index.ts)
- [supabase/functions/check-transfer-status/index.ts](/C:/cart-r-main/supabase/functions/check-transfer-status/index.ts)
- [supabase/functions/create-beneficiary/index.ts](/C:/cart-r-main/supabase/functions/create-beneficiary/index.ts)

### Database schema and migrations

- [database schema.txt](/C:/cart-r-main/database%20schema.txt)
- [supabase/migrations/20260119230000_wallet_payment_system.sql](/C:/cart-r-main/supabase/migrations/20260119230000_wallet_payment_system.sql)
- [supabase/migrations/20260224_fintech_wallet_system.sql](/C:/cart-r-main/supabase/migrations/20260224_fintech_wallet_system.sql)
- [supabase/migrations/20260225090000_attach_wallet_triggers.sql](/C:/cart-r-main/supabase/migrations/20260225090000_attach_wallet_triggers.sql)
- [supabase/migrations/051_fix_cash_commission_debit.sql](/C:/cart-r-main/supabase/migrations/051_fix_cash_commission_debit.sql)
- [supabase/migrations/20260315_fix_wallet_constraint.sql](/C:/cart-r-main/supabase/migrations/20260315_fix_wallet_constraint.sql)
- [supabase/migrations/012_payment_confirmation.sql](/C:/cart-r-main/supabase/migrations/012_payment_confirmation.sql)

### Admin surfaces

- [apps/admin/app/settings/page.tsx](/C:/cart-r-main/apps/admin/app/settings/page.tsx)
- [apps/admin/app/finance/page.tsx](/C:/cart-r-main/apps/admin/app/finance/page.tsx)
- [apps/admin/app/drivers/[id]/page.tsx](/C:/cart-r-main/apps/admin/app/drivers/%5Bid%5D/page.tsx)
- [apps/admin/app/payouts/page.tsx](/C:/cart-r-main/apps/admin/app/payouts/page.tsx)

### Existing test plans

- [tests/payment-settlement-test-cases.md](/C:/cart-r-main/tests/payment-settlement-test-cases.md)
- [tests/payment-payout-tests.md](/C:/cart-r-main/tests/payment-payout-tests.md)
- [tests/complete-testing-plan.md](/C:/cart-r-main/tests/complete-testing-plan.md)

## Database Objects Already Present

### Core tables

From [database schema.txt](/C:/cart-r-main/database%20schema.txt#L60):

- `bookings`
  - `payment_status`
  - `payment_method`
  - `driver_payout`
  - `wallet_amount_used`
  - `payment_confirmed_by_customer`
  - `customer_reported_payment_method`
  - `payment_id`
  - `payment_session_id`
  - `online_payment_order_id`

From [database schema.txt](/C:/cart-r-main/database%20schema.txt#L172):

- `driver_wallet_transactions`
  - transaction types include:
    - `earning`
    - `release`
    - `withdrawal`
    - `reversal`
    - `adjustment`
    - `payout_fee`
    - `platform_fee`

From [database schema.txt](/C:/cart-r-main/database%20schema.txt#L191):

- `driver_wallets`
  - `pending_balance`
  - `available_balance`
  - `total_earned`
  - `total_withdrawn`

From [database schema.txt](/C:/cart-r-main/database%20schema.txt#L596):

- `wallet_transactions`
  - customer wallet credits/debits

From [database schema.txt](/C:/cart-r-main/database%20schema.txt#L611):

- `withdrawals`
  - driver withdrawal requests and payout execution state

From [database schema.txt](/C:/cart-r-main/database%20schema.txt#L368):

- `platform_settings`
  - stores commission, payout, and KYC settings

### Important schema constraints

- `driver_wallets.available_balance` is constrained to be non-negative.
- `driver_wallets.pending_balance` is constrained to be non-negative.
- `driver_wallet_transactions.type` allows `platform_fee`, which is important for cash commission deduction.

This matters because current cash commission logic tries to debit `available_balance`.

## Current Booking And Payment Flow

### 1. Booking creation

Primary file: [apps/customer/lib/bookings.ts](/C:/cart-r-main/apps/customer/lib/bookings.ts)

Current behavior:

- `createBooking()` inserts directly into `bookings`.
- It sets:
  - `status = 'pending'`
  - `payment_status = 'pending'`
  - `payment_method = 'cash'`
- It also sets `driver_payout` during booking creation.

Important lines:

- `driverPayout = (vehicle.total_fare * fareMultiplier) + tipAmount` at [apps/customer/lib/bookings.ts](/C:/cart-r-main/apps/customer/lib/bookings.ts#L65)
- `payment_method: 'cash'` at [apps/customer/lib/bookings.ts](/C:/cart-r-main/apps/customer/lib/bookings.ts#L94)

Issue:

- This `driver_payout` is not the final settled payout.
- Later backend settlement logic recalculates and overwrites `driver_payout` as net-of-commission.
- So the same field is currently used with two different meanings:
  - pre-settlement gross-ish placeholder in app code
  - post-settlement net payout in SQL

### 2. Customer review-booking flow

Primary files:

- [apps/customer/app/review-booking.tsx](/C:/cart-r-main/apps/customer/app/review-booking.tsx)
- [apps/customer/lib/bookingFlow.ts](/C:/cart-r-main/apps/customer/lib/bookingFlow.ts)

Current behavior:

- User selects payment method in `review-booking.tsx`.
- `createBookingWithPayment()` is called.
- `createBookingWithPayment()` always creates the booking first.
- After booking creation:
  - if payment method is `cash`, flow stops there
  - if payment method is `wallet`, it calls `payWithWallet()`

Important lines:

- call into `createBookingWithPayment()` at [apps/customer/app/review-booking.tsx](/C:/cart-r-main/apps/customer/app/review-booking.tsx#L437)
- `if (paymentMethod === "cash") return { data, error: null };` at [apps/customer/lib/bookingFlow.ts](/C:/cart-r-main/apps/customer/lib/bookingFlow.ts#L92)
- `payWithWallet(...)` at [apps/customer/lib/bookingFlow.ts](/C:/cart-r-main/apps/customer/lib/bookingFlow.ts#L96)

Important implication:

- Initial booking record defaults to cash even when the customer intends to use wallet or online later.
- Some later flows update payment fields, but the original insert is always cash.

### 3. Customer wallet payment flow

Primary files:

- [apps/customer/lib/walletPayment.ts](/C:/cart-r-main/apps/customer/lib/walletPayment.ts)
- [supabase/migrations/20260119230000_wallet_payment_system.sql](/C:/cart-r-main/supabase/migrations/20260119230000_wallet_payment_system.sql)

Current behavior:

- App calls RPC `pay_with_wallet`.
- RPC supports:
  - full wallet payment
  - partial wallet payment with remaining online amount
- If fully paid:
  - booking becomes `payment_status = 'paid'`
  - `payment_method = 'wallet'`
- If partially paid:
  - booking becomes `payment_status = 'partial_paid'`
  - `payment_method = 'partial_wallet'`
  - `wallet_amount_used` is stored

Important lines:

- app RPC call at [apps/customer/lib/walletPayment.ts](/C:/cart-r-main/apps/customer/lib/walletPayment.ts#L55)
- SQL `pay_with_wallet` creation at [supabase/migrations/20260119230000_wallet_payment_system.sql](/C:/cart-r-main/supabase/migrations/20260119230000_wallet_payment_system.sql#L14)
- full wallet sets `payment_method = 'wallet'` at [supabase/migrations/20260119230000_wallet_payment_system.sql](/C:/cart-r-main/supabase/migrations/20260119230000_wallet_payment_system.sql#L139)
- partial wallet sets `payment_status = 'partial_paid'` and `payment_method = 'partial_wallet'` at [supabase/migrations/20260119230000_wallet_payment_system.sql](/C:/cart-r-main/supabase/migrations/20260119230000_wallet_payment_system.sql#L147)

### 4. Customer online payment flow

Primary files:

- [apps/customer/app/pay-booking.tsx](/C:/cart-r-main/apps/customer/app/pay-booking.tsx)
- [apps/customer/lib/payment.ts](/C:/cart-r-main/apps/customer/lib/payment.ts)
- [supabase/functions/create-payment-order/index.ts](/C:/cart-r-main/supabase/functions/create-payment-order/index.ts)
- [supabase/functions/payment-webhook/index.ts](/C:/cart-r-main/supabase/functions/payment-webhook/index.ts)
- [supabase/functions/verify-payment/index.ts](/C:/cart-r-main/supabase/functions/verify-payment/index.ts)

Current behavior:

- App creates a Cashfree order using `create-payment-order`.
- For booking payment:
  - function updates booking `payment_id = orderId`
  - function updates booking `payment_method = 'online'`
- Webhook or explicit verify marks booking `payment_status = 'paid'`

Important lines:

- app payment order call at [apps/customer/app/pay-booking.tsx](/C:/cart-r-main/apps/customer/app/pay-booking.tsx#L215)
- full online order call at [apps/customer/app/pay-booking.tsx](/C:/cart-r-main/apps/customer/app/pay-booking.tsx#L244)
- edge function order generation at [supabase/functions/create-payment-order/index.ts](/C:/cart-r-main/supabase/functions/create-payment-order/index.ts#L81)
- booking updated with `payment_id` and `payment_method = 'online'` at [supabase/functions/create-payment-order/index.ts](/C:/cart-r-main/supabase/functions/create-payment-order/index.ts#L185)
- webhook marks booking paid at [supabase/functions/payment-webhook/index.ts](/C:/cart-r-main/supabase/functions/payment-webhook/index.ts#L212)
- verify function marks booking paid at [supabase/functions/verify-payment/index.ts](/C:/cart-r-main/supabase/functions/verify-payment/index.ts#L155)

### 5. Customer split payment flow

Primary files:

- [apps/customer/app/pay-booking.tsx](/C:/cart-r-main/apps/customer/app/pay-booking.tsx)
- [apps/customer/lib/walletPayment.ts](/C:/cart-r-main/apps/customer/lib/walletPayment.ts)
- [supabase/migrations/20260119230000_wallet_payment_system.sql](/C:/cart-r-main/supabase/migrations/20260119230000_wallet_payment_system.sql)

Current behavior:

- Wallet portion deducted first via `pay_with_wallet(..., false)`.
- Then online order is created for remainder.
- After successful online payment, app calls `complete_partial_payment`.
- Final booking state becomes:
  - `payment_status = 'paid'`
  - `payment_method = 'wallet_plus_online'`

Important lines:

- wallet-first split path at [apps/customer/app/pay-booking.tsx](/C:/cart-r-main/apps/customer/app/pay-booking.tsx#L200)
- online order for remainder at [apps/customer/app/pay-booking.tsx](/C:/cart-r-main/apps/customer/app/pay-booking.tsx#L215)
- `completePartialPayment(...)` at [apps/customer/app/pay-booking.tsx](/C:/cart-r-main/apps/customer/app/pay-booking.tsx#L352)
- SQL `complete_partial_payment` at [supabase/migrations/20260119230000_wallet_payment_system.sql](/C:/cart-r-main/supabase/migrations/20260119230000_wallet_payment_system.sql#L183)
- final `wallet_plus_online` state at [supabase/migrations/20260119230000_wallet_payment_system.sql](/C:/cart-r-main/supabase/migrations/20260119230000_wallet_payment_system.sql#L212)

### 6. Driver completion flow

Primary files:

- [apps/driver/app/ride/verify-drop-otp.tsx](/C:/cart-r-main/apps/driver/app/ride/verify-drop-otp.tsx)
- [apps/driver/app/ride/collect-payment.tsx](/C:/cart-r-main/apps/driver/app/ride/collect-payment.tsx)
- [apps/driver/lib/bookings.ts](/C:/cart-r-main/apps/driver/lib/bookings.ts)
- [supabase/migrations/20260315_fix_wallet_constraint.sql](/C:/cart-r-main/supabase/migrations/20260315_fix_wallet_constraint.sql)

Current behavior:

- Driver verifies delivery OTP.
- Driver lands on collect-payment screen.
- Collect-payment screen calls `completeTripAtomic(bookingId, paymentMethod)`.
- `complete_trip_atomic`:
  - locks booking row
  - marks booking completed
  - sets `payment_status = 'paid'` if not already paid
  - sets `payment_method` to driver-selected value if not already paid
- triggers then handle settlement

Important lines:

- driver OTP screen route into collect-payment at [apps/driver/app/ride/verify-drop-otp.tsx](/C:/cart-r-main/apps/driver/app/ride/verify-drop-otp.tsx#L135)
- collect-payment calling RPC at [apps/driver/app/ride/collect-payment.tsx](/C:/cart-r-main/apps/driver/app/ride/collect-payment.tsx#L293)
- RPC wrapper at [apps/driver/lib/bookings.ts](/C:/cart-r-main/apps/driver/lib/bookings.ts#L738)
- `complete_trip_atomic` definition at [supabase/migrations/20260315_fix_wallet_constraint.sql](/C:/cart-r-main/supabase/migrations/20260315_fix_wallet_constraint.sql#L17)
- booking update inside RPC at [supabase/migrations/20260315_fix_wallet_constraint.sql](/C:/cart-r-main/supabase/migrations/20260315_fix_wallet_constraint.sql#L64)

## Driver Wallet And Commission Logic Already Present

### 1. Wallet creation

Primary SQL:

- [supabase/migrations/20260224_fintech_wallet_system.sql](/C:/cart-r-main/supabase/migrations/20260224_fintech_wallet_system.sql#L20)

Mechanism:

- `ensure_driver_wallet(driver_id)` creates a wallet row if missing.

### 2. Commission settings

Primary files:

- [apps/admin/app/settings/page.tsx](/C:/cart-r-main/apps/admin/app/settings/page.tsx)
- [supabase/migrations/20260224_fintech_wallet_system.sql](/C:/cart-r-main/supabase/migrations/20260224_fintech_wallet_system.sql)
- [supabase/migrations/051_fix_cash_commission_debit.sql](/C:/cart-r-main/supabase/migrations/051_fix_cash_commission_debit.sql)

Mechanism:

- `platform_settings.key = 'commission'` stores:
  - `default_rate`
  - `by_vehicle_type`
- Admin UI edits these values.

Important lines:

- load settings from `platform_settings` at [apps/admin/app/settings/page.tsx](/C:/cart-r-main/apps/admin/app/settings/page.tsx#L63)
- save commission settings at [apps/admin/app/settings/page.tsx](/C:/cart-r-main/apps/admin/app/settings/page.tsx#L113)
- commission calculation in SQL at [supabase/migrations/051_fix_cash_commission_debit.sql](/C:/cart-r-main/supabase/migrations/051_fix_cash_commission_debit.sql#L44)

### 3. Core driver earning settlement

Primary SQL:

- [supabase/migrations/20260224_fintech_wallet_system.sql](/C:/cart-r-main/supabase/migrations/20260224_fintech_wallet_system.sql#L44)
- [supabase/migrations/051_fix_cash_commission_debit.sql](/C:/cart-r-main/supabase/migrations/051_fix_cash_commission_debit.sql#L5)

Mechanism:

- `credit_driver_earning(driver_id, booking_id, total_fare, p_is_cash)`
- It:
  - reads commission rate
  - calculates `platform_fee`
  - calculates `driver_share`
  - writes transaction(s) to `driver_wallet_transactions`
  - updates `bookings.driver_payout = driver_share`

Important behavior:

- For online payments:
  - credit goes into `pending_balance`
  - transaction type `earning`
  - `balance_type = 'pending'`
- For cash payments:
  - current migration version does **not** credit the collected fare to wallet
  - instead it debits `platform_fee` from `available_balance`
  - writes a separate `platform_fee` debit transaction
  - writes an `earning` record marked as already collected offline

Important lines:

- function definition at [supabase/migrations/051_fix_cash_commission_debit.sql](/C:/cart-r-main/supabase/migrations/051_fix_cash_commission_debit.sql#L5)
- cash commission debit at [supabase/migrations/051_fix_cash_commission_debit.sql](/C:/cart-r-main/supabase/migrations/051_fix_cash_commission_debit.sql#L56)
- `platform_fee` transaction insert at [supabase/migrations/051_fix_cash_commission_debit.sql](/C:/cart-r-main/supabase/migrations/051_fix_cash_commission_debit.sql#L65)
- `driver_payout = v_driver_share` at [supabase/migrations/051_fix_cash_commission_debit.sql](/C:/cart-r-main/supabase/migrations/051_fix_cash_commission_debit.sql#L98)

### 4. Online payment receipt trigger

Primary SQL:

- [supabase/migrations/20260224_fintech_wallet_system.sql](/C:/cart-r-main/supabase/migrations/20260224_fintech_wallet_system.sql#L389)
- [supabase/migrations/20260225090000_attach_wallet_triggers.sql](/C:/cart-r-main/supabase/migrations/20260225090000_attach_wallet_triggers.sql#L7)

Mechanism:

- `on_booking_payment_received()`
- Fires when booking `payment_status` changes to `paid`
- If booking is not yet completed:
  - credits driver earning to pending balance

This is the escrow-like phase for online payments.

### 5. Booking completed trigger

Primary SQL:

- [supabase/migrations/20260224_fintech_wallet_system.sql](/C:/cart-r-main/supabase/migrations/20260224_fintech_wallet_system.sql#L425)
- [supabase/migrations/20260225090000_attach_wallet_triggers.sql](/C:/cart-r-main/supabase/migrations/20260225090000_attach_wallet_triggers.sql#L18)

Mechanism:

- `on_booking_completed()`
- Fires when booking status becomes `completed`
- It:
  - updates driver stats
  - if earning does not exist yet, credits it now
  - otherwise releases pending earning to available

Intended meaning:

- cash ride: settlement happens at completion
- online ride: earning may already be pending, then gets released at completion

### 6. Driver wallet UI

Primary files:

- [apps/driver/lib/wallet.ts](/C:/cart-r-main/apps/driver/lib/wallet.ts)
- [apps/driver/app/(tabs)/earnings.tsx](/C:/cart-r-main/apps/driver/app/%28tabs%29/earnings.tsx)

Mechanisms used:

- `get_driver_wallet_info`
- query `driver_wallet_transactions`
- `request_withdrawal`

Important lines:

- `get_driver_wallet_info` call at [apps/driver/lib/wallet.ts](/C:/cart-r-main/apps/driver/lib/wallet.ts#L31)
- transaction query at [apps/driver/lib/wallet.ts](/C:/cart-r-main/apps/driver/lib/wallet.ts#L45)
- withdrawal RPC call at [apps/driver/lib/wallet.ts](/C:/cart-r-main/apps/driver/lib/wallet.ts#L62)
- earnings screen loads wallet info at [apps/driver/app/(tabs)/earnings.tsx](/C:/cart-r-main/apps/driver/app/%28tabs%29/earnings.tsx#L147)
- earnings screen labels cash trips as `Already collected by you` at [apps/driver/app/(tabs)/earnings.tsx](/C:/cart-r-main/apps/driver/app/%28tabs%29/earnings.tsx#L472)

## What Requests The Apps Make

### Customer app requests

Direct table operations:

- `bookings` insert/select/update
- `users.balance` read
- `wallet_transactions` read/insert in top-up checks

RPC calls:

- `pay_with_wallet`
- `complete_partial_payment`
- `rollback_partial_wallet_payment`
- `confirm_customer_payment`

Edge functions:

- `create-payment-order`
- `verify-payment`

Realtime subscriptions:

- booking updates
- wallet balance updates

### Driver app requests

Direct table operations:

- `bookings` select/update
- `driver_wallet_transactions` select
- `withdrawals` select
- `sms_queue` select/insert

RPC calls:

- `complete_trip_atomic`
- `get_driver_wallet_info`
- `request_withdrawal`
- `initiate_delivery_otp`
- `accept_booking_atomic`
- `decline_booking`

Edge functions:

- `send-sms`
- `create-beneficiary`
- `process-withdrawal`
- `check-transfer-status`

Notably missing from the production collect-payment screen:

- no actual call to `create-upi-qr`

### Admin app requests

Direct table operations:

- `platform_settings`
- `invoices`
- `driver_wallet_transactions`
- `withdrawals`

Edge function usage:

- payout processing and transfer status checks

## Critical Gaps

### Gap 1: Driver collect-payment screen does not actually implement online/QR collection

Primary file:

- [apps/driver/app/ride/collect-payment.tsx](/C:/cart-r-main/apps/driver/app/ride/collect-payment.tsx)

Observations:

- screen state has `paymentMethod` defaulted to `'cash'` at [apps/driver/app/ride/collect-payment.tsx](/C:/cart-r-main/apps/driver/app/ride/collect-payment.tsx#L35)
- `completeTripAtomic(..., paymentMethod)` is called at [apps/driver/app/ride/collect-payment.tsx](/C:/cart-r-main/apps/driver/app/ride/collect-payment.tsx#L293)
- but there is no production UI wiring that changes `paymentMethod`
- there is no production call to `create-upi-qr`
- there is no QR display / “show QR” path in this file

Impact:

- backend support exists for online collection at drop-off
- production driver app does not expose it
- operationally, the app behaves like cash/manual completion

### Gap 2: Cash commission mechanism exists but can fail due to non-negative wallet constraints

Primary files:

- [database schema.txt](/C:/cart-r-main/database%20schema.txt#L191)
- [supabase/migrations/051_fix_cash_commission_debit.sql](/C:/cart-r-main/supabase/migrations/051_fix_cash_commission_debit.sql)

Current cash logic:

- driver collects full fare offline
- backend deducts only the platform commission from `driver_wallets.available_balance`

Problem:

- `available_balance` cannot go below zero
- if driver has low or zero available balance, cash trip completion may fail when commission debit runs

Impact:

- exact business case you called out is not safely handled today
- cash deduction mechanism exists logically, but the ledger model does not support all real cases

### Gap 3: `driver_payout` has conflicting meaning across layers

Primary files:

- [apps/customer/lib/bookings.ts](/C:/cart-r-main/apps/customer/lib/bookings.ts#L65)
- [supabase/migrations/051_fix_cash_commission_debit.sql](/C:/cart-r-main/supabase/migrations/051_fix_cash_commission_debit.sql#L98)

Current meanings:

- app-side booking creation: gross/preliminary payout-like amount
- DB settlement: final net driver share after commission

Impact:

- UI can display incorrect amounts
- reporting can be confusing
- any logic using `driver_payout || total_fare` may hide settlement bugs

### Gap 4: Driver collect-payment UI shows hardcoded commission assumptions

Primary file:

- [apps/driver/app/ride/collect-payment.tsx](/C:/cart-r-main/apps/driver/app/ride/collect-payment.tsx)

Current UI:

- shows `Platform Commission: -₹{Math.round(fare * 0.2)}`
- shows estimated net earnings as `fare * 0.8`

Problem:

- backend commission is configurable in `platform_settings`
- may vary by vehicle type

Impact:

- driver sees the wrong commission split when admin settings differ from 20%

### Gap 5: Source-controlled schema does not fully match live app expectations

Observed examples:

- app code uses `payment_status = 'failed'`
- migration history in repo only clearly shows initial enum `('pending', 'paid', 'refunded')`
- app code references `rollback_partial_wallet_payment`
- generated types know about it, but migration source for it was not found in the repo during this review

Impact:

- new environments may not match production behavior
- future developers may implement against incomplete migration history

## Exact Existing Mechanisms By Business Case

### Case A: Customer books and pays cash to driver

Current mechanism:

1. Booking is created with `payment_method='cash'`.
2. Driver completes trip via `complete_trip_atomic`.
3. Booking becomes `completed` and `paid`.
4. `on_booking_completed` runs.
5. `credit_driver_earning(..., p_is_cash=true)` runs if no prior earning exists.
6. Cash logic:
   - writes `earning` transaction
   - writes `platform_fee` debit transaction
   - deducts platform fee from `driver_wallets.available_balance`
   - sets final `bookings.driver_payout`

What exists:

- yes, backend logic exists

What is broken/risky:

- available-balance debit can fail if wallet has insufficient balance
- no explicit “driver owes commission” model exists

### Case B: Customer pays CartR online before completion

Current mechanism:

1. Customer creates Cashfree order.
2. Booking gets `payment_id` and `payment_method='online'`.
3. Webhook or verify sets `payment_status='paid'`.
4. `on_booking_payment_received` credits pending earning to driver wallet.
5. Driver completes trip.
6. `on_booking_completed` releases pending earning to available.

What exists:

- full backend mechanism exists

What is missing:

- mostly app integration consistency and schema/versioning cleanup

### Case C: Customer pays partly from wallet and partly online

Current mechanism:

1. Wallet RPC deducts wallet amount and marks booking `partial_paid`.
2. Online amount is charged.
3. On success, `complete_partial_payment` marks booking fully paid as `wallet_plus_online`.
4. Driver earning trigger path behaves like other paid-online flows.

What exists:

- customer-side logic exists
- backend support exists

What is risky:

- failure/retry/rollback path depends on functions not fully represented in repo migrations

### Case D: Driver wants to show a UPI QR at completion

Current mechanism:

- backend `create-upi-qr` function exists
- it can:
  - calculate remaining amount considering `wallet_amount_used`
  - create/reuse Cashfree order
  - create QR transaction
  - return QR payload / checkout URL

What exists:

- backend function exists in [supabase/functions/create-upi-qr/index.ts](/C:/cart-r-main/supabase/functions/create-upi-qr/index.ts)

What is missing:

- production driver screen does not call it
- there is no actual driver-facing QR UX path wired today

## Recommended Integration Plan

## Phase 1: Clean up source of truth

Goal:

- make settlement logic fully DB-driven and consistent

Recommended actions:

1. Make `total_fare` the canonical gross customer charge.
2. Make `driver_payout` the canonical final net payout after commission.
3. Stop writing preliminary gross payout into `driver_payout` during booking creation.
4. If a provisional number is needed pre-settlement, use a separate derived variable in app code or introduce a distinct field like `estimated_driver_payout`.
5. Reconcile migrations so all live statuses/functions/enums are represented in source control.

## Phase 2: Decide cash commission business rule explicitly

This is the most important product/finance decision.

### Option A: Driver wallet must be prefunded

Behavior:

- cash rides only complete if driver has enough `available_balance` to cover platform commission

Pros:

- simplest ledger
- no negative balances

Cons:

- drivers can get blocked from completing cash rides
- operationally harsh unless prefunding is enforced clearly

### Option B: Allow driver commission liability

Behavior:

- cash ride completion never fails due to insufficient wallet balance
- platform fee becomes an outstanding payable

Implementation patterns:

- allow negative `available_balance`, or
- create a separate liability field such as `commission_due`, or
- create a separate table/transaction type for unpaid platform fees

Pros:

- matches real ride-hailing operations better
- cash ride can always complete

Cons:

- slightly more complex accounting

Recommendation:

- choose Option B
- do not make cash ride completion depend on pre-existing driver wallet funds

Reason:

- it directly addresses your stated business case
- it avoids operational failure at trip completion

## Phase 3: Finish driver-side online collection flow

Goal:

- support “customer pays driver online at completion” using platform-controlled QR

Recommended behavior:

1. Driver opens collect-payment screen.
2. Driver chooses:
   - `Cash`
   - `Online via CartR QR`
3. If `Online via CartR QR`:
   - call `create-upi-qr`
   - display QR
   - subscribe to booking payment updates
   - only allow trip completion when booking becomes `payment_status='paid'`
4. On completion:
   - call `complete_trip_atomic`
   - preserve existing online `payment_method` if already paid

This aligns with current backend design.

## Phase 4: Make the UI reflect backend-configured commission

Goal:

- driver app and admin reporting must display the same commission model

Recommended actions:

1. Remove hardcoded 20%/80% assumptions from collect-payment screen.
2. Fetch effective commission from backend, ideally from:
   - `platform_settings`
   - optionally vehicle-specific override
3. Show:
   - gross fare
   - platform fee
   - net driver payout
4. Use settled `driver_payout` after completion whenever available.

## Phase 5: Preserve trigger-based settlement

Do not move settlement logic into the mobile apps.

Keep these responsibilities in SQL:

- online earning credit to pending wallet
- release to available on completion
- cash commission handling
- final driver payout calculation
- idempotency protections

The app should:

- collect the right payment intent
- update the booking via RPCs/functions
- display status

The DB should:

- settle money
- enforce consistency

## Proposed Target Flow

### Cash ride target flow

1. Booking created with gross fare only.
2. Driver collects cash offline.
3. Driver completes trip through `complete_trip_atomic(..., 'cash')`.
4. Trigger calculates:
   - gross fare
   - commission
   - net payout
5. System records:
   - `earning` transaction for driver share
   - `platform_fee` liability/debit record
6. Trip completion must succeed even if wallet is empty.

### Online ride target flow

1. Booking created.
2. Customer pays online through CartR flow or driver-generated CartR QR.
3. Payment success updates booking to paid.
4. `on_booking_payment_received` credits pending earning.
5. Driver completes trip.
6. `on_booking_completed` releases pending earning to available.

### Wallet-plus-online target flow

1. Wallet portion deducted first.
2. Remaining amount paid online.
3. Booking becomes fully paid.
4. Driver earning treated as platform-collected digital payment.
5. Release to available at completion.

## Concrete Implementation Tasks For The Next Developer

1. Reconcile migrations with live app expectations.
2. Decide and implement the final accounting model for cash commission liability.
3. Remove preliminary `driver_payout` assignment from booking creation or rename that concept.
4. Wire driver collect-payment screen to:
   - allow payment method selection
   - call `create-upi-qr`
   - render QR
   - wait for `payment_status='paid'` before online completion
5. Replace hardcoded 20% commission display in driver collect-payment UI.
6. Audit all places using `driver_payout || total_fare` and separate:
   - gross fare display
   - net earnings display
7. Add end-to-end tests for:
   - cash trip with zero driver wallet balance
   - online payment before completion
   - QR payment from driver screen
   - wallet-plus-online split
   - commission mismatch display regression

## Files Most Likely To Change During Implementation

### Backend / database

- [supabase/migrations/051_fix_cash_commission_debit.sql](/C:/cart-r-main/supabase/migrations/051_fix_cash_commission_debit.sql)
- new migration(s) for enum/function/schema reconciliation
- possibly [database schema.txt](/C:/cart-r-main/database%20schema.txt) regeneration later

### Driver app

- [apps/driver/app/ride/collect-payment.tsx](/C:/cart-r-main/apps/driver/app/ride/collect-payment.tsx)
- [apps/driver/lib/bookings.ts](/C:/cart-r-main/apps/driver/lib/bookings.ts)
- possibly [apps/driver/lib/wallet.ts](/C:/cart-r-main/apps/driver/lib/wallet.ts)
- possibly [apps/driver/app/(tabs)/earnings.tsx](/C:/cart-r-main/apps/driver/app/%28tabs%29/earnings.tsx)

### Customer app

- [apps/customer/lib/bookings.ts](/C:/cart-r-main/apps/customer/lib/bookings.ts)
- possibly [apps/customer/lib/bookingFlow.ts](/C:/cart-r-main/apps/customer/lib/bookingFlow.ts)
- possibly [apps/customer/app/pay-booking.tsx](/C:/cart-r-main/apps/customer/app/pay-booking.tsx)

### Admin app

- [apps/admin/app/finance/page.tsx](/C:/cart-r-main/apps/admin/app/finance/page.tsx)
- possibly [apps/admin/app/bookings/[id]/page.tsx](/C:/cart-r-main/apps/admin/app/bookings/%5Bid%5D/page.tsx)

## Known Risks

1. Double-credit risk if both webhook and verify path update the same booking incorrectly. Existing idempotency guards help, but this must be preserved.
2. Cash ride failures caused by commission debit against non-negative available balance.
3. Incorrect earnings display because UI falls back to `total_fare` when `driver_payout` is not settled yet.
4. Source-control drift causing staging/dev environments to differ from production.
5. Driver QR flow assumed by test docs but not actually present in production UI.

## Final Recommendation

The backend design should remain trigger/RPC-centered. The next developer should not re-implement settlement in frontend code.

The immediate priorities should be:

1. fix the accounting model for cash commission deduction
2. wire the driver-side online QR payment flow
3. normalize `driver_payout` semantics
4. reconcile schema drift

If those four areas are addressed, the driver commission deduction mechanism will become consistent across cash, online, and wallet-assisted flows.
