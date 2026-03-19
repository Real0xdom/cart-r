import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
// We need a service role key to insert into auth.users, or just create a standard row in `users`. Wait, we can just insert directly into `users` table since RLS might not block us?
// If this script uses ANON_KEY, RLS will block inserts! We need to use service_role!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE URL or KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const testId = Date.now().toString().slice(-8);

async function runTests() {
  console.log("=== Cashfree End-to-End Verification ===");
  try {
    // Check if we can insert users
    console.log("-> 0. Creating Mock Data...");
    
    // We can't insert a user because of RLS most likely. Let's find an existing one and update it if needed.
    const { data: users, error: userError } = await supabase.from('users').select('id').limit(1);
    if (!users || users.length === 0) throw new Error("No users found to test with");
    const customer = users[0];
    console.log("Found Customer:", customer.id);

    const { data: driverUsers } = await supabase.from('drivers').select('id, user_id').limit(1);
    if (!driverUsers || driverUsers.length === 0) throw new Error("No drivers found");
    const driver = driverUsers[0];
    console.log("Found Driver:", driver.id);

    // Update driver's bank details so beneficiary works
    const bankDetails = {
      account_number: `12345678${testId}`,
      ifsc_code: 'TEST0000123',
      account_holder_name: 'Test Driver'
    };
    await supabase.from('drivers').update({ bank_details: bankDetails }).eq('id', driver.id);
    console.log("Updated Driver Bank Details.");

    // Call create-beneficiary
    console.log("-> 1. Registering Driver as Beneficiary...");
    const { data: beneData, error: beneError } = await supabase.functions.invoke('create-beneficiary', {
      body: { driver_id: driver.id }
    });
    console.log("Beneficiary Response:", beneData || beneError);

    // Create a mock booking
    console.log("-> 2. Creating a test booking...");
    const { data: booking, error: bookError } = await supabase.from('bookings').insert({
      customer_id: customer.id,
      driver_id: driver.id,
      pickup_location: { type: 'Point', coordinates: [0,0] },
      dropoff_location: { type: 'Point', coordinates: [1,1] },
      pickup_address: "Test Pickup",
      dropoff_address: "Test Dropoff",
      distance: 5,
      total_fare: 100,
      driver_payout: 80,
      admin_commission: 20,
      status: 'accepted',
      payment_status: 'pending',
      booking_number: `TEST-${testId}`
    }).select().single();
    
    if (bookError || !booking) throw new Error(`Booking failed: ${JSON.stringify(bookError)}`);
    console.log(`Mock Booking Created: ${booking.id}`);

    // Generate UPI QR Order
    console.log("-> 3. Generating UPI QR via Edge Function...");
    const { data: qrData, error: qrError } = await supabase.functions.invoke('create-upi-qr', {
      body: { booking_id: booking.id }
    });
    console.log("QR Order Response:", qrData || qrError);
    if (!qrData?.order_id) throw new Error("Failed to create UPIDR order");
    
    const orderId = qrData.order_id;
    console.log("UPIDR Order ID:", orderId);

    // Simulate Webhook
    console.log("-> 4. Simulating Payment Webhook (SUCCESS)...");
    const webhookPayload = {
      type: "PAYMENT_SUCCESS",
      data: {
        order: { order_id: orderId, order_amount: 100, order_currency: "INR", order_status: "SUCCESS" },
        payment: { payment_amount: 100, payment_status: "SUCCESS", payment_message: "Success" }
      },
      event_time: new Date().toISOString()
    };
    
    const res = await fetch(`${supabaseUrl}/functions/v1/payment-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload)
    });
    const wText = await res.text();
    console.log("Webhook simulated response:", res.status, wText);
    
    // Wait for triggers
    await new Promise(r => setTimeout(r, 2000));
    
    // Check if booking is paid
    const { data: updatedBooking } = await supabase.from('bookings').select('payment_status, payment_method').eq('id', booking.id).single();
    console.log("Updated Booking Payment Status:", updatedBooking?.payment_status, "Method:", updatedBooking?.payment_method);
    
    // Complete booking to release funds
    console.log("-> 5. Completing the ride to release funds...");
    await supabase.from('bookings').update({ status: 'completed' }).eq('id', booking.id);
    
    await new Promise(r => setTimeout(r, 2000));
    
    // Request Withdrawal
    console.log("-> 6. Requesting Withdrawal for ₹80...");
    const { data: wReq, error: wReqErr } = await supabase.rpc('request_withdrawal', {
      p_driver_id: driver.id,
      p_amount: 80,
      p_idempotency_key: `test_wd_${testId}`
    });
    console.log("Withdrawal Request Result:", wReq, wReqErr);
    
    // Find withdrawal id
    const { data: wdList } = await supabase.from('withdrawals').select('*').eq('driver_id', driver.id).order('created_at', { ascending: false }).limit(1);
    const withdrawal = wdList?.[0];
    if (withdrawal) {
      console.log(`Created Withdrawal: ${withdrawal.id}`);
      
      // Admin approves it
      console.log("-> 7. Admin approving withdrawal...");
      await supabase.from('withdrawals').update({ status: 'approved' }).eq('id', withdrawal.id);
      
      // Process Payout
      console.log("-> 8. Processing Payout via Edge Function...");
      const { data: payoutData, error: payoutError } = await supabase.functions.invoke('process-withdrawal', {
        body: { withdrawal_id: withdrawal.id }
      });
      console.log("Payout Response:", payoutData || payoutError);
      
      const { data: finalWd } = await supabase.from('withdrawals').select('payout_status, payout_reference, payout_error').eq('id', withdrawal.id).single();
      console.log("Final Withdrawal Payout Status:", finalWd?.payout_status, "Ref:", finalWd?.payout_reference, "Error:", finalWd?.payout_error);
    } else {
        console.log("Could not find withdrawal record.");
    }
    
    console.log("=== END VERIFICATION ===");
  } catch(e) {
    console.error("Verification script failed:", e);
  }
}

runTests();
