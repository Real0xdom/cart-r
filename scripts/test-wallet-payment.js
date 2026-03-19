/**
 * Wallet Payment System - Deployment & Testing Script
 * 
 * This script:
 * 1. Deploys SQL migration to Supabase
 * 2. Tests wallet payment functions
 * 3. Verifies race conditions
 * 4. Checks idempotency
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase Configuration
// IMPORTANT: Replace these with your actual values from .env or dashboard
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_ROLE_KEY';

// Create Supabase client with service role (has admin privileges)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function error(message) {
  log(`❌ ${message}`, 'red');
}

function info(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function warning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// =====================================================
// STEP 1: Deploy SQL Migration
// =====================================================
async function deploySQLMigration() {
  log('\n========================================', 'cyan');
  log('STEP 1: Deploying SQL Migration', 'cyan');
  log('========================================\n', 'cyan');

  try {
    const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', 'wallet_payment_system.sql');
    
    if (!fs.existsSync(sqlPath)) {
      error(`SQL file not found at: ${sqlPath}`);
      return false;
    }

    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    info('Executing SQL migration...');
    
    // Execute SQL using Supabase's RPC or raw SQL execution
    // Note: This requires service role key with appropriate permissions
    const { data, error: sqlError } = await supabase.rpc('exec_sql', {
      sql: sqlContent
    });

    if (sqlError) {
      // If exec_sql doesn't exist, we need to run it differently
      warning('Direct SQL execution not available. Migration needs manual deployment.');
      warning('Please run the SQL file in Supabase Dashboard → SQL Editor');
      return false;
    }

    success('SQL migration deployed successfully!');
    return true;

  } catch (err) {
    error(`Failed to deploy SQL: ${err.message}`);
    return false;
  }
}

// =====================================================
// STEP 2: Create Test User & Booking
// =====================================================
async function setupTestData() {
  log('\n========================================', 'cyan');
  log('STEP 2: Setting Up Test Data', 'cyan');
  log('========================================\n', 'cyan');

  try {
    // Get or create test user
    const testPhone = '+919999999999';
    
    info('Checking for test user...');
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('phone', testPhone)
      .limit(1);

    let testUserId;
    
    if (users && users.length > 0) {
      testUserId = users[0].id;
      info(`Found existing test user: ${testUserId}`);
      
      // Set wallet balance to ₹1000 for testing
      const { error: updateError } = await supabase
        .from('users')
        .update({ balance: 1000 })
        .eq('id', testUserId);
      
      if (updateError) {
        error(`Failed to update balance: ${updateError.message}`);
      } else {
        success('Updated test user balance to ₹1000');
      }
    } else {
      warning('No test user found. Please create a user in the app first.');
      return null;
    }

    // Create test booking
    info('Creating test booking...');
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        customer_id: testUserId,
        origin_address: 'Test Pickup Location',
        origin_latitude: 19.0760,
        origin_longitude: 72.8777,
        destination_address: 'Test Drop Location',
        destination_latitude: 19.0896,
        destination_longitude: 72.8656,
        vehicle_type: 'tempo',
        total_fare: 350,
        tip_amount: 0,
        driver_payout: 350,
        status: 'pending',
        payment_status: 'pending',
        payment_method: 'cash',
        pickup_otp: '1234',
        receiver_name: 'Test Receiver',
        receiver_phone: '+919999999998'
      })
      .select()
      .single();

    if (bookingError) {
      error(`Failed to create booking: ${bookingError.message}`);
      return null;
    }

    success(`Test booking created: ${booking.id}`);
    
    return {
      userId: testUserId,
      bookingId: booking.id,
      totalFare: 350
    };

  } catch (err) {
    error(`Setup failed: ${err.message}`);
    return null;
  }
}

// =====================================================
// STEP 3: Test Full Wallet Payment
// =====================================================
async function testFullWalletPayment(testData) {
  log('\n========================================', 'cyan');
  log('TEST 1: Full Wallet Payment', 'cyan');
  log('========================================\n', 'cyan');

  try {
    const { userId, bookingId, totalFare } = testData;

    info(`Testing payment of ₹${totalFare} from wallet...`);

    // Get balance before payment
    const { data: userBefore } = await supabase
      .from('users')
      .select('balance')
      .eq('id', userId)
      .single();

    const balanceBefore = userBefore.balance;
    info(`Balance before: ₹${balanceBefore}`);

    // Execute wallet payment
    const { data: paymentResult, error: paymentError } = await supabase
      .rpc('pay_with_wallet', {
        p_booking_id: bookingId,
        p_user_id: userId,
        p_use_full_wallet: true,
        p_payment_session_id: null
      });

    if (paymentError) {
      error(`Payment failed: ${paymentError.message}`);
      return false;
    }

    log('\nPayment Result:', 'yellow');
    console.log(JSON.stringify(paymentResult, null, 2));

    if (!paymentResult.success) {
      error(`Payment not successful: ${paymentResult.error}`);
      return false;
    }

    // Verify balance deducted
    const { data: userAfter } = await supabase
      .from('users')
      .select('balance')
      .eq('id', userId)
      .single();

    const balanceAfter = userAfter.balance;
    const deducted = balanceBefore - balanceAfter;

    info(`Balance after: ₹${balanceAfter}`);
    info(`Amount deducted: ₹${deducted}`);

    if (deducted === totalFare) {
      success('✓ Correct amount deducted!');
    } else {
      error(`✗ Wrong amount! Expected ₹${totalFare}, got ₹${deducted}`);
      return false;
    }

    // Verify booking updated
    const { data: booking } = await supabase
      .from('bookings')
      .select('payment_status, payment_method, wallet_amount_used')
      .eq('id', bookingId)
      .single();

    info(`Booking payment_status: ${booking.payment_status}`);
    info(`Booking payment_method: ${booking.payment_method}`);
    info(`Booking wallet_amount_used: ₹${booking.wallet_amount_used}`);

    if (booking.payment_status === 'completed' && booking.payment_method === 'wallet') {
      success('✓ Booking updated correctly!');
    } else {
      error('✗ Booking not updated correctly');
      return false;
    }

    // Verify wallet transaction created
    const { data: transactions } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('booking_id', bookingId)
      .eq('type', 'debit');

    if (transactions && transactions.length === 1) {
      success(`✓ Wallet transaction created (${transactions[0].id})`);
      info(`Transaction amount: ₹${transactions[0].amount}`);
    } else {
      error('✗ Wallet transaction not created correctly');
      return false;
    }

    success('\n✅ TEST 1 PASSED: Full Wallet Payment Works!');
    return true;

  } catch (err) {
    error(`Test failed with exception: ${err.message}`);
    return false;
  }
}

// =====================================================
// STEP 4: Test Race Condition (Double Payment)
// =====================================================
async function testRaceCondition(userId) {
  log('\n========================================', 'cyan');
  log('TEST 2: Race Condition (Double Click)', 'cyan');
  log('========================================\n', 'cyan');

  try {
    // Create new booking for this test
    const { data: booking } = await supabase
      .from('bookings')
      .insert({
        customer_id: userId,
        origin_address: 'Test Pickup',
        origin_latitude: 19.0760,
        origin_longitude: 72.8777,
        destination_address: 'Test Drop',
        destination_latitude: 19.0896,
        destination_longitude: 72.8656,
        vehicle_type: 'tempo',
        total_fare: 200,
        tip_amount: 0,
        driver_payout: 200,
        status: 'pending',
        payment_status: 'pending',
        payment_method: 'cash',
        pickup_otp: '5678',
        receiver_name: 'Test',
        receiver_phone: '+919999999998'
      })
      .select()
      .single();

    const bookingId = booking.id;
    info(`Created test booking: ${bookingId}`);

    // Get balance before
    const { data: userBefore } = await supabase
      .from('users')
      .select('balance')
      .eq('id', userId)
      .single();

    const balanceBefore = userBefore.balance;
    info(`Balance before: ₹${balanceBefore}`);

    // Simulate rapid double-click by calling payment function twice simultaneously
    info('Simulating double-click (2 simultaneous payment requests)...');
    
    const [result1, result2] = await Promise.all([
      supabase.rpc('pay_with_wallet', {
        p_booking_id: bookingId,
        p_user_id: userId,
        p_use_full_wallet: true,
        p_payment_session_id: null
      }),
      supabase.rpc('pay_with_wallet', {
        p_booking_id: bookingId,
        p_user_id: userId,
        p_use_full_wallet: true,
        p_payment_session_id: null
      })
    ]);

    log('\nFirst Request Result:', 'yellow');
    console.log(JSON.stringify(result1.data, null, 2));
    
    log('\nSecond Request Result:', 'yellow');
    console.log(JSON.stringify(result2.data, null, 2));

    // One should succeed, one should fail
    const successCount = [result1.data, result2.data].filter(r => r && r.success).length;
    const failCount = [result1.data, result2.data].filter(r => r && !r.success).length;

    info(`Successful payments: ${successCount}`);
    info(`Failed payments: ${failCount}`);

    // Verify only ONE deduction
    const { data: userAfter } = await supabase
      .from('users')
      .select('balance')
      .eq('id', userId)
      .single();

    const deducted = balanceBefore - userAfter.balance;
    info(`Total amount deducted: ₹${deducted}`);

    if (deducted === 200 && successCount === 1) {
      success('✓ Race condition handled correctly! Only 1 payment processed.');
    } else {
      error(`✗ Race condition failed! Deducted: ₹${deducted}, Success count: ${successCount}`);
      return false;
    }

    // Verify only ONE wallet transaction
    const { data: transactions } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('booking_id', bookingId)
      .eq('type', 'debit');

    if (transactions.length === 1) {
      success('✓ Only 1 wallet transaction created!');
    } else {
      error(`✗ Multiple transactions created: ${transactions.length}`);
      return false;
    }

    success('\n✅ TEST 2 PASSED: Race Condition Protected!');
    return true;

  } catch (err) {
    error(`Test failed: ${err.message}`);
    return false;
  }
}

// =====================================================
// STEP 5: Test Insufficient Balance
// =====================================================
async function testInsufficientBalance(userId) {
  log('\n========================================', 'cyan');
  log('TEST 3: Insufficient Balance', 'cyan');
  log('========================================\n', 'cyan');

  try {
    // Set balance to ₹100
    await supabase
      .from('users')
      .update({ balance: 100 })
      .eq('id', userId);

    info('Set wallet balance to ₹100');

    // Create booking for ₹350
    const { data: booking } = await supabase
      .from('bookings')
      .insert({
        customer_id: userId,
        origin_address: 'Test',
        origin_latitude: 19.0760,
        origin_longitude: 72.8777,
        destination_address: 'Test',
        destination_latitude: 19.0896,
        destination_longitude: 72.8656,
        vehicle_type: 'tempo',
        total_fare: 350,
        tip_amount: 0,
        driver_payout: 350,
        status: 'pending',
        payment_status: 'pending',
        payment_method: 'cash',
        pickup_otp: '9999',
        receiver_name: 'Test',
        receiver_phone: '+919999999998'
      })
      .select()
      .single();

    info('Created booking for ₹350');

    // Try to pay
    const { data: result } = await supabase
      .rpc('pay_with_wallet', {
        p_booking_id: booking.id,
        p_user_id: userId,
        p_use_full_wallet: true,
        p_payment_session_id: null
      });

    log('\nPayment Result:', 'yellow');
    console.log(JSON.stringify(result, null, 2));

    if (!result.success && result.error === 'Insufficient balance') {
      success('✓ Insufficient balance detected correctly!');
      
      // Verify no deduction
      const { data: user } = await supabase
        .from('users')
        .select('balance')
        .eq('id', userId)
        .single();

      if (user.balance === 100) {
        success('✓ No deduction made!');
      } else {
        error(`✗ Balance changed to ₹${user.balance}`);
        return false;
      }

      success('\n✅ TEST 3 PASSED: Insufficient Balance Handled!');
      return true;
    } else {
      error('✗ Should have failed with insufficient balance');
      return false;
    }

  } catch (err) {
    error(`Test failed: ${err.message}`);
    return false;
  }
}

// =====================================================
// MAIN TEST RUNNER
// =====================================================
async function runAllTests() {
  log('\n╔════════════════════════════════════════╗', 'cyan');
  log('║  WALLET PAYMENT SYSTEM - TEST SUITE   ║', 'cyan');
  log('╚════════════════════════════════════════╝\n', 'cyan');

  const results = {
    deployment: false,
    setup: false,
    fullPayment: false,
    raceCondition: false,
    insufficientBalance: false
  };

  // Step 1: Deploy SQL
  results.deployment = await deploySQLMigration();
  
  if (!results.deployment) {
    warning('\nSQL deployment failed or requires manual setup.');
    warning('Please deploy the SQL file manually in Supabase Dashboard.');
    warning('Then run this script again with: npm run test:wallet');
  }

  // Step 2: Setup test data
  const testData = await setupTestData();
  if (!testData) {
    error('\nTest setup failed. Cannot proceed with tests.');
    process.exit(1);
  }
  results.setup = true;

  // Step 3: Run tests
  results.fullPayment = await testFullWalletPayment(testData);
  results.raceCondition = await testRaceCondition(testData.userId);
  results.insufficientBalance = await testInsufficientBalance(testData.userId);

  // Final Results
  log('\n╔════════════════════════════════════════╗', 'cyan');
  log('║         TEST RESULTS SUMMARY           ║', 'cyan');
  log('╚════════════════════════════════════════╝\n', 'cyan');

  const tests = [
    ['SQL Deployment', results.deployment],
    ['Test Setup', results.setup],
    ['Full Wallet Payment', results.fullPayment],
    ['Race Condition Protection', results.raceCondition],
    ['Insufficient Balance', results.insufficientBalance],
  ];

  tests.forEach(([name, passed]) => {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    const color = passed ? 'green' : 'red';
    log(`${status} - ${name}`, color);
  });

  const passedCount = tests.filter(([_, passed]) => passed).length;
  const totalCount = tests.length;

  log(`\n${passedCount}/${totalCount} tests passed\n`, passedCount === totalCount ? 'green' : 'red');

  if (passedCount === totalCount) {
    success('🎉 ALL TESTS PASSED! Wallet payment system is ready for production!');
  } else {
    error('Some tests failed. Please review the errors above.');
  }
}

// Run tests
runAllTests().catch(err => {
  error(`Unexpected error: ${err.message}`);
  console.error(err);
  process.exit(1);
});
