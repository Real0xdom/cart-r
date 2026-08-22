# 💰 CartR FinTech Payment System - Implementation Plan

**Date:** February 22, 2026  
**Status:** Ready for Implementation  
**Priority:** HIGH - Core Business Feature

---

## 📋 Executive Summary

This document outlines the complete implementation of a regulated money movement system for CartR logistics app, including:
- Driver wallet with escrow/hold logic
- Cashfree Payouts integration (PG + Payouts)
- Admin withdrawal management
- Revenue analytics dashboard

**Architecture Decision:** Order-based payment → Commission split → Driver payout (NOT prepaid wallet to avoid RBI compliance)

---

## 🎯 Current Database State (from schema.txt)

### ✅ Existing Tables
| Table | Columns Relevant to FinTech |
|-------|---------------------------|
| `users` | `balance` (customer wallet) |
| `drivers` | `total_earnings`, `bank_details` (JSONB) |
| `bookings` | `driver_payout`, `payment_status`, `status` |
| `withdrawals` | ✅ EXISTS - `status`, `amount`, `driver_id` |
| `wallet_transactions` | ✅ EXISTS - `type`, `status`, `booking_id` |

### ❌ Missing Tables/Columns
| Component | Status |
|-----------|--------|
| `platform_settings` | ❌ Missing - for configurable commission |
| `driver_wallets` | ❌ Missing - pending/available split |
| `driver_wallet_transactions` | ❌ Missing - ledger |
| `drivers.beneficiary_id` | ❌ Missing - Cashfree payout |
| `withdrawals.wallet_id` | ❌ Missing - wallet reference |
| `withdrawals.payout_reference` | ❌ Missing - payout tracking |

---

## 🔄 SYSTEM FLOW DIAGRAMS

### Flow 1: Payment & Driver Earnings (MVP)

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Customer   │────▶│   Cashfree PG    │────▶│  Payment Webhook │
│  Pays ₹1000 │     │  (Payment Link)  │     │                  │
└─────────────┘     └──────────────────┘     └────────┬────────┘
                                                      │
                                                      ▼
                                              ┌─────────────────┐
                                              │ Update Booking  │
                                              │ payment_status  │
                                              │ = 'paid'        │
                                              └────────┬────────┘
                                                       │
                                                       ▼
                                              ┌─────────────────┐
                                              │ Calculate       │
                                              │ Commission      │
                                              │ (e.g., 15%)     │
                                              │ driver_payout   │
                                              │ = ₹850          │
                                              └────────┬────────┘
                                                       │
                                                       ▼
                                              ┌─────────────────┐
                                              │ CREDIT to       │
                                              │ driver_wallet   │
                                              │ pending_balance │
                                              │ = ₹850          │
                                              └────────┬────────┘
                                                       │
                        ┌──────────────────────────────┘
                        ▼
               ┌─────────────────┐
               │  TRIP STATUS    │
               │  = 'completed'   │
               └────────┬────────┘
                        │
                        ▼
               ┌─────────────────┐
               │ RELEASE ESCROW  │
               │                 │
               │ pending_balance │
               │      -₹850      │
               │                 │
               │ available_balance│
               │      +₹850      │
               └─────────────────┘
```

### Flow 2: Driver Withdrawal

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Driver    │────▶│ Request With-   │────▶│ Validate:       │
│   clicks    │     │ drawal          │     │ - Bank details │
│   Withdraw  │     │ (RPC)           │     │ - Sufficient   │
│   ₹500      │     │                  │     │   balance      │
└─────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │ Create          │
                                                 │ withdrawal      │
                                                 │ record          │
                                                 │ status='pending'│
                                                 └────────┬────────┘
                                                          │
                         ┌───────────────────────────────┘
                         ▼
                ┌─────────────────┐
                │    ADMIN        │
                │    APPROVES     │
                └────────┬────────┘
                         │
                         ▼
                ┌─────────────────┐
                │ Cashfree        │
                │ Payout API     │
                │ (Transfer to   │
                │  bank account) │
                └────────┬────────┘
                         │
                         ▼
                ┌─────────────────┐
                │ Update:         │
                │ withdrawal      │
                │ status='paid'   │
                │ payout_ref=CF.. │
                │                 │
                │ driver_wallet   │
                │ available_-     │
                │ balance -₹500   │
                └─────────────────┘
```

