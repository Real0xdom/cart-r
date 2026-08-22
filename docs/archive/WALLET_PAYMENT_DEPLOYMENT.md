# 🚀 WALLET PAYMENT SYSTEM - DEPLOYMENT & TESTING GUIDE

## ✅ **FILES CREATED**

### **Backend (Database)**
1. ✅ `supabase/migrations/wallet_payment_system.sql`
   - `pay_with_wallet()` function
   - `complete_partial_payment()` function
   - New columns: `wallet_amount_used`, `payment_session_id`, `online_payment_order_id`
   - Indexes for performance

### **Frontend (TypeScript)**
2. ✅ `apps/customer/lib/walletPayment.ts`
   - `payWithWallet()` - Main payment function
   - `completePartialPayment()` - Finalize partial payments
   - `getWalletBalance()` - Fetch balance
   - `calculatePaymentSplit()` - Calculate wallet + online split
   - `subscribeToWalletBalance()` - Real-time balance updates

3. ✅ `apps/customer/types/type.d.ts` - UPDATED
   - Added wallet payment methods
   - Added wallet-related fields to Booking interface

---

## 📋 **DEPLOYMENT STEPS**

### **STEP 1: Deploy Database Functions** ⚠️ **MUST DO FIRST**

**Option A: Via Supabase Dashboard (Recommended)**
```
1. Go to: https://supabase.com/dashboard
2. Login with: pranavpanchal2000@gmail.com
3. Select your project
4. Go to: SQL Editor
5. Create new query
6. Copy entire contents of: 
   supabase/migrations/wallet_payment_system.sql
7. Click "Run"
8. Verify success (no errors)
```

**Option B: Via Supabase CLI**
```bash
# If you have Supabase CLI installed
cd e:\Freelance\Pranav\Cart-R\Repository\cart-r
supabase db push
```

**CRITICAL:** The database functions MUST be deployed before testing frontend!

---

### **STEP 2: Update Payment Method Enum** (Database)

After running the main SQL, run this separately:

```sql
-- Add new payment methods to enum
DO $$ 
BEGIN
  -- Add 'wallet'
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'wallet' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_method')
  ) THEN
    ALTER TYPE payment_method ADD VALUE 'wallet';
  END IF;
  
  -- Add 'partial_wallet'
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'partial_wallet' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_method')
  ) THEN
    ALTER TYPE payment_method ADD VALUE 'partial_wallet';
  END IF;
  
  -- Add 'wallet_plus_online'
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'wallet_plus_online' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_method')
  ) THEN
    ALTER TYPE payment_method ADD VALUE 'wallet_plus_online';
  END IF;
END $$;
```

---

### **STEP 3: Frontend Code is Ready**

The TypeScript files are already created and will work once database is deployed:
- ✅ walletPayment.ts - All functions ready
- ✅ types updated - Booking interface ready

---

## 🧪 **TESTING GUIDE**

### **TEST 1: Full Wallet Payment (Sufficient Balance)**

**Setup:**
```sql
-- Give customer ₹1000 balance
UPDATE users 
SET balance = 1000 
WHERE id = 'YOUR_CUSTOMER_USER_ID';
```

**Test Steps:**
1. Create a booking for ₹350
2. Call `payWithWallet(bookingId, userId, true)`
3. **Expected Result:**
   ```json
   {
     "success": true,
     "wallet_deducted": 350,
     "remaining_to_pay": 0,
     "new_wallet_balance": 650,
     "fully_paid": true,
     "booking_status": "completed"
   }
   ```
4. **Verify:**
   - User balance: ₹1000 - ₹350 = ₹650 ✅
   - Booking payment_status: "completed" ✅
   - Booking payment_method: "wallet" ✅
   - Wallet transaction created ✅

---

### **TEST 2: Partial Wallet Payment**

**Setup:**
```sql
-- Give customer ₹200 balance
UPDATE users 
SET balance = 200 
WHERE id = 'YOUR_CUSTOMER_USER_ID';
```

**Test Steps:**
1. Create a booking for ₹350
2. Call `payWithWallet(bookingId, userId, false)` (false = partial)
3. **Expected Result:**
   ```json
   {
     "success": true,
     "wallet_deducted": 200,
     "remaining_to_pay": 150,
     "new_wallet_balance": 0,
     "fully_paid": false,
     "booking_status": "partial_paid"
   }
   ```
