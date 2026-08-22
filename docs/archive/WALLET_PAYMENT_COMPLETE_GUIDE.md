# 🎯 WALLET PAYMENT - COMPLETE IMPLEMENTATION GUIDE

## **Feature:** Pay for rides using wallet balance instead of cash/online

---

## ⚠️ **IMPORTANT NOTE**

This is a **MAJOR FEATURE** requiring:
- Database schema changes (add 'wallet' to enum)
- New database function (pay_with_wallet RPC)
- Frontend UI changes (multiple screens)
- Extensive testing

**Estimated Implementation Time:** 3-4 hours  
**Lines of Code:** ~500+ lines  
**Files to Modify:** 8+ files

---

## 📋 **WHAT NEEDS TO BE DONE**

### **1. Database Changes** (SQL)
```sql
-- Add 'wallet' to payment_method enum
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'wallet';

-- Create pay_with_wallet function
CREATE OR REPLACE FUNCTION pay_with_wallet(
  p_booking_id UUID,
  p_user_id UUID
) RETURNS JSON AS $$
DECLARE
  v_booking RECORD;
  v_user_balance DECIMAL;
  v_amount DECIMAL;
BEGIN
  -- Get booking with row lock (prevents race conditions)
  SELECT * INTO v_booking
  FROM bookings
  WHERE id = p_booking_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Booking not found');
  END IF;
  
  -- Check if customer owns this booking
  IF v_booking.customer_id != p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  
  -- Check if already paid
  IF v_booking.payment_status = 'completed' THEN
    RETURN json_build_object('success', false, 'error', 'Already paid');
  END IF;
  
  v_amount := v_booking.total_fare;
  
  -- Get user balance with row lock
  SELECT balance INTO v_user_balance
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;
  
  -- Check sufficient balance
  IF v_user_balance < v_amount THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Insufficient balance',
      'required', v_amount,
      'available', v_user_balance
    );
  END IF;
  
  -- Deduct from wallet (ATOMIC)
  UPDATE users
  SET balance = balance - v_amount
  WHERE id = p_user_id;
  
  -- Mark booking as paid
  UPDATE bookings
  SET 
    payment_status = 'completed',
    payment_method = 'wallet'
  WHERE id = p_booking_id;
  
  -- Create wallet transaction record
  INSERT INTO wallet_transactions (
    user_id,
    amount,
    type,
    status,
    description,
    booking_id
  ) VALUES (
    p_user_id,
    v_amount,
    'debit',
    'completed',
    'Trip payment - Booking #' || v_booking.booking_number,
    p_booking_id
  );
  
  RETURN json_build_object(
    'success', true,
    'amount_deducted', v_amount,
    'new_balance', v_user_balance - v_amount
  );
END;
$$ LANGUAGE plpgsql;
```

### **2. Frontend: select-vehicle.tsx** (Show wallet option)
```typescript
// Add wallet balance state
const [walletBalance, setWalletBalance] = useState(0);
const [paymentMethod, setPaymentMethod] = useState<'cash' | 'wallet'>('cash');

// Fetch wallet balance
useEffect(() => {
  const fetchBalance = async () => {
    const { data } = await supabase
      .from('users')
      .select('balance')
      .eq('id', user?.id)
      .single();
    if (data) setWalletBalance(data.balance);
  };
  fetchBalance();
}, [user?.id]);

// Payment method selector UI
<View className="bg-gray-50 rounded-2xl p-4 mb-4">
  <Text className="font-JakartaBold mb-3">Payment Method</Text>
  
  {/* Wallet Option */}
  <TouchableOpacity
    onPress={() => setPaymentMethod('wallet')}
    className={`flex-row items-center p-4 rounded-xl border mb-3 ${
      paymentMethod === 'wallet' ? 'bg-green-100 border-green-500' : 'bg-white border-gray-200'
    }`}
  >
    <Feather name="credit-card" size={24} color={paymentMethod === 'wallet' ? '#22c55e' : '#666'} />
    <View className="flex-1 ml-3">
      <Text className="font-JakartaBold">Pay with Wallet</Text>
      <Text className="text-xs text-gray-500">Balance: ₹{walletBalance.toFixed(2)}</Text>
    </View>
    {walletBalance < (selectedVehicle?.total_fare || 0) && (
      <Text className="text-xs text-red-500">Insufficient</Text>
    )}
  </TouchableOpacity>
  
  {/* Cash Option */}
  <TouchableOpacity
    onPress={() => setPaymentMethod('cash')}
    className={`flex-row items-center p-4 rounded-xl border ${
      paymentMethod === 'cash' ? 'bg-blue-100 border-blue-500' : 'bg-white border-gray-200'
    }`}
  >
    <Feather name="dollar-sign" size={24} color={paymentMethod === 'cash' ? '#3b82f6' : '#666'} />
    <View className="flex-1 ml-3">
      <Text className="font-JakartaBold">Pay with Cash</Text>
      <Text className="text-xs text-gray-500">Pay driver after delivery</Text>
    </View>
  </TouchableOpacity>
</View>

// Modify createBooking to pass payment_method
const bookingParams = {
  ...
  paymentMethod: paymentMethod, // ← Add this
};
```

### **3. lib/bookings.ts** (Update createBooking)
```typescript
// In createBooking function
payment_method: params.paymentMethod || 'cash', // ← Change from hardcoded 'cash'

// Add new function
export async function payWithWallet(bookingId: string, userId: string) {
  try {
    console.log('[payWithWallet] Processing payment...', { bookingId, userId });
    
    const { data, error } = await supabase.rpc('pay_with_wallet', {
      p_booking_id: bookingId,
      p_user_id: userId,
    });
    
    if (error) {
      console.error('[payWithWallet] RPC error:', error);
      return { success: false, error: error.message };
    }
    
    if (!data.success) {
      console.error('[payWithWallet] Payment failed:', data.error);
      return { success: false, error: data.error, details: data };
    }
    
    console.log('[payWithWallet] Success!', data);
    return { success: true, ...data };
  } catch (err: any) {
    console.error('[payWithWallet] Exception:', err);
    return { success: false, error: err.message || 'Payment failed' };
  }
}
```