---

## 📦 PHASE 1: Database Schema & Core Functions

### Task 1.1: Create Platform Settings Table

**File:** `supabase/migrations/050_platform_settings.sql`

```sql
-- Platform Settings Table
CREATE TABLE IF NOT EXISTS platform_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL DEFAULT '{}',
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default settings
INSERT INTO platform_settings (key, value, description) VALUES
    ('commission', 
     '{"default_rate": 15, "by_vehicle_type": {}}', 
     'Default commission rate in percentage'),
    ('payout', 
     '{"min_withdrawal": 100, "auto_approve": false, "batch_processing": false}',
     'Payout configuration'),
    ('kyc', 
     '{"required_for_payout": true, "verified_status": "verified"}',
     'KYC requirements');

-- RLS
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage settings"
    ON platform_settings FOR ALL
    USING (EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    ));
```

### Task 1.2: Create Driver Wallet Tables

**File:** `supabase/migrations/051escrow.sql`

_driver_wallet_```sql
-- 1. Driver Wallets Table
CREATE TABLE IF NOT EXISTS driver_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID UNIQUE REFERENCES drivers(id) NOT NULL,
    pending_balance DECIMAL(10,2) DEFAULT 0,    -- Held until delivery confirmed
    available_balance DECIMAL(10,2) DEFAULT 0,  -- Withdrawable
    total_earned DECIMAL(10,2) DEFAULT 0,      -- Lifetime earnings
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Driver Wallet Transactions (LEDGER)
CREATE TABLE IF NOT EXISTS driver_wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID REFERENCES drivers(id) NOT NULL,
    booking_id UUID REFERENCES bookings(id),
    withdrawal_id UUID REFERENCES withdrawals(id),
    type TEXT CHECK (type IN ('earning', 'release', 'withdrawal', 'refund', 'adjustment', 'payout_fee')),
    amount DECIMAL(10,2) NOT NULL,
    balance_type TEXT CHECK (balance_type IN ('pending', 'available')),
    status TEXT CHECK (status IN ('pending', 'completed', 'failed')),
    reference_id TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add columns to drivers
ALTER TABLE drivers 
    ADD COLUMN IF NOT EXISTS beneficiary_id TEXT,
    ADD COLUMN IF NOT EXISTS beneficiary_status TEXT DEFAULT 'not_created';

-- 4. Add columns to withdrawals
ALTER TABLE withdrawals 
    ADD COLUMN IF NOT EXISTS wallet_id UUID REFERENCES driver_wallets(id),
    ADD COLUMN IF NOT EXISTS payout_reference TEXT,
    ADD COLUMN IF NOT EXISTS payout_status TEXT,
    ADD COLUMN IF NOT EXISTS payout_error TEXT;

-- 5. Create indexes
CREATE INDEX idx_driver_wallet_driver ON driver_wallet_transactions(driver_id);
CREATE INDEX idx_driver_wallet_booking ON driver_wallet_transactions(booking_id);
CREATE INDEX idx_driver_wallet_withdrawal ON driver_wallet_transactions(withdrawal_id);
CREATE INDEX idx_withdrawals_status ON withdrawals(status);

-- 6. RLS
ALTER TABLE driver_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Driver sees own wallet
CREATE POLICY "Drivers can view own wallet"
    ON driver_wallets FOR SELECT
    USING (driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()));

CREATE POLICY "Drivers can view own transactions"
    ON driver_wallet_transactions FOR SELECT
    USING (driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()));

-- Admins see all
CREATE POLICY "Admins can view all driver wallets"
    ON driver_wallets FOR SELECT
    USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can view all driver transactions"
    ON driver_wallet_transactions FOR SELECT
    USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
```