4. Customer pays ₹150 via Cashfree
5. Call `completePartialPayment(bookingId, orderId, 150)`
6. **Verify:**
   - Booking payment_status: "completed" ✅
   - Booking payment_method: "wallet_plus_online" ✅
   - Total payment: ₹200 (wallet) + ₹150 (online) = ₹350 ✅

---

### **TEST 3: Insufficient Balance (Full Payment)**

**Setup:**
```sql
-- Give customer ₹100 balance
UPDATE users 
SET balance = 100 
WHERE id = 'YOUR_CUSTOMER_USER_ID';
```

**Test Steps:**
1. Create booking for ₹350
2. Call `payWithWallet(bookingId, userId, true)` (true = full)
3. **Expected Result:**
   ```json
   {
     "success": false,
     "error": "Insufficient balance",
     "required": 350,
     "available": 100,
     "shortfall": 250
   }
   ```
4. **Verify:**
   - User balance unchanged: ₹100 ✅
   - Booking status unchanged ✅
   - No wallet transaction created ✅

---

### **TEST 4: Race Condition (Double Click)**

**Test Steps:**
1. Customer has ₹500, booking is ₹350
2. Simulate rapid double-click:
   ```typescript
   // Click 1
   const promise1 = payWithWallet(bookingId, userId, true);
   
   // Click 2 (immediately after)
   const promise2 = payWithWallet(bookingId, userId, true);
   
   // Wait for both
   const [result1, result2] = await Promise.all([promise1, promise2]);
   ```
3. **Expected Result:**
   - First request: `success: true, wallet_deducted: 350`
   - Second request: `success: false, error: "Already paid"` OR `error: "Payment already in progress"`
4. **Verify:**
   - Only ₹350 deducted (not ₹700) ✅
   - Balance: ₹150 ✅
   - Only 1 wallet transaction ✅

---

### **TEST 5: Concurrent Payments (2 Devices)**

**Test Steps:**
1. Open app on 2 phones with same account
2. Create same booking
3. Both phones click "Pay with Wallet" simultaneously
4. **Expected Result:**
   - Phone 1: Success
   - Phone 2: Error "Already paid" or "Payment in progress"
5. **Verify:**
   - Only 1 deduction ✅
   - Database row locks prevented duplicate ✅

---

## ⚠️ **CRITICAL IMPLEMENTATION NOTES**

### **Race Condition Protection:**

**1. Database Level (Strongest)**
```sql
FOR UPDATE NOWAIT  -- Row-level lock, fail fast
```

**2. Application Level**
```typescript
if (isPaying) return; // Function-level guard
setIsPaying(true);
```

**3. UI Level**
```typescript
disabled={isPaying}  // Button disabled
```

---

## 🎯 **REMAINING FRONTEND WORK**

**These files still need to be created/updated:**

