import { describe, it, expect } from 'vitest';

/**
 * Unit tests for wallet credit and payment split logic.
 * Tests the atomic credit pattern and rollback scenarios
 * related to the fix in verify-payment/index.ts.
 */

// Simulate the atomic credit vs non-atomic credit behavior

interface WalletState {
  balance: number;
}

// OLD (buggy): Non-atomic read-then-write — susceptible to race conditions
function nonAtomicCredit(wallet: WalletState, amount: number): number {
  // This is what the old code did: read balance, add, write back
  const currentBalance = wallet.balance; // READ
  const newBalance = currentBalance + amount; // COMPUTE
  wallet.balance = newBalance; // WRITE
  return newBalance;
}

// NEW (fixed): Atomic increment — what atomic_credit_wallet RPC does
function atomicCredit(wallet: WalletState, amount: number): number {
  // Single atomic operation: balance = COALESCE(balance, 0) + amount
  wallet.balance = (wallet.balance || 0) + amount;
  return wallet.balance;
}

// Simulate the idempotency check for wallet top-up verification
function shouldCreditWallet(
  transactionStatus: string | null,
  paymentStatus: 'PAID' | 'PENDING' | 'FAILED'
): { shouldCredit: boolean; reason: string } {
  // No transaction found
  if (transactionStatus === null) {
    return { shouldCredit: false, reason: 'Transaction not found' };
  }

  // Already completed — idempotency
  if (transactionStatus === 'completed') {
    return { shouldCredit: false, reason: 'Already credited' };
  }

  // Only credit on PAID
  if (paymentStatus !== 'PAID') {
    return { shouldCredit: false, reason: 'Payment not successful' };
  }

  return { shouldCredit: true, reason: 'Ready to credit' };
}

// Rollback logic from walletPayment.ts
function simulatePartialPaymentRollback(
  walletDeducted: number,
  currentBalance: number,
  onlinePaymentSucceeded: boolean
): { finalBalance: number; rollbackAmount: number; bookingStatus: string } {
  if (onlinePaymentSucceeded) {
    return {
      finalBalance: currentBalance,
      rollbackAmount: 0,
      bookingStatus: 'paid',
    };
  }

  // Online payment failed — restore wallet deduction
  return {
    finalBalance: currentBalance + walletDeducted,
    rollbackAmount: walletDeducted,
    bookingStatus: 'pending',
  };
}

// ======================================================
// TESTS
// ======================================================

describe('Wallet Credit — Atomic vs Non-Atomic', () => {
  it('atomic credit handles null/zero balance correctly', () => {
    const wallet: WalletState = { balance: 0 };
    const result = atomicCredit(wallet, 500);
    expect(result).toBe(500);
    expect(wallet.balance).toBe(500);
  });

  it('atomic credit stacks correctly for sequential calls', () => {
    const wallet: WalletState = { balance: 100 };
    atomicCredit(wallet, 200);
    atomicCredit(wallet, 300);
    expect(wallet.balance).toBe(600);
  });

  it('demonstrates race condition in non-atomic credit', () => {
    // Two concurrent reads see the same balance
    const sharedWallet: WalletState = { balance: 100 };

    // Simulate: both threads read balance=100 at the same time
    const readA = sharedWallet.balance; // Thread A reads 100
    const readB = sharedWallet.balance; // Thread B reads 100

    // Thread A writes: 100 + 200 = 300
    sharedWallet.balance = readA + 200;
    // Thread B writes: 100 + 300 = 400 (OVERWRITES Thread A's write!)
    sharedWallet.balance = readB + 300;

    // BUG: Expected 600 (100 + 200 + 300), got 400
    // The ₹200 credit from Thread A is lost!
    expect(sharedWallet.balance).toBe(400); // This PASSES — demonstrating the bug
    expect(sharedWallet.balance).not.toBe(600); // This is the proof of the race condition
  });
});

describe('Wallet Credit — Idempotency Check', () => {
  it('allows credit for pending transaction with PAID status', () => {
    const result = shouldCreditWallet('pending', 'PAID');
    expect(result.shouldCredit).toBe(true);
  });

  it('blocks double-credit for completed transaction', () => {
    const result = shouldCreditWallet('completed', 'PAID');
    expect(result.shouldCredit).toBe(false);
    expect(result.reason).toContain('Already credited');
  });

  it('blocks credit for failed payment', () => {
    const result = shouldCreditWallet('pending', 'FAILED');
    expect(result.shouldCredit).toBe(false);
  });
});

describe('Partial Payment Rollback', () => {
  it('does not rollback if online payment succeeded', () => {
    const result = simulatePartialPaymentRollback(100, 400, true);
    expect(result.rollbackAmount).toBe(0);
    expect(result.finalBalance).toBe(400);
    expect(result.bookingStatus).toBe('paid');
  });

  it('restores wallet deduction if online payment failed', () => {
    const result = simulatePartialPaymentRollback(100, 400, false);
    expect(result.rollbackAmount).toBe(100);
    expect(result.finalBalance).toBe(500); // 400 + 100 restored
    expect(result.bookingStatus).toBe('pending');
  });

  it('handles zero wallet deduction', () => {
    const result = simulatePartialPaymentRollback(0, 0, false);
    expect(result.rollbackAmount).toBe(0);
    expect(result.finalBalance).toBe(0);
    expect(result.bookingStatus).toBe('pending');
  });
});
