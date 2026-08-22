# 💳 Wallet Payment System Documentation

**Date:** January 20, 2026
**Status:** ✅ Live & Verified
**Deployed Via:** Browser Automation (Supabase SQL Editor)

## 1. Overview
The Wallet Payment System allows customers to pay for rides using their in-app wallet balance. It supports:
- **Full Payment:** Covering the entire fare with wallet.
- **Partial Payment:** Paying available balance + remaining via Cash/Online.
- **Atomic Transactions:** Ensures balance is deducted safely using database row locks.

## 2. Key Components

### A. Backend (Database)
File: `supabase/migrations/20260119230000_wallet_payment_system.sql`
- **Function:** `pay_with_wallet(booking_id, user_id, use_full_wallet)`
  - Locks booking & user rows.
  - Deducts balance.
  - Updates booking status to `completed` (Full) or `partial_paid`.
  - Records transaction in `wallet_transactions`.
- **Function:** `complete_partial_payment(booking_id, ...)`
  - Handles the second leg of payment if needed.

### B. Customer App
- **File:** `apps/customer/app/select-vehicle.tsx`
- **Features:**
  - "Pay with Wallet" selector.
  - Real-time balance check (`lib/walletPayment.ts`).
  - Automatic deduction trigger upon booking.

### C. Driver App
- **File:** `apps/driver/app/ride/collect-payment.tsx`
- **Features:**
  - Recognizes `completed` status as **PAID** (Green).
  - Recognizes `partial_paid` status.
  - **Auto-Calculation:** Displays `Total Fare - Wallet Amount` = **Cash to Collect**.

### D. Admin Dashboard
- **File:** `apps/admin/app/bookings/[id]/page.tsx`
- **Features:**
  - Displays new payment statuses with color coding.
  - Shows breakdown of payment methods.

## 3. Usage Guide

### How to test:
1.  **Add Balance:** Manually add balance to a test user in Supabase (`users` table).
2.  **Book Ride:** Select "Pay with Wallet" in Customer App.
3.  **Verify:** 
    - Customer: Booking confirmed, balance deducted.
    - Driver: See "Paid" or "Partial Paid" screen.
    - Admin: See transaction details.

## 4. Troubleshooting
- **DNS Issues:** The local environment blocks direct DB connections (`db.epevjbiymsvwmmzybzib.supabase.co`). Always use the Supabase Dashboard or API for DB changes.
- **Status Mismatch:** If Driver app shows "Pending" for a paid ride, ensure the `collect-payment.tsx` logic checks for `completed` status (already fixed).
