/**
 * API Tests — Process Withdrawal Edge Function
 * Tests: Process approved withdrawal, reject non-approved, beneficiary checks
 * Priority: P1
 */
import { callProcessWithdrawal } from '../../helpers/api-client';
import * as db from '../../helpers/supabase-admin';

const TEST_RUN_ID = `api_withdrawal_${Date.now()}`;

describe('Edge Function: process-withdrawal', () => {
  let driverId: string;

  beforeAll(async () => {
    const driver = await db.createTestDriver({
      phone: '+919800030001',
      name: 'Withdrawal Test Driver',
      vehicleType: 'sedan',
      verificationStatus: 'approved',
      testRunId: TEST_RUN_ID,
    });
    driverId = driver.driverId;

    await db.createDriverWallet(driverId, 2000);
  });

  afterAll(async () => {
    await db.cleanupTestData(TEST_RUN_ID);
  });

  it('should reject processing a pending withdrawal (not approved yet)', async () => {
    const wd = await db.createWithdrawalRequest(driverId, 500);

    const response = await callProcessWithdrawal(wd.withdrawalId);

    // Should fail because status is 'pending', not 'approved'
    expect(response.error).toContain('approved');
  });

  it('should handle approved withdrawal (manual mode if no Cashfree Payouts configured)', async () => {
    // Create and manually approve a withdrawal
    const wd = await db.createWithdrawalRequest(driverId, 300);

    // Manually set status to approved
    const client = db.getSupabaseAdmin();
    await client.from('withdrawals').update({ status: 'approved' }).eq('id', wd.withdrawalId);

    // Mock beneficiary to bypass validation
    await client.from('drivers').update({
      beneficiary_id: 'mock_bene_id',
      beneficiary_status: 'active',
    }).eq('id', driverId);

    const response = await callProcessWithdrawal(wd.withdrawalId);
    
    // In sandbox, it might go to manual mode (if no keys) OR fail with 500 (if keys are set but IP is not whitelisted by Cashfree)
    if (response.ok) {
      if (response.data.success) {
        expect(['automatic', 'manual']).toContain(response.data.mode);
      }
    } else {
      expect(response.status).toBe(500);
      expect(response.error).toContain('Cashfree authentication failed');
    }
  });

  it('should return error for non-existent withdrawal', async () => {
    const response = await callProcessWithdrawal('00000000-0000-0000-0000-000000000000');
    expect(response.error).toContain('not found');
  });

  it('should handle missing withdrawal_id', async () => {
    const response = await callProcessWithdrawal('');
    expect(response.ok).toBe(false);
  });
});
