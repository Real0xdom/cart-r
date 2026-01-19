"use strict";
// Cashfree Checkout Page Edge Function
// Serves an HTML page with the Cashfree JS SDK for web checkout
Object.defineProperty(exports, "__esModule", { value: true });
const server_ts_1 = require("https://deno.land/std@0.168.0/http/server.ts");
(0, server_ts_1.serve)(async (req) => {
    const url = new URL(req.url);
    const paymentSessionId = url.searchParams.get('session') || '';
    const orderId = url.searchParams.get('order') || '';
    const env = url.searchParams.get('env') || 'sandbox';
    const returnUrl = url.searchParams.get('return') || 'cartr://payment-callback';
    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CartR Payment</title>
    <script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            text-align: center;
            max-width: 420px;
            width: 92%;
        }
        .logo { font-size: 48px; margin-bottom: 10px; }
        h1 { color: #1a1a2e; margin: 0 0 8px 0; font-size: 24px; }
        p { color: #666; margin: 0 0 30px 0; font-size: 14px; }
        .loader {
            border: 4px solid #f0f0f0;
            border-top: 4px solid #F5B800;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            animation: spin 0.8s linear infinite;
            margin: 20px auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .message {
            padding: 16px 20px;
            border-radius: 12px;
            margin-top: 20px;
            font-size: 14px;
            display: none;
        }
        .error { color: #c0392b; background: #fdeaea; border: 1px solid #f5c6cb; }
        .success { color: #27ae60; background: #d4edda; border: 1px solid #c3e6cb; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🚗</div>
        <h1>CartR Payment</h1>
        <p id="status">Initializing secure payment...</p>
        <div class="loader" id="loader"></div>
        <div class="message error" id="error"></div>
        <div class="message success" id="success"></div>
    </div>
    <script>
        var paymentSessionId = "${paymentSessionId}";
        var orderId = "${orderId}";
        var env = "${env}";
        var returnUrl = decodeURIComponent("${encodeURIComponent(returnUrl)}");

        function showError(msg) {
            document.getElementById('loader').style.display = 'none';
            document.getElementById('status').textContent = 'Payment Failed';
            document.getElementById('error').style.display = 'block';
            document.getElementById('error').textContent = msg;
        }

        function showSuccess(msg) {
            document.getElementById('loader').style.display = 'none';
            document.getElementById('status').textContent = 'Payment Successful!';
            document.getElementById('success').style.display = 'block';
            document.getElementById('success').textContent = msg;
        }

        if (!paymentSessionId) {
            showError('Missing payment session. Please go back and try again.');
        } else {
            document.getElementById('status').textContent = 'Opening payment gateway...';
            
            try {
                var cashfree = Cashfree({ mode: env === 'production' ? 'production' : 'sandbox' });
                
                cashfree.checkout({
                    paymentSessionId: paymentSessionId,
                    redirectTarget: '_self'
                }).then(function(result) {
                    console.log('Checkout result:', result);
                    if (result.error) {
                        showError(result.error.message || 'Payment could not be completed');
                    } else if (result.paymentDetails) {
                        showSuccess('Payment completed! Redirecting...');
                        setTimeout(function() {
                            window.location.href = returnUrl + '?order_id=' + orderId + '&status=success';
                        }, 1500);
                    }
                }).catch(function(err) {
                    console.error('Checkout error:', err);
                    showError(err.message || 'Something went wrong. Please try again.');
                });
            } catch (e) {
                console.error('Init error:', e);
                showError('Failed to initialize payment. Please try again.');
            }
        }
    </script>
</body>
</html>`;
    return new Response(html, {
        headers: {
            'Content-Type': 'text/html',
        },
    });
});
