import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-webhook-signature');
    const timestamp = request.headers.get('x-webhook-timestamp');
    
    console.log('Cashfree payout webhook received');

    // Verify webhook signature (recommended for production)
    const secretKey = process.env.CASHFREE_PAYOUT_SECRET_KEY;
    if (secretKey && signature && timestamp) {
      const expectedSignature = crypto
        .createHmac('sha256', secretKey)
        .update(timestamp + body)
        .digest('base64');
      
      if (signature !== expectedSignature) {
        console.error('Invalid webhook signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const webhookData = JSON.parse(body);


    const { event, transfer } = webhookData;
    
    if (!transfer || !transfer.transfer_id) {
      console.error('Invalid webhook payload - missing transfer data');
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const transferId = transfer.transfer_id;
    const cfTransferId = transfer.cf_transfer_id;
    const status = transfer.status;
    const statusDescription = transfer.status_description;


    
    // Find withdrawal by payout_reference (could be transfer_id or cf_transfer_id)
    const { data: withdrawal, error: findError } = await supabaseAdmin
      .from('withdrawals')
      .select('id, driver_id, amount, status')
      .or(`payout_reference.eq.${transferId},payout_reference.eq.${cfTransferId}`)
      .single();
    
    if (findError || !withdrawal) {
      console.log('Withdrawal not found for transfer:', transferId, cfTransferId);
      // Still return 200 to acknowledge receipt
      return NextResponse.json({ received: true, message: 'Withdrawal not found' });
    }



    // Update based on event type
    let updateData: any = {
      payout_status: status,
      updated_at: new Date().toISOString(),
    };

    if (event === 'TRANSFER_SUCCESS' || status === 'SUCCESS') {
      // Transfer completed successfully
      updateData.status = 'paid';
      updateData.processed_at = new Date().toISOString();
      

      
      await supabaseAdmin
        .from('withdrawals')
        .update(updateData)
        .eq('id', withdrawal.id);
      
      // Update transaction status
      await supabaseAdmin
        .from('driver_wallet_transactions')
        .update({ status: 'completed' })
        .eq('withdrawal_id', withdrawal.id)
        .eq('type', 'withdrawal');

      // Send notification to driver about successful payout
      const { data: driverUser } = await supabaseAdmin
        .from('drivers')
        .select('user_id')
        .eq('id', withdrawal.driver_id)
        .single();
      
      if (driverUser) {
        await supabaseAdmin.from('notifications').insert({
          user_id: driverUser.user_id,
          title: '💰 Payout Successful',
          body: `₹${withdrawal.amount} has been transferred to your bank account.`,
          data: { type: 'payout_success', withdrawal_id: withdrawal.id, target_app: 'driver' },
        });
      }
      
    } else if (event === 'TRANSFER_FAILED' || event === 'TRANSFER_REJECTED' || status === 'FAILED' || status === 'ERROR') {
      // Transfer failed - refund to driver's wallet
      updateData.status = 'failed';
      updateData.payout_error = statusDescription || transfer.reason || 'Transfer failed';
      

      
      await supabaseAdmin
        .from('withdrawals')
        .update(updateData)
        .eq('id', withdrawal.id);
      
      // Refund the amount to driver's available balance
      const { data: driver } = await supabaseAdmin
        .from('drivers')
        .select('available_balance')
        .eq('id', withdrawal.driver_id)
        .single();
      
      if (driver) {
        const newBalance = Number(driver.available_balance || 0) + Number(withdrawal.amount);
        
        await supabaseAdmin
          .from('drivers')
          .update({ available_balance: newBalance })
          .eq('id', withdrawal.driver_id);
        
        // Create refund transaction
        await supabaseAdmin
          .from('driver_wallet_transactions')
          .insert({
            driver_id: withdrawal.driver_id,
            type: 'refund',
            amount: withdrawal.amount,
            description: `Withdrawal refund - ${statusDescription || transfer.reason || 'Transfer failed'}`,
            status: 'completed',
            withdrawal_id: withdrawal.id,
          });
      }
      
      // Notify driver about failed payout
      const { data: failedDriverUser } = await supabaseAdmin
        .from('drivers')
        .select('user_id')
        .eq('id', withdrawal.driver_id)
        .single();
      
      if (failedDriverUser) {
        await supabaseAdmin.from('notifications').insert({
          user_id: failedDriverUser.user_id,
          title: '⚠️ Payout Failed',
          body: `₹${withdrawal.amount} payout failed. Amount refunded to wallet. Reason: ${statusDescription || 'Transfer failed'}`,
          data: { type: 'payout_failed', withdrawal_id: withdrawal.id, target_app: 'driver' },
        });
      }
      
    } else if (event === 'TRANSFER_REVERSED' || status === 'REVERSED') {
      // Transfer reversed - refund to driver's wallet
      updateData.status = 'reversed';
      updateData.payout_error = statusDescription || 'Transfer reversed by bank';
      

      
      await supabaseAdmin
        .from('withdrawals')
        .update(updateData)
        .eq('id', withdrawal.id);
      
      // Refund logic (same as failed)
      const { data: driver } = await supabaseAdmin
        .from('drivers')
        .select('available_balance')
        .eq('id', withdrawal.driver_id)
        .single();
      
      if (driver) {
        const newBalance = Number(driver.available_balance || 0) + Number(withdrawal.amount);
        
        await supabaseAdmin
          .from('drivers')
          .update({ available_balance: newBalance })
          .eq('id', withdrawal.driver_id);
        
        await supabaseAdmin
          .from('driver_wallet_transactions')
          .insert({
            driver_id: withdrawal.driver_id,
            type: 'refund',
            amount: withdrawal.amount,
            description: `Withdrawal refund - ${statusDescription || 'Transfer reversed'}`,
            status: 'completed',
            withdrawal_id: withdrawal.id,
          });
      }
      
      // Notify driver about reversal
      const { data: reversedDriverUser } = await supabaseAdmin
        .from('drivers')
        .select('user_id')
        .eq('id', withdrawal.driver_id)
        .single();
      
      if (reversedDriverUser) {
        await supabaseAdmin.from('notifications').insert({
          user_id: reversedDriverUser.user_id,
          title: '🔄 Payout Reversed',
          body: `₹${withdrawal.amount} payout was reversed by your bank. Amount refunded to wallet.`,
          data: { type: 'payout_reversed', withdrawal_id: withdrawal.id, target_app: 'driver' },
        });
      }
      
    } else {
      // Other status updates (PENDING, etc.)

      
      await supabaseAdmin
        .from('withdrawals')
        .update(updateData)
        .eq('id', withdrawal.id);
    }


    return NextResponse.json({ received: true, event, status });
    
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    // Return 200 even on error to prevent Cashfree from retrying
    return NextResponse.json({ 
      received: true, 
      error: 'Processing error',
      message: error.message 
    }, { status: 200 });
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-webhook-signature, x-webhook-timestamp',
    },
  });
}