### Task 1.3: Create Core RPC Functions

**File:** `supabase/migrations/052_wallet_functions.sql`

```sql
-- Function: Initialize driver wallet (called on first earnings)
CREATE OR REPLACE FUNCTION ensure_driver_wallet(p_driver_id UUID)
RETURNS UUID AS $$
DECLARE
    v_wallet_id UUID;
BEGIN
    SELECT id INTO v_wallet_id FROM driver_wallets WHERE driver_id = p_driver_id;
    IF v_wallet_id IS NULL THEN
        INSERT INTO driver_wallets (driver_id) VALUES (p_driver_id) RETURNING id INTO v_wallet_id;
    END IF;
    RETURN v_wallet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Credit pending earning (called on payment success)
CREATE OR REPLACE FUNCTION credit_pending_earning(
    p_driver_id UUID,
    p_booking_id UUID,
    p_amount DECIMAL(10,2)
)
RETURNS JSONB AS $$
DECLARE
    v_wallet_id UUID;
    v_commission_rate DECIMAL(5,2);
    v_driver_share DECIMAL(10,2);
    v_platform_fee DECIMAL(10,2);
BEGIN
    -- Get commission rate from settings
    SELECT (value->>'default_rate')::DECIMAL INTO v_commission_rate
    FROM platform_settings WHERE key = 'commission';
    
    IF v_commission_rate IS NULL THEN
        v_commission_rate := 15;
    END IF;
    
    -- Calculate split
    v_platform_fee := ROUND(p_amount * v_commission_rate / 100, 2);
    v_driver_share := p_amount - v_platform_fee;
    
    -- Ensure wallet exists
    v_wallet_id := ensure_driver_wallet(p_driver_id);
    
    -- Update wallet
    UPDATE driver_wallets
    SET pending_balance = pending_balance + v_driver_share,
        total_earned = total_earned + v_driver_share,
        updated_at = NOW()
    WHERE id = v_wallet_id;
    
    -- Create ledger entry
    INSERT INTO driver_wallet_transactions
        (driver_id, booking_id, type, amount, balance_type, status, description)
    VALUES
        (p_driver_id, p_booking_id, 'earning', v_driver_share, 'pending', 'completed', 
         'Earning from booking - pending release');
    
    -- Update booking with driver_payout
    UPDATE bookings
    SET driver_payout = v_driver_share
    WHERE id = p_booking_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'amount', v_driver_share,
        'platform_fee', v_platform_fee,
        'commission_rate', v_commission_rate
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Release pending to available (called on trip completion)
CREATE OR REPLACE FUNCTION release_pending_earning(p_booking_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_booking RECORD;
    v_wallet_id UUID;
    v_amount DECIMAL(10,2);
BEGIN
    SELECT driver_id, driver_payout INTO v_booking
    FROM bookings WHERE id = p_booking_id;
    
    IF v_booking.driver_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No driver assigned');
    END IF;
    
    SELECT id INTO v_wallet_id FROM driver_wallets WHERE driver_id = v_booking.driver_id;
    IF v_wallet_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
    END IF;
    
    SELECT amount INTO v_amount
    FROM driver_wallet_transactions
    WHERE booking_id = p_booking_id AND type = 'earning' AND balance_type = 'pending'
    LIMIT 1;
    
    IF v_amount IS NULL OR v_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No pending earnings found');
    END IF;
    
    UPDATE driver_wallets
    SET pending_balance = pending_balance - v_amount,
        available_balance = available_balance + v_amount,
        updated_at = NOW()
    WHERE id = v_wallet_id;
    
    INSERT INTO driver_wallet_transactions
        (driver_id, booking_id, type, amount, balance_type, status, description)
    VALUES
        (v_booking.driver_id, p_booking_id, 'release', v_amount, 'available', 'completed',
         'Earning released after trip completion');
    
    RETURN jsonb_build_object('success', true, 'released', v_amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get driver balance (updated to use wallet table)
CREATE OR REPLACE FUNCTION get_driver_balance(p_driver_id UUID)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    v_available DECIMAL(10,2);
BEGIN
    SELECT available_balance INTO v_available
    FROM driver_wallets
    WHERE driver_id = p_driver_id;
    
    RETURN COALESCE(v_available, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get full wallet info
CREATE OR REPLACE FUNCTION get_driver_wallet_info(p_driver_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_wallet RECORD;
    v_driver RECORD;
BEGIN
    PERFORM ensure_driver_wallet(p_driver_id);
    
    SELECT * INTO v_wallet FROM driver_wallets WHERE driver_id = p_driver_id;
    SELECT * INTO v_driver FROM drivers WHERE id = p_driver_id;
    
    RETURN jsonb_build_object(
        'pending_balance', COALESCE(v_wallet.pending_balance, 0),
        'available_balance', COALESCE(v_wallet.available_balance, 0),
        'total_earned', COALESCE(v_wallet.total_earned, 0),
        'bank_details', v_driver.bank_details,
        'beneficiary_status', v_driver.beneficiary_status,
        'verification_status', v_driver.verification_status
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Request withdrawal (updated with wallet)
CREATE OR REPLACE FUNCTION request_withdrawal(
    p_driver_id UUID, 
    p_amount DECIMAL(10,2),
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_balance DECIMAL(10,2);
    v_wallet_id UUID;
    v_bank_details JSONB;
    v_min_withdrawal DECIMAL(10,2);
    v_kyc_required BOOLEAN;
    v_withdrawal_id UUID;
BEGIN
    SELECT (value->>'min_withdrawal')::DECIMAL INTO v_min_withdrawal
    FROM platform_settings WHERE key = 'payout';
    v_min_withdrawal := COALESCE(v_min_withdrawal, 100);
    
    SELECT (value->>'required_for_payout')::BOOLEAN INTO v_kyc_required
    FROM platform_settings WHERE key = 'kyc';
    v_kyc_required := COALESCE(v_kyc_required, true);
    
    IF p_idempotency_key IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM withdrawals WHERE idempotency_key = p_idempotency_key) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Withdrawal already requested');
        END IF;
    END IF;
    
    PERFORM pg_advisory_xact_lock(hashtext('withdrawal_' || p_driver_id::text));
    
    IF v_kyc_required THEN
        IF NOT EXISTS (
            SELECT 1 FROM drivers 
            WHERE id = p_driver_id AND verification_status = 'verified'
        ) THEN
            RETURN jsonb_build_object('success', false, 'error', 'KYC verification required for withdrawal');
        END IF;
    END IF;
    
    SELECT bank_details INTO v_bank_details
    FROM drivers WHERE id = p_driver_id;
    
    IF v_bank_details IS NULL OR v_bank_details = 'null'::jsonb THEN
        RETURN jsonb_build_object('success', false, 'error', 'Please add bank details first');
    END IF;
    
    IF p_amount < v_min_withdrawal THEN
        RETURN jsonb_build_object('success', false, 'error', 'Minimum withdrawal amount is ₹' || v_min_withdrawal);
    END IF;
    
    v_balance := get_driver_balance(p_driver_id);
    IF v_balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance: ₹' || v_balance);
    END IF;
    
    SELECT id INTO v_wallet_id FROM driver_wallets WHERE driver_id = p_driver_id;
    
    UPDATE driver_wallets
    SET available_balance = available_balance - p_amount,
        updated_at = NOW()
    WHERE id = v_wallet_id;
    
    INSERT INTO withdrawals (driver_id, amount, status, idempotency_key, wallet_id)
    VALUES (p_driver_id, p_amount, 'pending', p_idempotency_key, v_wallet_id)
    RETURNING id INTO v_withdrawal_id;
    
    INSERT INTO driver_wallet_transactions
        (driver_id, withdrawal_id, type, amount, balance_type, status, description)
    VALUES (p_driver_id, v_withdrawal_id, 'withdrawal', p_amount, 'available', 'pending', 'Withdrawal requested');
    
    RETURN jsonb_build_object('success', true);
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Task 1.4: Update Booking Completion Trigger

**File:** `supabase/migrations/053_update_completion_trigger.sql`

```sql
-- Update the existing trigger to also release escrow
CREATE OR REPLACE FUNCTION update_driver_stats_with_escrow()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        
        -- Update driver stats (existing logic)
        UPDATE drivers
        SET 
            total_trips = COALESCE(total_trips, 0) + 1,
            total_earnings = COALESCE(total_earnings, 0) + COALESCE(NEW.driver_payout, NEW.total_fare, 0),
            updated_at = NOW()
        WHERE id = NEW.driver_id;
        
        -- Release escrow (NEW)
        PERFORM release_pending_earning(NEW.id);
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Replace trigger
DROP TRIGGER IF EXISTS on_booking_completed_update_stats ON bookings;
CREATE TRIGGER on_booking_completed_update_stats
    AFTER UPDATE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_driver_stats_with_escrow();
