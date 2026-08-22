import { Request, Response } from 'express';
import { supabase } from '../utils/supabase';
import crypto from 'crypto';

export const createBeneficiary = async (req: Request, res: Response): Promise<void> => {
  try {
    const payoutsAppId = process.env.CASHFREE_PAYOUT_APP_ID || process.env.CASHFREE_PG_APP_ID;
    const payoutsSecretKey = process.env.CASHFREE_PAYOUT_SECRET_KEY || process.env.CASHFREE_PG_SECRET_KEY;
    const payoutsEnv = process.env.CASHFREE_ENV || process.env.CASHFREE_PG_ENV || process.env.CASHFREE_ENVIRONMENT || 'sandbox';

    if (!payoutsAppId || !payoutsSecretKey) {
      res.status(503).json({ error: 'Cashfree Payouts credentials not configured' });
      return;
    }

    const { driver_id } = req.body;

    if (!driver_id) {
      res.status(400).json({ error: 'driver_id required' });
      return;
    }

    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('id, user_id, bank_details, beneficiary_id, beneficiary_status')
      .eq('id', driver_id)
      .single();

    if (driverError || !driver) {
      res.status(404).json({ error: 'Driver not found' });
      return;
    }

    const bankDetails = driver.bank_details;
    if (!bankDetails || !bankDetails.account_number || !bankDetails.ifsc_code) {
      res.status(400).json({ error: 'Driver bank details incomplete' });
      return;
    }

    const { data: user } = await supabase
      .from('users')
      .select('name, email, phone')
      .eq('id', driver.user_id)
      .single();

    const beneficiaryId = `CARTR_DRV_${driver_id.substring(0, 8)}`;

    const baseUrl = payoutsEnv === 'production'
      ? 'https://api.cashfree.com'
      : 'https://sandbox.cashfree.com';

    const beneficiaryPayload = {
      beneficiary_id: beneficiaryId,
      beneficiary_name: bankDetails.account_holder_name || user?.name || 'Driver',
      beneficiary_instrument_details: {
        bank_account_number: bankDetails.account_number,
        bank_ifsc: bankDetails.ifsc_code
      },
      beneficiary_contact_details: {
        beneficiary_email: user?.email || `driver_${driver_id.substring(0, 8)}@cartr.app`,
        beneficiary_phone: user?.phone || '9999999999'
      }
    };

    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    const publicKeyPem = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzMg9C1Kcf1/RjfKq2O7S
fgaVvwxE76wq9mlYku7Gp4Z4iyrFRmnaEPqPW/+6MfPJn6Yj8GkTNsnrg1gK1C79
sOCb4wc3kAcHlTT5QIdgxQ04tCAYPPMBJ242dpBWlFxe/dVY700bZRTmtf1vwTLo
q8zOuE819Ei0DFdxao92GeaKznWQR8wRDk+LswKIjYKY3mXrJfh1jVZB0uFbed8p
Avbgiq+5HX5tihKUeD90j1t8dMHVq/oZtHL4Xcc1dNstFK1UWwFpef8taWlfIz8o
rz38ws0JnIHlljJYf5H5bwT1yhiMKiHfdFbnoZ+wv9oXRuvhi/FuBq3YXUDm8MLX
AQIDAQAB
-----END PUBLIC KEY-----`;

    const signatureString = `${payoutsAppId}.${timestamp}`;
    const encryptedBuffer = crypto.publicEncrypt(
      {
        key: publicKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha1'
      },
      Buffer.from(signatureString)
    );
    const signature = encryptedBuffer.toString('base64');

    const cfResponse = await fetch(`${baseUrl}/payout/beneficiary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': payoutsAppId,
        'x-client-secret': payoutsSecretKey,
        'x-cf-signature': signature,
        'x-cf-timestamp': timestamp,
        'x-api-version': '2024-01-01',
      },
      body: JSON.stringify(beneficiaryPayload),
    });

    const cfResult = await cfResponse.json();

    if (cfResponse.ok) {
      await supabase
        .from('drivers')
        .update({
          beneficiary_id: beneficiaryId,
          beneficiary_status: 'active',
        })
        .eq('id', driver_id);

      res.status(200).json({ 
        success: true, 
        beneficiary_id: beneficiaryId,
        message: 'Beneficiary created successfully',
        cashfree_response: cfResult
      });
      return;
    } else if (cfResponse.status === 409) {
      const conflictMessage = cfResult?.message || '';
      const conflictCode = cfResult?.code || '';
      
      const isBeneficiaryExists = conflictCode === 'conflict_with_existing_beneficiary' || 
                                  conflictMessage?.includes('beneficiary_id already exists');
      
      if (isBeneficiaryExists) {
        const getBeneficiaryResponse = await fetch(`${baseUrl}/payout/beneficiary/${beneficiaryId}`, {
          method: 'GET',
          headers: {
             'Content-Type': 'application/json',
             'x-client-id': payoutsAppId,
             'x-client-secret': payoutsSecretKey,
             'x-cf-signature': signature,
             'x-cf-timestamp': timestamp,
             'x-api-version': '2024-01-01',
           },
        });
        
        const existingBeneficiary = await getBeneficiaryResponse.json();
        
        const isSameDriver = existingBeneficiary?.beneficiary_instrument_details && 
                              existingBeneficiary.beneficiary_instrument_details.bank_account_number === bankDetails.account_number &&
                              existingBeneficiary.beneficiary_instrument_details.bank_ifsc === bankDetails.ifsc_code;
        
        if (getBeneficiaryResponse.ok && isSameDriver) {
          await supabase
            .from('drivers')
            .update({
              beneficiary_id: beneficiaryId,
              beneficiary_status: 'active',
            })
            .eq('id', driver_id);
          
          res.status(200).json({ 
            success: true, 
            beneficiary_id: beneficiaryId,
            message: 'Bank account already registered',
            cashfree_response: existingBeneficiary
          });
          return;
        } else {
          await supabase
            .from('drivers')
            .update({ beneficiary_status: 'failed' })
            .eq('id', driver_id);
          
          res.status(409).json({
            error: 'bank_account_already_registered',
            message: 'This bank account is already registered. Please use a different account or contact support.',
            cashfree_response: cfResult
          });
          return;
        }
      } else {
        await supabase
          .from('drivers')
          .update({ beneficiary_status: 'failed' })
          .eq('id', driver_id);
        
        res.status(409).json({
          error: 'conflict_error',
          message: conflictMessage || 'Bank account registration conflict',
          cashfree_response: cfResult
        });
        return;
      }
    } else {
      await supabase
        .from('drivers')
        .update({ beneficiary_status: 'failed' })
        .eq('id', driver_id);

      const cfErrorMessage =
        cfResult?.message ||
        cfResult?.reason ||
        cfResult?.subMessage ||
        'Cashfree beneficiary creation failed';

      res.status(422).json({
        error: 'beneficiary_creation_failed',
        message: cfErrorMessage,
        cashfree_status: cfResponse.status,
        cashfree_response: cfResult,
      });
      return;
    }

  } catch (error) {
    console.error('Exception in edge function:', error);
    res.status(500).json({ error: 'Internal error', message: String(error) });
  }
};