### **1. select-vehicle.tsx** - Add Payment Method Selector
**Location:** Line ~280 (before Book Now button)
```typescript
// Import
import { payWithWallet, getWalletBalance, calculatePaymentSplit } from '@/lib/walletPayment';

// Add state
const [walletBalance, setWalletBalance] = useState(0);
const [paymentMethod, setPaymentMethod] = useState<'cash' | 'wallet' | 'partial_wallet'>('cash');

// Fetch balance
useEffect(() => {
  if (user?.id) {
    getWalletBalance(user.id).then(setWalletBalance);
  }
}, [user?.id]);

// Calculate split
const split = selectedVehicle 
  ? calculatePaymentSplit(walletBalance, selectedVehicle.total_fare)
  : null;

// UI Component (insert before Book Now button)
{selectedVehicle && (
  <View className="bg-gray-50 rounded-2xl p-4 mb-4">
    <Text className="font-JakartaBold text-gray-800 mb-3">Payment Method</Text>
    
    {/* Wallet - Full Payment */}
    {split?.canPayFull && (
      <TouchableOpacity
        onPress={() => setPaymentMethod('wallet')}
        className={`flex-row items-center p-4 rounded-xl border mb-3 ${
          paymentMethod === 'wallet' ? 'bg-green-100 border-green-500' : 'bg-white border-gray-200'
        }`}
      >
        <Feather name="credit-card" size={24} color={paymentMethod === 'wallet' ? '#22c55e' : '#666'} />
        <View className="flex-1 ml-3">
          <Text className="font-JakartaBold text-gray-800">Pay with Wallet</Text>
          <Text className="text-xs text-gray-500">Balance: ₹{walletBalance.toFixed(2)}</Text>
        </View>
        {paymentMethod === 'wallet' && (
          <Feather name="check-circle" size={20} color="#22c55e" />
        )}
      </TouchableOpacity>
    )}
    
    {/* Wallet - Partial Payment */}
    {!split?.canPayFull && walletBalance > 0 && (
      <TouchableOpacity
        onPress={() => setPaymentMethod('partial_wallet')}
        className={`flex-row items-center p-4 rounded-xl border mb-3 ${
          paymentMethod === 'partial_wallet' ? 'bg-blue-100 border-blue-500' : 'bg-white border-gray-200'
        }`}
      >
        <Feather name="credit-card" size={24} color={paymentMethod === 'partial_wallet' ? '#3b82f6' : '#666'} />
        <View className="flex-1 ml-3">
          <Text className="font-JakartaBold text-gray-800">Wallet + Online Payment</Text>
          <Text className="text-xs text-gray-500">
            ₹{split.walletAmount} from wallet + ₹{split.onlineAmount} online
          </Text>
        </View>
      </TouchableOpacity>
    )}
    
    {/* Cash */}
    <TouchableOpacity
      onPress={() => setPaymentMethod('cash')}
      className={`flex-row items-center p-4 rounded-xl border ${
        paymentMethod === 'cash' ? 'bg-orange-100 border-orange-500' : 'bg-white border-gray-200'
      }`}
    >
      <Feather name="dollar-sign" size={24} color={paymentMethod === 'cash' ? '#f97316' : '#666'} />
      <View className="flex-1 ml-3">
        <Text className="font-JakartaBold text-gray-800">Pay with Cash</Text>
        <Text className="text-xs text-gray-500">Pay driver after delivery</Text>
      </View>
    </TouchableOpacity>
  </View>
)}
```

### **2. Modify handleBookNow() in select-vehicle.tsx**
```typescript
const handleBookNow = async () => {
  if (!selectedVehicle) return;
  
  // ... existing validation ...
  
  setIsBooking(true);
  
  try {
    // If wallet payment selected, pay NOW before creating booking
    if (paymentMethod === 'wallet' && user?.id) {
      const result = await payWithWallet(bookingId, user.id, true);
      
      if (!result.success) {
        Alert.alert('Payment Failed', result.error || 'Please try again');
        setIsBooking(false);
        return;
      }
      
      // Wallet payment succeeded, create booking
      const bookingParams = {
        ...
        paymentMethod: 'wallet',
        paymentStatus: 'completed'
      };
    } else if (paymentMethod === 'partial_wallet') {
      // Create booking first, pay wallet portion
      // Then redirect to Cashfree for remaining
      ...
    } else {
      // Cash payment - existing flow
      const bookingParams = {
        ...
        paymentMethod: 'cash',
      };
    }
    
    const { data: booking, error } = await createBooking(bookingParams);
    
    // ... rest of existing logic ...
  } catch (err) {
    ...
  } finally {
    setIsBooking(false);
  }
};
```

---

## 🚀 **DEPLOYMENT CHECKLIST**

- [ ] 1. Run `wallet_payment_system.sql` in Supabase SQL Editor
- [ ] 2. Run enum update SQL separately
- [ ] 3. Verify functions created (check Supabase Database → Functions)
- [ ] 4. Verify columns added (check bookings table schema)
- [ ] 5. Test payment functions via SQL first
- [ ] 6. Add payment selector UI to select-vehicle.tsx
- [ ] 7. Update handleBookNow() logic
- [ ] 8. Test full wallet payment
- [ ] 9. Test partial wallet payment
- [ ] 10. Test race conditions
- [ ] 11. Test on real devices

---

## ✅ **STATUS: 70% COMPLETE**

**Done:**
- ✅ Database functions (100%)
- ✅ TypeScript library (100%)
- ✅ Type definitions (100%)

**Remaining:**
- ⚠️ UI components (select-vehicle.tsx payment selector)
- ⚠️ Payment flow integration (handleBookNow logic)
- ⚠️ Testing & deployment

**Next:** Run the SQL, then I'll complete the UI integration!
