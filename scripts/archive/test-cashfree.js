// Quick test script to check Cashfree API response
const fetch = require('node-fetch');

async function testCashfreeOrder() {
  const response = await fetch('https://sandbox.cashfree.com/pg/orders', {
    method: 'POST',
    headers: {
      'x-client-id': 'TEST103943267d6e8b3a61a90fcfc6e562349301',
      'x-client-secret': 'cfsk_ma_test_266814dbdc34e269c77d122fbee36096_32373c15',
      'x-api-version': '2023-08-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      order_id: `TEST_${Date.now()}`,
      order_amount: 10,
      order_currency: 'INR',
      customer_details: {
        customer_id: 'test123',
        customer_phone: '9999999999',
        customer_email: 'test@test.com',
        customer_name: 'Test User'
      }
    })
  });

  const data = await response.json();
  console.log('Status:', response.status);
  console.log('Full Response:', JSON.stringify(data, null, 2));
  console.log('\n--- Payment Session ID ---');
  console.log(data.payment_session_id);
  console.log('\n--- Does it end with "payment"? ---');
  console.log(data.payment_session_id?.endsWith('payment'));
}

testCashfreeOrder().catch(console.error);