export const processWithdrawal = async (req: Request, res: Response): Promise<void> => {
  try {
    const payoutsAppId = process.env.CASHFREE_PAYOUT_APP_ID || process.env.CASHFREE_PG_APP_ID;
    const payoutsSecretKey = process.env.CASHFREE_PAYOUT_SECRET_KEY || process.env.CASHFREE_PG_SECRET_KEY;
    const payoutsEnv = process.env.CASHFREE_ENV || process.env.CASHFREE_PG_ENV || process.env.CASHFREE_ENVIRONMENT || 'sandbox';

    const { withdrawal_id } = req.body;

    if (!withdrawal_id) {
      res.status(400).json({ error: 'withdrawal_id required' });
      return;
    }

    const { data: withdrawal, error: wError } = await supabase
      .from('withdrawals')
      .select('*, driver:drivers(id, beneficiary_id, beneficiary_status, bank_details)')
      .eq('id', withdrawal_id)
      .single();

    if (wError || !withdrawal) {
      res.status(404).json({ error: 'Withdrawal not found' });
      return;
    }

    if (withdrawal.status !== 'approved') {
      res.status(400).json({ error: `Withdrawal must be approved first (current: ${withdrawal.status})` });
      return;
    }

    if (!payoutsAppId || !payoutsSecretKey) {
      console.log('Cashfree Payouts not configured — marking for manual processing');
      await supabase
        .from('withdrawals')
        .update({
          payout_status: 'MANUAL',
          admin_notes: (withdrawal.admin_notes || '') + ' | Auto-payout not available. Process manually.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', withdrawal_id);

      res.status(200).json({
        success: true,
        mode: 'manual',
        message: 'Cashfree Payouts not configured. Marked for manual bank transfer.',
      });
      return;
    }

    const driver = withdrawal.driver;
    if (!driver?.beneficiary_id || driver.beneficiary_status !== 'active') {
      res.status(400).json({ error: 'Driver is not registered as Cashfree beneficiary. Register first.' });
      return;
    }

    const baseUrl = payoutsEnv === 'production'
      ? 'https://api.cashfree.com'
      : 'https://sandbox.cashfree.com';

    const transferId = `CARTR_WD_${withdrawal_id.substring(0, 8)}_${Date.now()}`;

    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    const publicKeyPem = process.env.CASHFREE_PUBLIC_KEY || `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzMg9C1Kcf1/RjfKq2O7S
fgaVvwxE76wq9mlYku7Gp4Z4iyrFRmnaEPqPW/+6MfPJn6Yj8GkTNsnrg1gK1C79
sOCb4wc3kAcHlTT5QIdgxQ04tCAYPPMBJ242dpBWlFxe/dVY700bZRTmtf1vwTLo
q8zOuE819Ei0DFdxao92GeaKznWQR8wRDk+LswKIjYKY3mXrJfh1jVZB0uFbed8p
Avbgiq+5HX5tihKUeD90j1t8dMHVq/oZtHL4Xcc1dNstFK1UWwFpef8taWlfIz8o
rz38ws0JnIHlljJYf5H5bwT1yhiMKiHfdFbnoZ+wv9oXRuvhi/FuBq3YXUDm8MLX
AQIDAQAB
-----END PUBLIC KEY-----`;
    
    const signatureString = `${payoutsAppId}.${timestamp}`;
    const encryptedBuffer = crypto.publicEncrypt(
      {
        key: publicKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha1'
      },
      Buffer.from(signatureString)
    );
    const signature = encryptedBuffer.toString('base64');

    const payoutPayload = {
      transfer_id: transferId,
      transfer_amount: withdrawal.amount,
      transfer_mode: 'banktransfer',
      beneficiary_details: {
        beneficiary_id: driver.beneficiary_id
      },
      transfer_remarks: 'CartR driver payout'
    };

    const cfResponse = await fetch(`${baseUrl}/payout/transfers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': payoutsAppId,
        'x-client-secret': payoutsSecretKey,
        'x-cf-signature': signature,
        'x-api-version': '2024-01-01',
      },
      body: JSON.stringify(payoutPayload),
    });

    const cfResult = await cfResponse.json();

    const validStatuses = ['RECEIVED', 'SUCCESS', 'PENDING'];
    const transferStatus = cfResult.status || cfResult.status_code;
    
    if (cfResponse.ok && validStatuses.includes(transferStatus)) {
      const referenceId = cfResult.cf_transfer_id || cfResult.transfer_id || transferId;
      
      await supabase
        .from('withdrawals')
        .update({
          payout_reference: referenceId,
          payout_status: transferStatus,
          status: 'paid',
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', withdrawal_id);
        
      await supabase
        .from('driver_wallet_transactions')
        .update({ status: 'completed' })
        .eq('withdrawal_id', withdrawal_id)
        .eq('type', 'withdrawal');

      res.status(200).json({
        success: true,
        mode: 'automatic',
        transfer_id: referenceId,
        transfer_status: transferStatus,
        message: cfResult.status_description || 'Bank transfer initiated via Cashfree V2',
      });
      return;
    } else {
      const errorMessage = cfResult.status_description || cfResult.message || cfResult.error?.message || 'Transfer failed';
      
      await supabase
        .from('withdrawals')
        .update({
          payout_reference: cfResult.cf_transfer_id || transferId,
          payout_status: transferStatus || 'FAILED',
          payout_error: JSON.stringify(cfResult),
          updated_at: new Date().toISOString(),
        })
        .eq('id', withdrawal_id);

      res.status(500).json({
        error: 'Cashfree payout failed',
        message: errorMessage,
        details: cfResult,
        transfer_id: cfResult.cf_transfer_id || transferId,
      });
      return;
    }

  } catch (error) {
    console.error('Process withdrawal error:', error);
    res.status(500).json({ error: 'Internal error', message: String(error) });
  }
};
