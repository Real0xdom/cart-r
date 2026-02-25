// UPI QR View Component
// Renders a Cashfree UPI QR code inside a WebView for the driver to show to customers.
// The customer scans the QR with any UPI app (GPay, PhonePe, etc.)

import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';

// Only load WebView on native platforms
let WebView: any = null;
if (Platform.OS !== 'web') {
  try {
    WebView = require('react-native-webview').default;
  } catch (e) {
    console.log('[UpiQrView] WebView not available');
  }
}

interface UpiQrViewProps {
  paymentSessionId: string;
  environment: 'sandbox' | 'production';
  amount: number;
}

const UpiQrView: React.FC<UpiQrViewProps> = ({ paymentSessionId, environment, amount }) => {
  if (!WebView) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>QR display requires WebView</Text>
      </View>
    );
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
        <title>UPI QR Payment</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: #f8fafc;
            padding: 20px;
          }
          .amount {
            font-size: 28px;
            font-weight: 800;
            color: #16a34a;
            margin-bottom: 8px;
          }
          .subtitle {
            font-size: 14px;
            color: #6b7280;
            margin-bottom: 24px;
          }
          #qr-mount {
            background: white;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.08);
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 280px;
            min-height: 280px;
          }
          .loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            color: #6b7280;
          }
          .spinner {
            width: 32px; height: 32px;
            border: 3px solid #e5e7eb;
            border-top: 3px solid #16a34a;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
          .hint {
            font-size: 12px;
            color: #9ca3af;
            margin-top: 16px;
            text-align: center;
          }
          .error {
            color: #ef4444;
            font-size: 14px;
            text-align: center;
          }
        </style>
        <script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
      </head>
      <body>
        <div class="amount">₹${amount}</div>
        <div class="subtitle">Scan to Pay</div>
        <div id="qr-mount">
          <div class="loading">
            <div class="spinner"></div>
            <span>Generating QR...</span>
          </div>
        </div>
        <div class="hint">Customer can scan with GPay, PhonePe, Paytm or any UPI app</div>
        <script>
          window.onload = function() {
            try {
              const cf = Cashfree({ mode: "${environment}" });
              
              // Clear loading
              document.getElementById('qr-mount').innerHTML = '';
              
              // Create UPI QR component
              const upiQr = cf.create('upiQr', {
                values: {
                  size: "250px"
                }
              });
              
              upiQr.mount('#qr-mount');
              
              // Also try to show using checkout if upiQr doesn't work
              cf.checkout({
                paymentSessionId: "${paymentSessionId}",
                components: ["upiQr"],
                onSuccess: function(data) {
                  document.getElementById('qr-mount').innerHTML = '<div style="color:#16a34a;font-size:18px;font-weight:bold;">✅ Payment Received!</div>';
                  // Notify React Native
                  if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PAYMENT_SUCCESS', data: data }));
                  }
                },
                onFailure: function(data) {
                  if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PAYMENT_FAILED', data: data }));
                  }
                }
              });
            } catch(e) {
              document.getElementById('qr-mount').innerHTML = '<div class="error">Failed to load QR: ' + e.message + '</div>';
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ERROR', message: e.message }));
              }
            }
          }
        </script>
      </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <WebView
        source={{ html }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#16a34a" />
            <Text style={styles.loadingText}>Loading QR Code...</Text>
          </View>
        )}
        onMessage={(event: any) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            console.log('[UpiQrView] Message from WebView:', data);
          } catch (e) {
            console.log('[UpiQrView] Raw message:', event.nativeEvent.data);
          }
        }}
        scrollEnabled={false}
        bounces={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 420,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 8,
    color: '#6b7280',
    fontSize: 14,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
    padding: 20,
  },
});

export default UpiQrView;