```

### Task 1.5: Update Payment Webhook

**File:** `supabase/functions/credit-driver-earning/index.ts` (NEW)

```typescript
// Simplified - calls the RPC function
serve(async (req) => {
    const { booking_id, driver_id, amount } = await req.json();
    
    const result = await supabase.rpc('credit_pending_earning', {
        p_driver_id: driver_id,
        p_booking_id: booking_id,
        p_amount: amount
    });
    
    return Response.json(result);
});
```

---

## 📦 PHASE 2: Admin Settings UI

### Task 2.1: Add Commission & Payout Settings

**File:** `apps/admin/app/settings/page.tsx` (ENHANCE)

Add new tab/section for:
- **Commission Settings**
  - Default commission rate (%) - default 15%
  - Per-vehicle-type rates (advanced)
- **Payout Settings**
  - Minimum withdrawal amount (₹100 default)
  - Auto-approve withdrawals toggle
  - Batch processing toggle
- **KYC Settings**
  - Require KYC for payout toggle

---

## 📦 PHASE 3: Cashfree Payouts Integration

### Task 3.1: Add Environment Variables

```
# Supabase Edge Functions (in Supabase Dashboard)
CASHFREE_PG_APP_ID=your_payout_app_id
CASHFREE_PG_SECRET_KEY=your_payout_secret_key  
CASHFREE_PG_ENV=sandbox
```

### Task 3.2: Create Beneficiary Edge Function

**File:** `supabase/functions/cashfree-payouts/create-beneficiary/index.ts`

```typescript
// Creates driver as beneficiary in Cashfree
serve(async (req) => {
    const { driver_id } = await req.json();
    
    const { data: driver } = await supabase
        .from('drivers')
        .select('*, user:users(name, phone)')
        .eq('id', driver_id)
        .single();
    
    const bank = driver.bank_details;
    
    const response = await fetch(`${CF_PG_BASE_URL}/beneficiary`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-client-id': CASHFREE_PG_APP_ID,
            'x-client-secret': CASHFREE_PG_SECRET_KEY,
        },
        body: JSON.stringify({
            beneficiary_id: driver_id,
            beneficiary_name: bank.account_holder_name,
            bank_account: bank.account_number,
            ifsc: bank.ifsc_code,
            phone: driver.user?.phone,
            email: driver.user?.email
        })
    });
    
    await supabase.from('drivers').update({
        beneficiary_id: response.beneficiary_id,
        beneficiary_status: 'active'
    }).eq('id', driver_id);
    
    return Response.json({ success: true });
});
```

### Task 3.3: Process Withdrawal Edge Function

**File:** `supabase/functions/cashfree-payouts/process-withdrawal/index.ts`

```typescript
serve(async (req) => {
    const { withdrawal_id, admin_id } = await req.json();
    
    const { data: withdrawal } = await supabase
        .from('withdrawals')
        .select('*, driver:drivers(*), wallet:driver_wallets(*)')
        .eq('id', withdrawal_id)
        .single();
    
    if (!withdrawal.driver.beneficiary_id) {
        await createBeneficiary(withdrawal.driver_id);
    }
    
    const payoutResponse = await fetch(`${CF_PG_BASE_URL}/payouts`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-client-id': CASHFREE_PG_APP_ID,
            'x-client-secret': CASHFREE_PG_SECRET_KEY,
        },
        body: JSON.stringify({
            beneficiary_id: withdrawal.driver_id,
            amount: withdrawal.amount,
            currency: 'INR',
            mode: 'IMPS',
            purpose: 'Refund',
            reference_id: withdrawal.id
        })
    });
    
    await supabase.from('withdrawals').update({
        status: payoutResponse.status === 'SUCCESS' ? 'paid' : 'pending',
        payout_reference: payoutResponse.reference_id,
        payout_status: payoutResponse.status,
        processed_at: new Date().toISOString()
    }).eq('id', withdrawal_id);
    
    return Response.json({ success: true, reference: payoutResponse.reference_id });
});
```

### Task 3.4: Update Withdrawal RPCs

**File:** `supabase/migrations/054_withdrawal_approval.sql`

```sql
-- Function: Approve withdrawal
CREATE OR REPLACE FUNCTION approve_withdrawal(
    p_withdrawal_id UUID,
    p_admin_id UUID,
    p_auto_process BOOLEAN DEFAULT false
)
RETURNS JSONB AS $$
DECLARE
    v_withdrawal RECORD;
