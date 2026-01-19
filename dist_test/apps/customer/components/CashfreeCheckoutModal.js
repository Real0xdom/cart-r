"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const react_native_webview_1 = require("react-native-webview");
const vector_icons_1 = require("@expo/vector-icons");
const { height: SCREEN_HEIGHT } = react_native_1.Dimensions.get('window');
/**
 * Cashfree Popup Checkout Modal
 * Uses WebView to render Cashfree's JS SDK checkout in a modal
 * This provides the popup checkout experience in React Native
 */
const CashfreeCheckoutModal = ({ visible, paymentSessionId, orderId, environment, onSuccess, onFailure, onClose, }) => {
    const webViewRef = (0, react_1.useRef)(null);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    // Reset state when modal opens
    (0, react_1.useEffect)(() => {
        if (visible) {
            setLoading(true);
            setError(null);
        }
    }, [visible]);
    // HTML template that loads Cashfree JS SDK and triggers popup checkout
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
    <div class="error-icon">⚠️</div>
    <p>Payment could not be initialized</p>
    <p class="error-message" id="error-message"></p>
    <button class="retry-btn" onclick="initPayment()">Retry</button>
  </div>

  <script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
  <script>
    // Communication bridge to React Native
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
        // Initialize Cashfree SDK
        const cashfree = Cashfree({
          mode: "${environment}"
        });

        sendMessage('SDK_INITIALIZED', { environment: "${environment}" });

        // Checkout options for popup mode
        const checkoutOptions = {
          paymentSessionId: "${paymentSessionId}",
          redirectTarget: "_modal", // This makes it a popup/modal checkout
        };

        sendMessage('CHECKOUT_STARTING', { orderId: "${orderId}" });

        // Trigger checkout
        const result = await cashfree.checkout(checkoutOptions);

        if (result.error) {
          // User closed the popup or payment error
          sendMessage('PAYMENT_ERROR', { 
            error: result.error.message || 'Payment was cancelled or failed',
            orderId: "${orderId}"
          });
        } else if (result.redirect) {
          // Redirection case (exceptional, shouldn't happen in modal mode)
          sendMessage('PAYMENT_REDIRECT', { orderId: "${orderId}" });
        } else if (result.paymentDetails) {
          // Payment completed - check status
          sendMessage('PAYMENT_COMPLETED', { 
            orderId: "${orderId}",
            paymentDetails: result.paymentDetails
          });
        }

      } catch (err) {
        console.error('Checkout error:', err);
        showError(err.message || 'Failed to initialize payment');
        sendMessage('CHECKOUT_ERROR', { 
          error: err.message || 'Unknown error',
          orderId: "${orderId}"
        });
      }
    }

    // Start payment when page loads
    window.onload = function() {
      setTimeout(initPayment, 500); // Small delay to ensure SDK is loaded
    };
  </script>
</body>
</html>
    `;
    };
    // Handle messages from WebView
    const handleMessage = (event) => {
        try {
            const message = JSON.parse(event.nativeEvent.data);
            console.log('Cashfree WebView message:', message);
            switch (message.type) {
                case 'SDK_INITIALIZED':
                    console.log('Cashfree SDK initialized in WebView');
                    setLoading(false);
                    break;
                case 'CHECKOUT_STARTING':
                    console.log('Checkout starting for order:', message.data.orderId);
                    break;
                case 'PAYMENT_COMPLETED':
                    console.log('Payment completed:', message.data);
                    onSuccess(message.data.orderId, message.data.paymentDetails);
                    break;
                case 'PAYMENT_ERROR':
                    console.log('Payment error:', message.data);
                    onFailure(message.data.error, message.data.orderId);
                    break;
                case 'PAYMENT_REDIRECT':
                    console.log('Payment redirecting (rare case)');
                    // In redirect case, we should verify payment status
                    onSuccess(message.data.orderId);
                    break;
                case 'CHECKOUT_ERROR':
                    console.error('Checkout error:', message.data);
                    setError(message.data.error);
                    onFailure(message.data.error, message.data.orderId);
                    break;
            }
        }
        catch (e) {
            console.error('Error parsing WebView message:', e);
        }
    };
    const handleWebViewError = (syntheticEvent) => {
        const { nativeEvent } = syntheticEvent;
        console.error('WebView error:', nativeEvent);
        setError('Failed to load payment page. Please check your internet connection.');
        setLoading(false);
    };
    return (<react_native_1.Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <react_native_1.View style={styles.overlay}>
        <react_native_1.View style={styles.container}>
          {/* Header */}
          <react_native_1.View style={styles.header}>
            <react_native_1.View style={styles.headerHandle}/>
            <react_native_1.View style={styles.headerContent}>
              <react_native_1.Text style={styles.headerTitle}>Secure Payment</react_native_1.Text>
              <react_native_1.TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <vector_icons_1.Feather name="x" size={24} color="#666"/>
              </react_native_1.TouchableOpacity>
            </react_native_1.View>
          </react_native_1.View>

          {/* WebView Content */}
          <react_native_1.View style={styles.webViewContainer}>
            {loading && (<react_native_1.View style={styles.loadingOverlay}>
                <react_native_1.ActivityIndicator size="large" color="#F5B800"/>
                <react_native_1.Text style={styles.loadingText}>Loading payment...</react_native_1.Text>
              </react_native_1.View>)}
            
            {error ? (<react_native_1.View style={styles.errorContainer}>
                <vector_icons_1.Feather name="alert-circle" size={48} color="#ff6b6b"/>
                <react_native_1.Text style={styles.errorTitle}>Payment Error</react_native_1.Text>
                <react_native_1.Text style={styles.errorMessage}>{error}</react_native_1.Text>
                <react_native_1.TouchableOpacity style={styles.retryButton} onPress={() => {
                var _a;
                setError(null);
                setLoading(true);
                (_a = webViewRef.current) === null || _a === void 0 ? void 0 : _a.reload();
            }}>
                  <react_native_1.Text style={styles.retryButtonText}>Retry</react_native_1.Text>
                </react_native_1.TouchableOpacity>
              </react_native_1.View>) : (<react_native_webview_1.WebView ref={webViewRef} source={{ html: getCheckoutHTML() }} style={styles.webView} onMessage={handleMessage} onError={handleWebViewError} onHttpError={handleWebViewError} javaScriptEnabled={true} domStorageEnabled={true} startInLoadingState={true} scalesPageToFit={true} mixedContentMode="compatibility" allowsInlineMediaPlayback={true} 
        // Enable secure context for payment
        originWhitelist={['*']} 
        // Allow popups for payment flows
        setSupportMultipleWindows={true} onNavigationStateChange={(navState) => {
                console.log('WebView navigation:', navState.url);
            }}/>)}
          </react_native_1.View>

          {/* Footer with security badge */}
          <react_native_1.View style={styles.footer}>
            <vector_icons_1.Feather name="lock" size={12} color="#888"/>
            <react_native_1.Text style={styles.footerText}>Secured by Cashfree Payments</react_native_1.Text>
          </react_native_1.View>
        </react_native_1.View>
      </react_native_1.View>
    </react_native_1.Modal>);
};
const styles = react_native_1.StyleSheet.create({
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
        ...react_native_1.StyleSheet.absoluteFillObject,
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
exports.default = CashfreeCheckoutModal;
