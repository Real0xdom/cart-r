# 🎯 WALLET PAYMENT SYSTEM - COMPLETE IMPLEMENTATION

## ✅ **IMPLEMENTED: Database Layer** 

**File Created:** `supabase/migrations/wallet_payment_system.sql`

**Functions:**
1. ✅ `pay_with_wallet()` - Full or partial wallet payment
2. ✅ `complete_partial_payment()` - Finalize after online payment
3. ✅ Race condition protection (row locks with NOWAIT)
4. ✅ Idempotency checks (payment_status validation)
5. ✅ Atomic transactions

---

## 📋 **TODO: Frontend Implementation**

Due to response size limits, here's what needs to be implemented:

### **Step 1: Run SQL Migration**
```bash
# Upload wallet_payment_system.sql to Supabase Dashboard
# Or run via CLI:
supabase db push
```

### **Step 2: Update TypeScript Types**
**File:** `apps/customer/types/type.d.ts`
```typescript
// Update payment_method type
payment_method: 'cash' | 'online' | 'wallet' | 'partial_wallet' | 'wallet_plus_online';

// Update Booking interface
wallet_amount_used?: number;
payment_session_id?: string;
online_payment_order_id?: string;
```

### **Step 3: Create Wallet Payment Library**
**File:** `apps/customer/lib/walletPayment.ts`
```typescript
import { supabase } from './supabase';

export async function payWithWallet(
  bookingId: string,
  userId: string,
  useFullWallet: boolean = true,
  paymentSessionId?: string
) {
  const { data, error } = await supabase.rpc('pay_with_wallet', {
    p_booking_id: bookingId,
    p_user_id: userId,
    p_use_full_wallet: useFullWallet,
    p_payment_session_id: paymentSessionId
  });
  
  if (error) return { success: false, error: error.message };
  return data;
}

export async function completePartialPayment(
  bookingId: string,
  paymentOrderId: string,
  amountPaid: number
) {
  const { data, error } = await supabase.rpc('complete_partial_payment', {
    p_booking_id: bookingId,
    p_payment_order_id: paymentOrderId,
    p_amount_paid: amountPaid
  });
  
  if (error) return { success: false, error: error.message };
  return data;
}
```

### **Step 4: Add Payment Method Selector**
**File:** `apps/customer/app/select-vehicle.tsx`

Add payment method selection UI with:
- Wallet option (show balance)
- Cash option
- Partial wallet option (auto-calculated)
- Visual indicators for insufficient balance

### **Step 5: Integrate with Track-Ride**
**File:** `apps/customer/app/track-ride.tsx`

Add "Pay Now" button for wallet payments during ride.

---

## ⚠️ **CRITICAL: Next Steps Required**

This is 40% complete. I've created the **database foundation** which is the most critical part.

**Remaining work (2-3 hours):**
1. Update TypeScript types
2. Create wallet payment library functions
3. Add UI components for payment selection
4. Integrate with existing Cashfree flow
5. Add button locking
6. Create test scenarios

**Would you like me to:**
A. Continue with frontend implementation (will need multiple messages)
B. Create a step-by-step guide you can follow
C. Focus on specific components first

**I've created the hardest part (SQL with race conditions). The frontend is straightforward but lengthy.**

Please advise how to proceed!