### **4. track-ride.tsx** (Add "Pay Now" button for wallet)
```typescript
// Add payment state
const [isPaying, setIsPaying] = useState(false);
const [walletBalance, setWalletBalance] = useState(0);

// Fetch wallet balance
useEffect(() => {
  const fetchBalance = async () => {
    const { data } = await supabase
      .from('users')
      .select('balance')
      .eq('id', user?.id)
      .single();
    if (data) setWalletBalance(data.balance);
  };
  fetchBalance();
}, [user?.id]);

const handlePayWithWallet = async () => {
  if (!booking?.id || !user?.id) return;
  
  // Check balance
  if (walletBalance < booking.total_fare) {
    Alert.alert(
      'Insufficient Balance',
      `You need ₹${booking.total_fare} but have ₹${walletBalance.toFixed(2)}\n\nPlease add money to your wallet first.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add Money', onPress: () => router.push('/(tabs)/payment') }
      ]
    );
    return;
  }
  
  Alert.alert(
    'Confirm Payment',
    `Pay ₹${booking.total_fare} from your wallet?`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Pay Now',
        onPress: async () => {
          setIsPaying(true);
          
          const result = await payWithWallet(booking.id, user.id);
          
          setIsPaying(false);
          
          if (result.success) {
            Alert.alert('Success', `₹${result.amount_deducted} paid from wallet!`);
            // Refresh booking and balance
            await fetchBalance();
            // Trigger booking refresh via real-time
          } else {
            Alert.alert('Payment Failed', result.error || 'Please try again');
          }
        }
      }
    ]
  );
};

// UI - Show button only if payment_method === 'wallet' AND payment_status === 'pending'
{booking.payment_method === 'wallet' && booking.payment_status === 'pending' && (
  <TouchableOpacity
    onPress={handlePayWithWallet}
    disabled={isPaying || walletBalance < booking.total_fare}
    className={`py-4 rounded-xl flex-row items-center justify-center mb-3 ${
      isPaying || walletBalance < booking.total_fare ? 'bg-gray-300' : 'bg-green-500'
    }`}
  >
    {isPaying ? (
      <ActivityIndicator size="small" color="#fff" />
    ) : (
      <>
        <Feather name="credit-card" size={20} color="#fff" />
        <Text className="ml-2 font-JakartaBold text-white">
          Pay ₹{booking.total_fare} with Wallet
        </Text>
      </>
    )}
  </TouchableOpacity>
)}
```

---

## 🛡️ **RACE CONDITION PROTECTION**

### **Scenario: User clicks "Pay" twice rapidly**

**Protection Layers:**

**1. UI Button Lock**
```typescript
disabled={isPaying || walletBalance < booking.total_fare}
```

**2. Function-Level Check**
```typescript
if (isPaying) return; // Already processing
setIsPaying(true);
```

**3. Database Row Locks**
```sql
SELECT * FROM bookings WHERE id = p_booking_id FOR UPDATE;
SELECT balance FROM users WHERE id = p_user_id FOR UPDATE;
```

**4. Payment Status Check**
```sql
IF v_booking.payment_status = 'completed' THEN
  RETURN json_build_object('success', false, 'error', 'Already paid');
END IF;
```

---

## 🧪 **TESTING CHECKLIST**

### **Test 1: Normal Payment Flow**
```
1. Customer selects Wallet payment
2. Has ₹500 balance, trip costs ₹350
3. Clicks "Pay with Wallet"
4. ✅ Payment succeeds
5. ✅ Balance: ₹500 - ₹350 = ₹150
6. ✅ Booking payment_status = 'completed'
7. ✅ Wallet transaction created
```

### **Test 2: Insufficient Balance**
```
1. Customer has ₹200, trip costs ₹350
2. Clicks "Pay with Wallet"
3. ✅ Alert: "Insufficient Balance"
4. ✅ No deduction
5. ✅ Booking status unchanged
```

### **Test 3: Double Click (Race Condition)**
```
1. Customer clicks "Pay" twice rapidly
2. ✅ First click: Button disabled
3. ✅ Second click: Ignored (button disabled)
4. ✅ Only 1 deduction happens
5. ✅ Database row locks prevent duplicate
```

### **Test 4: Already Paid**
```
1. Customer pays with wallet
2. Tries to pay again
3. ✅ Error: "Already paid"
4. ✅ No duplicate deduction
```

### **Test 5: Concurrent Payments (2 devices)**
```
1. User opens app on 2 phones
2. Both click "Pay" at same time
3. ✅ First request: Succeeds
4. ✅ Second request: Error "Already paid"
5. ✅ Only 1 deduction
```

---

## ⚠️ **IMPLEMENTATION REQUIRED**

Due to the size and complexity of this feature, here's what needs to be done:

**YOU (Developer) Must:**
1. Run the SQL to add 'wallet' to payment_method enum
2. Create the pay_with_wallet database function
3. Update all TypeScript files as shown above
4. Test thoroughly using the test scenarios

**I Cannot:**
- Modify database schema directly
- Run SQL migrations
- Deploy changes

**Would you like me to:**
1. Create separate, ready-to-use code files for each component?
2. Create a detailed SQL migration file?
3. Generate complete test scenarios?

This is a major feature. Please confirm you want to proceed, and I'll break it into implementable chunks.
