// Checkout Page Edge Function
// Serves a simple HTML page that loads the Cashfree JS SDK and opens the checkout
Deno.serve(async (req) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      } 
    })
  }

  try {
    const url = new URL(req.url)
    const sessionId = url.searchParams.get('session_id')
    const env = url.searchParams.get('env') || 'sandbox'

    if (!sessionId) {
        return new Response("Missing session_id", { 
            status: 400,
            headers: { "Content-Type": "text/plain" }
        });
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Secure Payment - CartR</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex; justify-content: center; align-items: center; 
              height: 100vh; margin: 0; 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: #333;
            }
            .container {
              text-align: center;
              background: white;
              border-radius: 20px;
              padding: 40px 30px;
              margin: 20px;
              max-width: 400px;
              width: 100%;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            }
            .loader { 
              border: 4px solid #f3f3f3; 
              border-top: 4px solid #667eea; 
              border-radius: 50%; 
              width: 48px; height: 48px; 
              animation: spin 1s linear infinite; 
              margin: 0 auto 20px;
            }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            h2 { font-size: 20px; margin-bottom: 8px; color: #1a1a2e; }
            p { font-size: 14px; color: #666; line-height: 1.5; }
            .error { display: none; }
            .error h2 { color: #e53e3e; }
            .error p { color: #666; margin-bottom: 16px; }
            .retry-btn {
              background: #667eea; color: white; 
              border: none; border-radius: 12px;
              padding: 14px 28px; font-size: 16px; font-weight: 600;
              cursor: pointer; margin-top: 16px;
              width: 100%;
            }
            .retry-btn:active { opacity: 0.8; }
            .env-badge {
              display: inline-block;
              background: #fef3c7; color: #92400e;
              padding: 4px 12px; border-radius: 20px;
              font-size: 11px; font-weight: 600;
              margin-bottom: 16px;
            }
          </style>
          <script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
        </head>
        <body>
          <div class="container">
            ${env === 'sandbox' ? '<div class="env-badge">🧪 SANDBOX MODE</div>' : ''}
            
            <div id="loading">
              <div class="loader"></div>
              <h2>Loading Payment...</h2>
              <p>Please wait while we set up your secure checkout.</p>
            </div>
            
            <div id="error" class="error">
              <h2>⚠️ Payment Error</h2>
              <p id="error-msg">Something went wrong loading the payment page.</p>
              <button class="retry-btn" onclick="startCheckout()">Try Again</button>
              <button class="retry-btn" style="background:#e5e7eb;color:#374151;margin-top:8px;" onclick="window.history.back()">Go Back</button>
            </div>
          </div>
          
          <script>
            var checkoutAttempts = 0;
            
            function showError(msg) {
              document.getElementById('loading').style.display = 'none';
              document.getElementById('error').style.display = 'block';
              if (msg) document.getElementById('error-msg').textContent = msg;
            }
            
            function startCheckout() {
              checkoutAttempts++;
              document.getElementById('loading').style.display = 'block';
              document.getElementById('error').style.display = 'none';
              
              try {
                if (typeof Cashfree === 'undefined') {
                  showError('Payment SDK failed to load. Please check your internet connection and try again.');
                  return;
                }
                
                var cf = Cashfree({ mode: "${env}" });
                cf.checkout({
                  paymentSessionId: "${sessionId}",
                  redirectTarget: "_self"
                }).then(function(result) {
                  if (result.error) {
                    console.error("Checkout error:", result.error);
                    showError(result.error.message || 'Payment checkout failed. Please try again.');
                  }
                  if (result.paymentDetails) {
                    console.log("Payment complete:", result.paymentDetails);
                  }
                }).catch(function(err) {
                  console.error("Checkout exception:", err);
                  showError('Payment checkout encountered an error. Please try again.');
                });
              } catch(e) {
                console.error("Checkout init error:", e);
                showError('Failed to initialize payment. Please try again.');
              }
            }
            
            // Start checkout when page loads, with a small delay
            window.onload = function() {
              setTimeout(startCheckout, 500);
            }
            
            // Timeout - if still loading after 15 seconds, show error
            setTimeout(function() {
              var loading = document.getElementById('loading');
              if (loading && loading.style.display !== 'none') {
                showError('Payment page is taking too long to load. Please try again.');
              }
            }, 15000);
          </script>
        </body>
      </html>
    `;

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
})
