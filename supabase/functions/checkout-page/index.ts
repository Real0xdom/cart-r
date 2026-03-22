Deno.serve(async (req) => {
  const { method } = req;

  // Handle CORS for AJAX/API hits
  if (method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("session_id");
    const env = url.searchParams.get("env") || "sandbox";

    if (!sessionId) {
      return new Response("Error: session_id is required", {
        status: 400,
        headers: { "Content-Type": "text/plain" },
      });
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Secure Checkout | CartR</title>
  <style>
    :root { --primary: #764ba2; --accent: #667eea; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, system-ui, sans-serif;
      display: flex; justify-content: center; align-items: center; 
      min-height: 100vh; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #333; margin: 0;
    }
    .card {
      background: white; border-radius: 24px; padding: 40px 24px;
      width: 90%; max-width: 400px; text-align: center;
      box-shadow: 0 15px 35px rgba(0,0,0,0.2);
    }
    .loader {
      width: 48px; height: 48px; border: 4px solid #f3f3f3;
      border-top: 4px solid var(--primary); border-radius: 50%;
      animation: spin 1s linear infinite; margin: 0 auto 24px;
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    h1 { font-size: 20px; font-weight: 700; color: #1a1a2e; margin-bottom: 12px; }
    p { font-size: 14px; color: #666; margin-bottom: 30px; line-height: 1.5; }
    .btn {
      display: block; width: 100%; padding: 16px; border-radius: 12px;
      font-size: 16px; font-weight: 600; text-decoration: none;
      transition: all 0.2s; cursor: pointer; border: none;
    }
    .btn-primary { background: var(--primary); color: white; margin-bottom: 12px; }
    .btn-secondary { background: #f8f9fa; color: #666; }
    .btn:active { transform: scale(0.98); opacity: 0.9; }
    .env-tag {
      display: inline-block; padding: 4px 12px; background: #fff3cd;
      color: #856404; font-size: 11px; font-weight: 800;
      border-radius: 100px; margin-bottom: 20px; text-transform: uppercase;
    }
    #finish-ui { display: none; }
    #error-ui { display: none; }
  </style>
  <script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
</head>
<body>
  <div class="card" id="main-ui">
    ${env === 'sandbox' ? '<div class="env-tag">Sandbox Mode</div>' : ''}
    <div id="loading-ui">
      <div class="loader"></div>
      <h1>Launching Checkout</h1>
      <p>Please wait while we set up your secure payment session.</p>
    </div>

    <div id="finish-ui">
      <h1>Payment Finished</h1>
      <p>If you aren't automatically redirected, please use the button below to return to the CartR app.</p>
      <button class="btn btn-primary" onclick="window.location.href='carter://payment-callback'">Return to App</button>
    </div>

    <div id="error-ui">
      <h1 style="color: #dc3545">Initialization Failed</h1>
      <p id="error-text">We couldn't reach the payment gateway. Please check your connection.</p>
      <button class="btn btn-primary" onclick="location.reload()">Retry Now</button>
      <button class="btn btn-secondary" onclick="window.location.href='carter://payment-callback'">Go Back</button>
    </div>
  </div>

  <script>
    let cashfree;
    const checkoutOptions = {
      paymentSessionId: "${sessionId}",
      redirectTarget: "_self" 
    };

    function startCheckout() {
      try {
        if (typeof Cashfree === 'undefined') {
          showError("Cashfree SDK failed to load. Please check your internet.");
          return;
        }

        cashfree = Cashfree({ mode: "${env}" });
        cashfree.checkout(checkoutOptions).then((result) => {
          if (result.error) {
            showError(result.error.message);
          } else {
            showFinish();
          }
        }).catch(err => {
          showError("System error during checkout initialization.");
        });
      } catch (e) {
        showError("Failed to initialize payment bridge.");
      }
    }

    function showError(msg) {
      document.getElementById('loading-ui').style.display = 'none';
      document.getElementById('error-ui').style.display = 'block';
      document.getElementById('error-text').textContent = msg;
    }

    function showFinish() {
      document.getElementById('loading-ui').style.display = 'none';
      document.getElementById('finish-ui').style.display = 'block';
    }

    window.onload = () => setTimeout(startCheckout, 800);
    
    setTimeout(() => {
      if (document.getElementById('loading-ui').style.display !== 'none') {
        showError("The payment session timed out. Please try again.");
      }
    }, 25000);
  </script>
</body>
</html>`;

    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    });

  } catch (err) {
    return new Response(String(err), { status: 500 });
  }
});
