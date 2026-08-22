# 🎯 Wallet Payment Implementation Plan

## **Objective:** Allow customers to pay for rides using wallet balance

---

## 📋 **COMPLETE IMPLEMENTATION CHECKLIST**

### **Phase 1: Database Schema** ✅ (Already exists)
- [x] `users.balance` column exists
- [x] `wallet_transactions` table exists
- [x] `bookings.payment_method` enum exists ('cash' | 'online')
- [ ] **TODO:** Add 'wallet' to payment_method enum
- [ ] **TODO:** Add wallet payment RPC function

### **Phase 2: Backend Functions**
- [ ] Create `pay_with_wallet` RPC function
  - Validate booking exists
  - Check sufficient balance
  - Atomic deduction from wallet
  - Mark booking payment as completed
  - Create wallet transaction record
  - Race condition protection

### **Phase 3: Frontend - Booking Creation**
- [ ] Add wallet payment option to select-vehicle screen
- [ ] Show wallet balance
- [ ] Allow selection: Cash / Wallet
- [ ] Pass payment_method to createBooking()

### **Phase 4: Frontend - During Ride Payment**
- [ ] Add "Pay with Wallet" button on track-ride screen
- [ ] Show current wallet balance
- [ ] Implement payment flow with loading states
- [ ] Handle insufficient balance error
- [ ] Disable button after payment

### **Phase 5: Button Locking & Race Conditions**
- [ ] Disable "Pay with Wallet" button while processing
- [ ] Prevent double-clicks
- [ ] Add idempotency check
- [ ] Handle concurrent payment attempts

### **Phase 6: Synchronization**
- [ ] Real-time balance updates
- [ ] Payment status sync across

 screens
- [ ] Transaction history refresh

### **Phase 7: Error Handling**
- [ ] Insufficient balance
- [ ] Network errors
- [ ] Race conditions (payment already complete)
- [ ] Booking not found
- [ ] User feedback with alerts

### **Phase 8: Testing**
- [ ] Unit test: pay_with_wallet function
- [ ] Integration test: Full payment flow
- [ ] Race condition test: Simultaneous payments
- [ ] Edge case: Insufficient balance
- [ ] Edge case: Already paid booking

---

## 🏗️ **IMPLEMENTATION STRUCTURE**

This is too large for one response. I'll break it into manageable parts:

**Document 1:** Database function (pay_with_wallet RPC)  
**Document 2:** Frontend UI components  
**Document 3:** Integration & testing  

Due to the complexity, I recommend we implement this step by step. Should I proceed with creating the complete implementation?

**Response Options:**
1. "Yes, create complete wallet payment system" - I'll implement all phases
2. "Start with database function only" - I'll create just the RPC
3. "Show me the plan first" - I'll detail each component

Which would you prefer?
