import React, { useRef, useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Dimensions } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { Feather } from '@expo/vector-icons';

interface CashfreeCheckoutModalProps {
  visible: boolean;
  paymentSessionId: string;
  orderId: string;
  environment: 'sandbox' | 'production';
  onSuccess: (orderId: string, paymentDetails?: any) => void;
  onFailure: (error: string, orderId: string) => void;
  onClose: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const CashfreeCheckoutModal: React.FC<CashfreeCheckoutModalProps> = ({
  visible,
  paymentSessionId,
  orderId,
  environment,
  onSuccess,
  onFailure,
  onClose,
}) => {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      setError(null);
    }
  }, [visible]);

  const getCheckoutHTML = () => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Payment</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .loader-container {
      text-align: center;
      color: white;
    }
    .spinner {
      width: 50px;
      height: 50px;
      border: 4px solid rgba(255,255,255,0.2);
      border-top-color: #F5B800;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .message {
      font-size: 16px;
      opacity: 0.9;
      margin-top: 10px;
    }
    .error-container {
      text-align: center;
      color: white;
      padding: 30px;
    }
    .error-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
    .error-message {
      color: #ff6b6b;
      font-size: 14px;
      margin-top: 10px;
    }
    .retry-btn {
      background: #F5B800;
      color: #000;
      border: none;
      padding: 12px 32px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div id="loader" class="loader-container">
    <div class="spinner"></div>
    <p class="message">Initializing secure payment...</p>
  </div>

  <div id="error" class="error-container" style="display: none;">
    <div class="error-icon">!</div>
    <p>Payment could not be initialized</p>
    <p class="error-message" id="error-message"></p>
    <button class="retry-btn" onclick="initPayment()">Retry</button>
  </div>

  <script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
  <script>
    function sendMessage(type, data) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, data }));
      }
    }

    function showError(message) {
      document.getElementById('loader').style.display = 'none';
      document.getElementById('error').style.display = 'block';
      document.getElementById('error-message').textContent = message;
    }

    async function initPayment() {
      document.getElementById('loader').style.display = 'block';
      document.getElementById('error').style.display = 'none';

      try {
        const cashfree = Cashfree({
          mode: "${environment}"
        });

        sendMessage('SDK_INITIALIZED', { environment: "${environment}" });

        const checkoutOptions = {
          paymentSessionId: "${paymentSessionId}",
          redirectTarget: "_modal",
        };

        sendMessage('CHECKOUT_STARTING', { orderId: "${orderId}" });

        const result = await cashfree.checkout(checkoutOptions);

        if (result.error) {
          sendMessage('PAYMENT_ERROR', {
            error: result.error.message || 'Payment was cancelled or failed',
            orderId: "${orderId}"
          });
        } else if (result.redirect) {
          sendMessage('PAYMENT_REDIRECT', { orderId: "${orderId}" });
        } else if (result.paymentDetails) {
          sendMessage('PAYMENT_COMPLETED', {
            orderId: "${orderId}",
            paymentDetails: result.paymentDetails
          });
        }
      } catch (err) {
        showError(err.message || 'Failed to initialize payment');
        sendMessage('CHECKOUT_ERROR', {
          error: err.message || 'Unknown error',
          orderId: "${orderId}"
        });
      }
    }

    window.onload = function() {
      setTimeout(initPayment, 500);
    };
  </script>
</body>
</html>
    `;
  };

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);

      switch (message.type) {
        case 'SDK_INITIALIZED':
          setLoading(false);
          break;
        case 'PAYMENT_COMPLETED':
          onSuccess(message.data.orderId, message.data.paymentDetails);
          break;
        case 'PAYMENT_ERROR':
          onFailure(message.data.error, message.data.orderId);
          break;
        case 'PAYMENT_REDIRECT':
          onSuccess(message.data.orderId);
          break;
        case 'CHECKOUT_ERROR':
          setError(message.data.error);
          onFailure(message.data.error, message.data.orderId);
          break;
      }
    } catch (parseError) {
      console.error('Error parsing Cashfree WebView message:', parseError);
    }
  };

  const handleWebViewError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('WebView error:', nativeEvent);
    setError('Failed to load payment page. Please check your internet connection.');
    setLoading(false);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerHandle} />
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Secure Payment</Text>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="x" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.webViewContainer}>
            {loading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#F5B800" />
                <Text style={styles.loadingText}>Loading payment...</Text>
              </View>
            )}

            {error ? (
              <View style={styles.errorContainer}>
                <Feather name="alert-circle" size={48} color="#ff6b6b" />
                <Text style={styles.errorTitle}>Payment Error</Text>
                <Text style={styles.errorMessage}>{error}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => {
                    setError(null);
                    setLoading(true);
                    webViewRef.current?.reload();
                  }}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <WebView
                ref={webViewRef}
                source={{ html: getCheckoutHTML() }}
                style={styles.webView}
                onMessage={handleMessage}
                onError={handleWebViewError}
                onHttpError={handleWebViewError}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
                scalesPageToFit={true}
                mixedContentMode="compatibility"
                allowsInlineMediaPlayback={true}
                originWhitelist={['*']}
                setSupportMultipleWindows={true}
              />
            )}
          </View>

          <View style={styles.footer}>
            <Feather name="lock" size={12} color="#888" />
            <Text style={styles.footerText}>Secured by Cashfree Payments</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: SCREEN_HEIGHT * 0.9,
    overflow: 'hidden',
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 12,
  },
  headerHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  webViewContainer: {
    flex: 1,
    position: 'relative',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 16,
    color: '#fff',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#1a1a2e',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
  },
  errorMessage: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#F5B800',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  retryButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fafafa',
  },
  footerText: {
    marginLeft: 6,
    fontSize: 12,
    color: '#888',
  },
});

export default CashfreeCheckoutModal;
