import { describe, it, expect } from 'vitest';

export function calculatePaymentSplit(
  walletBalance: number,
  totalAmount: number
): {
  canPayFull: boolean;
  walletAmount: number;
  onlineAmount: number;
  needsOnlinePayment: boolean;
} {
  const canPayFull = walletBalance >= totalAmount;
  
  if (canPayFull) {
    return {
      canPayFull: true,
      walletAmount: totalAmount,
      onlineAmount: 0,
      needsOnlinePayment: false
    };
  }
  
  return {
    canPayFull: false,
    walletAmount: walletBalance,
    onlineAmount: totalAmount - walletBalance,
    needsOnlinePayment: true
  };
}

describe('Payment Split Calculation', () => {
  it('handles exact balance', () => {
    const result = calculatePaymentSplit(500, 500);
    expect(result).toEqual({
      canPayFull: true,
      walletAmount: 500,
      onlineAmount: 0,
      needsOnlinePayment: false
    });
  });

  it('handles abundant balance', () => {
    const result = calculatePaymentSplit(1000, 300);
    expect(result).toEqual({
      canPayFull: true,
      walletAmount: 300,
      onlineAmount: 0,
      needsOnlinePayment: false
    });
  });

  it('handles partial balance', () => {
    const result = calculatePaymentSplit(150, 400);
    expect(result).toEqual({
      canPayFull: false,
      walletAmount: 150,
      onlineAmount: 250,
      needsOnlinePayment: true
    });
  });

  it('handles zero balance', () => {
    const result = calculatePaymentSplit(0, 300);
    expect(result).toEqual({
      canPayFull: false,
      walletAmount: 0,
      onlineAmount: 300,
      needsOnlinePayment: true
    });
  });
  
  it('handles negative or weird float math cleanly', () => {
    // 0.3 - 0.2 = 0.09999... in JS, testing totalAmount float preservation
    const result = calculatePaymentSplit(0.2, 0.3);
    
    expect(result.canPayFull).toBe(false);
    expect(result.walletAmount).toBe(0.2);
    expect(result.onlineAmount).toBeCloseTo(0.1);
  });
});
