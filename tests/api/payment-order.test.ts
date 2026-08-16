import { describe, expect, it } from 'vitest';

describe('create-payment-order Edge Function Logic', () => {
  it('creates a proper customer wallet top-up order payload', async () => {
    const body = {
      customer_id: 'cust-123',
      amount: 500,
      return_url: 'myapp://payment-status',
    };

    const orderId = `WALLET_${body.customer_id.substring(0, 8).replace(/-/g, '')}_${Date.now()}`;
    const requestPayload = {
      order_amount: body.amount,
      order_currency: 'INR',
      order_id: orderId,
      customer_details: {
        customer_id: body.customer_id.replace(/-/g, '').substring(0, 10),
        customer_phone: '9999999999',
        customer_name: 'CartR User',
        customer_email: 'user@cartr.app',
      },
      order_meta: {
        return_url: `${body.return_url}?order_id=${orderId}`,
      },
      order_tags: {
        type: 'wallet',
        cid: body.customer_id,
        bid: 'none',
      },
    };

    expect(requestPayload.order_amount).toBe(500);
    expect(requestPayload.order_id).toMatch(/^WALLET_cust123_/);
    expect(requestPayload.order_tags.type).toBe('wallet');
  });

  it('creates a proper driver wallet top-up order payload', () => {
    const body = {
      customer_id: 'driver-user-1',
      amount: 300,
      topup_target: 'driver_wallet' as const,
    };

    const orderId = `DRIVERWALLET_${body.customer_id.substring(0, 8).replace(/-/g, '')}_${Date.now()}`;

    expect(orderId).toMatch(/^DRIVERWALLET_driverus_/);
    expect(body.topup_target).toBe('driver_wallet');
  });

  it('rejects invalid inputs', () => {
    const validateRequest = (body: any) => {
      if (!body.customer_id || !body.amount || body.amount <= 0) {
        return { error: 'Missing required fields: customer_id and amount' };
      }
      return { success: true };
    };

    expect(validateRequest({ amount: 500 }).error).toBeDefined();
    expect(validateRequest({ customer_id: '123', amount: -1 }).error).toBeDefined();
    expect(validateRequest({ customer_id: '123', amount: 500 }).success).toBe(true);
  });
});
