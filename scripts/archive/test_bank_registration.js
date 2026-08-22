// Test script for bank registration flow
// Run this from the driver app after logging in as a driver

async function testBankRegistration() {
  console.log('🧪 Testing Bank Registration Flow...\n');

  const supabase = window.supabase; // Assuming supabase is available globally

  // Test Case 1: First-time registration
  console.log('Test 1: New Bank Registration');
  console.log('-------------------------------');
  
  const testBankDetails = {
    account_holder_name: 'John Doe',
    account_number: '026291800001191',
    ifsc_code: 'YESB0000262',
    bank_name: 'Yes Bank'
  };

  try {
    // Step 1: Save bank details to database
   const { data: driverData } = await supabase.from('drivers').select('id').single();
    
    if (!driverData) {
     console.error('❌ No driver profile found');
      return;
    }

   const { error: saveError } = await supabase
      .from('drivers')
      .update({ bank_details: testBankDetails })
      .eq('id', driverData.id);

    if (saveError) {
     console.error('❌ Failed to save bank details:', saveError.message);
      return;
    }

   console.log('✅ Bank details saved to database');

    // Step 2: Call create-beneficiary edge function
   const { data, error } = await supabase.functions.invoke('create-beneficiary', {
      body: { driver_id: driverData.id }
    });

    if (error) {
     console.error('❌ Edge function error:', error.message);
     console.log('Response:', data);
      return;
    }

   console.log('✅ Edge function response:', data);

    if (data.success) {
     console.log('✅ SUCCESS: Bank registered successfully');
     console.log('   Beneficiary ID:', data.beneficiary_id);
     console.log('   Message:', data.message);
      
      if (data.cashfree_response) {
       console.log('   Cashfree Status:', data.cashfree_response.beneficiary_status || 'N/A');
      }
    } else {
     console.error('❌ FAILED:', data.message || data.error);
      if (data.cashfree_response) {
       console.log('   Cashfree Response:', data.cashfree_response);
      }
    }

  } catch (err) {
   console.error('❌ Unexpected error:', err.message);
  }

  console.log('\n\nTest 2: Duplicate Registration (Same Driver)');
  console.log('-------------------------------------------');
  console.log('Try adding the same bank account again...');
  console.log('Expected: Should show "already registered" but still succeed\n');
}

// Run the test
testBankRegistration();