BEGIN
    SELECT * INTO v_withdrawal FROM withdrawals WHERE id = p_withdrawal_id;
    
    IF v_withdrawal.status != 'pending' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Withdrawal not pending');
    END IF;
    
    UPDATE withdrawals
    SET status = 'approved', updated_at = NOW()
    WHERE id = p_withdrawal_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Withdrawal approved');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Reject withdrawal
CREATE OR REPLACE FUNCTION reject_withdrawal(
    p_withdrawal_id UUID,
    p_admin_id UUID,
    p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_withdrawal RECORD;
BEGIN
    SELECT * INTO v_withdrawal FROM withdrawals WHERE id = p_withdrawal_id;
    
    IF v_withdrawal.status != 'pending' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Withdrawal not pending');
    END IF;
    
    -- Revert balance
    UPDATE driver_wallets
    SET available_balance = available_balance + v_withdrawal.amount,
        updated_at = NOW()
    WHERE id = v_withdrawal.wallet_id;
    
    UPDATE withdrawals
    SET status = 'rejected', admin_notes = p_reason, updated_at = NOW()
    WHERE id = p_withdrawal_id;
    
    INSERT INTO driver_wallet_transactions
        (driver_id, withdrawal_id, type, amount, balance_type, status, description)
    VALUES (v_withdrawal.driver_id, p_withdrawal_id, 'adjustment', v_withdrawal.amount, 'available', 'completed',
           'Withdrawal rejected: ' || p_reason);
    
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 📦 PHASE 4: Admin Withdrawal Management UI

### Task 4.1: Create Payouts Page

**File:** `apps/admin/app/payouts/page.tsx` (NEW)

Features:
- List all withdrawals (filterable by status: pending/approved/paid/rejected)
- Show driver name, bank details (masked), amount, date
- Approve button → triggers payout
- Reject button → with reason modal
- Bulk approve capability

### Task 4.2: Enhance Driver Detail Page

**File:** `apps/admin/app/drivers/[id]/page.tsx` (ENHANCE)

Add "Wallet" tab:
- Pending balance
- Available balance
- Total earned
- Transaction history
- Bank details
- Beneficiary status (register/verify button)

---

## 📦 PHASE 5: Enhanced Analytics Dashboard

### Task 5.1: Update Analytics Page

**File:** `apps/admin/app/analytics/page.tsx` (ENHANCE)

Add metrics:

| Metric | Source | Display |
|--------|--------|---------|
| GMV | `SUM(total_fare)` completed | Revenue card |
| Platform Commission | `SUM(total_fare - driver_payout)` | Revenue card |
| Commission % | Commission / GMV * 100 | Calculated |
| Driver Payout Liability | `SUM(available_balance)` | Liability card |
| Pending Earnings | `SUM(pending_balance)` | Liability card |
| Withdrawal Requests | Count pending | Action card |

### Task 5.2: Add Revenue Tab

**File:** `apps/admin/app/finance/page.tsx` (ENHANCE)

- Daily/weekly/monthly revenue trend chart
- Commission by vehicle type breakdown
- Refund tracking
- Payout fee tracking

---

## 📋 IMPLEMENTATION CHECKLIST

### Database (SQL Migrations)
- [ ] Task 1.1: Create platform_settings table
- [ ] Task 1.2: Create driver_wallets & driver_wallet_transactions
- [ ] Task 1.3: Create RPC functions (credit, release, balance, withdrawal)
- [ ] Task 1.4: Update booking completion trigger
- [ ] Task 1.5: Update payment webhook to credit earnings

### Admin UI
- [ ] Task 2.1: Add commission & payout settings to settings page

### Cashfree Payouts
- [ ] Task 3.1: Add env variables to Supabase
- [ ] Task 3.2: Create beneficiary edge function
- [ ] Task 3.3: Create payout processing edge function
- [ ] Task 3.4: Create approve/reject RPC functions

### Admin Payout Management
- [ ] Task 4.1: Create payouts management page
- [ ] Task 4.2: Enhance driver detail with wallet tab

### Analytics
- [ ] Task 5.1: Enhance analytics dashboard
- [ ] Task 5.2: Add revenue charts

---

## 🔗 DEPENDENCY ORDER

```
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 1 (Foundation)                          │
├─────────────────────────────────────────────────────────────────┤
│  1.1 → 1.2 → 1.3 → 1.4 → 1.5                                  │
│  (All SQL - creates core wallet system)                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 2 (Admin Settings)                     │
├─────────────────────────────────────────────────────────────────┤
│  2.1                                                            │
│  (UI for commission configuration)                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 3 (Cashfree Payouts)                   │
├─────────────────────────────────────────────────────────────────┤
│  3.1 → 3.2 → 3.3 → 3.4                                         │
│  (API integration + approval logic)                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 4 (Admin UI)                           │
├─────────────────────────────────────────────────────────────────┤
│  4.1 → 4.2                                                      │
│  (Payout management pages)                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 5 (Analytics)                           │
├─────────────────────────────────────────────────────────────────┤
│  5.1 → 5.2                                                      │
│  (Enhanced dashboards)                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## ⏱️ TIME ESTIMATES

| Phase | Tasks | Hours |
|-------|-------|-------|
| Phase 1 | DB Schema + Functions | 3-4 |
| Phase 2 | Admin Settings UI | 1 |
| Phase 3 | Cashfree Payouts | 3-4 |
| Phase 4 | Admin Payout UI | 2 |
| Phase 5 | Analytics Dashboard | 1-2 |
| **TOTAL** | | **10-13** |

---

## ⚠️ IMPORTANT NOTES

1. **Testing:** Use sandbox credentials first - Cashfree sandbox is separate from production
2. **Idempotency:** All withdrawal operations use idempotency keys to prevent double-processing
3. **Race Conditions:** Advisory locks prevent concurrent withdrawal requests
4. **Audit Trail:** All wallet operations create ledger entries (never delete, always reverse)
5. **KYC:** Driver must be verified before withdrawal (configurable)
6. **Compliance:** This is order-based, not wallet-based, avoiding RBI prepaid wallet regulations

---

## Your Configuration (from discussion)

| Setting | Value |
|---------|-------|
| Commission Rate | Configurable (admin sets from console) |
| Min Withdrawal | Configurable (admin sets from console) |
| Auto-approve | Configurable (admin sets from console) |
| KYC Required | Yes - driver must be verified |
| Payout Mode | Both manual and auto supported |
