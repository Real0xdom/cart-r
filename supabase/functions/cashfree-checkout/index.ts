// Cashfree Checkout Page Edge Function
// Returns an HTML page that loads Cashfree SDK and initiates payment

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const paymentSessionId = url.searchParams.get('session')
    const orderId = url.searchParams.get('order_id')
    const returnUrl = url.searchParams.get('return_url') || 'cartr://payment-complete'
    const isSandbox = url.searchParams.get('env') !== 'production'

    if (!paymentSessionId) {
      return new Response(
        JSON.stringify({ error: 'Missing payment session ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Return HTML page that loads Cashfree SDK
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CartR Payment</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 24px;
      padding: 40px;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .logo {
      font-size: 28px;
      font-weight: 800;
      color: #F5B800;
      margin-bottom: 20px;
    }
    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #F5B800;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .message {
      color: #666;
      font-size: 16px;
    }
    .error {
      color: #e74c3c;
      padding: 20px;
      background: #ffeaea;
      border-radius: 12px;
      margin-top: 20px;
      display: none;
    }
    .success {
      color: #27ae60;
      padding: 20px;
      background: #eafff0;
      border-radius: 12px;
      margin-top: 20px;
      display: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">CartR</div>
    <div class="loading" id="loading">
      <div class="spinner"></div>
      <div class="message">Initializing secure payment...</div>
    </div>
    <div class="error" id="error"></div>
    <div class="success" id="success">
      <h3>Payment Successful! ✓</h3>
      <p>Redirecting back to app...</p>
    </div>
  </div>

  <script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
  <script>
    const paymentSessionId = "${paymentSessionId}";
    const orderId = "${orderId || ''}";
    const returnUrl = "${returnUrl}";
    const isSandbox = ${isSandbox};

    async function initPayment() {
      try {
        const cashfree = Cashfree({
          mode: isSandbox ? "sandbox" : "production"
        });

        const checkoutOptions = {
          paymentSessionId: paymentSessionId,
          redirectTarget: "_self"
        };

        cashfree.checkout(checkoutOptions).then((result) => {
          if (result.error) {
            document.getElementById('loading').style.display = 'none';
            document.getElementById('error').style.display = 'block';
            document.getElementById('error').innerHTML = '<h3>Payment Failed</h3><p>' + result.error.message + '</p>';
          }
          if (result.redirect) {
            // Payment page was redirected
            console.log("Payment redirect");
          }
          if (result.paymentDetails) {
            // Payment completed
            document.getElementById('loading').style.display = 'none';
            document.getElementById('success').style.display = 'block';
            
            // Redirect back to app after 2 seconds
            setTimeout(() => {
              window.location.href = returnUrl + '?order_id=' + orderId + '&status=success';
            }, 2000);
          }
        });
      } catch (error) {
        console.error('Payment init error:', error);
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error').style.display = 'block';
        document.getElementById('error').innerHTML = '<h3>Error</h3><p>' + error.message + '</p>';
      }
    }

    // Start payment when page loads
    window.onload = initPayment;
  </script>
</body>
</html>
    `

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
