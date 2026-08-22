import React, { useRef, useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Platform, Dimensions } from 'react-native';
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

/**
 * Cashfree Popup Checkout Modal
 * Uses WebView to render Cashfree's JS SDK checkout in a modal
 * This provides the popup checkout experience in React Native
 */
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setLoading(true);
      setError(null);
    }
  }, [visible]);

  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3000';
  const directCheckoutUrl = `${backendUrl}/api/payment/checkout-page?session_id=${paymentSessionId}&env=${environment}`;

  // Handle messages from WebView
  const handleMessage = (event: WebViewMessageEvent) => {
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
    } catch (e) {
      console.error('Error parsing WebView message:', e);
    }
  };

  const isReturnUrl = (url: string) =>
    url.includes('payment-callback') || url.includes('payment-complete') || url.includes('payment-success');

  const handleWebViewError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('WebView error:', nativeEvent);

    // Cashfree's return_url is a placeholder page that may 404 - the payment itself
    // can still have succeeded, so don't show a fatal error for it. Treat it as success
    // and let the app verify the real payment status with the backend instead.
    if (isReturnUrl(nativeEvent.url || '')) {
      console.log('Return URL failed to load (expected) - verifying payment instead:', nativeEvent.url);
      onSuccess(orderId);
      return;
    }

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
          {/* Header */}
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

          {/* WebView Content */}
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
                source={{ uri: directCheckoutUrl }}
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
                onShouldStartLoadWithRequest={(request) => {
                  if (isReturnUrl(request.url)) {
                    console.log('Payment return URL intercepted (navigation blocked):', request.url);
                    onSuccess(orderId);
                    return false;
                  }
                  return true;
                }}
                onNavigationStateChange={(navState) => {
                  console.log('WebView navigation:', navState.url);
                }}
              />
            )}
          </View>

          {/* Footer with security badge */}
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



