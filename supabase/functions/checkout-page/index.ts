// Native Deno HTTP server (No imports needed)
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
          <title>Secure Payment</title>
          <style>
            body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f9f9f9; }
            .loader { border: 4px solid #f3f3f3; border-top: 4px solid #333; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          </style>
          <script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
        </head>
        <body>
          <div class="loader"></div>
          <script>
            window.onload = function() {
              const cf = Cashfree({ mode: "${env}" });
              cf.checkout({
                paymentSessionId: "${sessionId}",
                redirectTarget: "_self"
              });
            }
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
