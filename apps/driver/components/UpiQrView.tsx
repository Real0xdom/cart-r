// UPI QR View Component
// Renders a native QR code for the Cashfree checkout URL.
// Customer scans with their phone camera → opens payment page → pays.
// Payment confirmation comes via Cashfree webhook → updates booking → real-time subscription picks it up.

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

// Import QR code component (works in Expo Go and dev builds)
let QRCode: any = null;
try {
  QRCode = require('react-native-qrcode-svg').default;
} catch (e) {
  console.log('[UpiQrView] QRCode library not available:', e);
}

interface UpiQrViewProps {
  /** The URL to encode in the QR code (checkout page URL) */
  qrUrl: string;
  /** Amount to display above the QR */
  amount: number;
  /** Whether payment has been received */
  isPaid?: boolean;
  /** Whether we're waiting for payment confirmation */
  isPolling?: boolean;
}

const UpiQrView: React.FC<UpiQrViewProps> = ({ qrUrl, amount, isPaid = false, isPolling = false }) => {
  if (isPaid) {
    return (
      <View style={styles.container}>
        <View style={styles.successCard}>
          <Text style={styles.successIcon}>✅</Text>
          <Text style={styles.successTitle}>Payment Received!</Text>
          <Text style={styles.successAmount}>₹{amount}</Text>
        </View>
      </View>
    );
  }

  if (!QRCode) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>QR code library not available. Please restart the app.</Text>
      </View>
    );
  }

  if (!qrUrl) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={styles.loadingText}>Generating QR Code...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Amount header */}
      <Text style={styles.amount}>₹{amount}</Text>
      <Text style={styles.subtitle}>Scan to Pay</Text>

      {/* QR Code */}
      <View style={styles.qrCard}>
        <QRCode
          value={qrUrl}
          size={220}
          color="#000"
          backgroundColor="#fff"
        />
      </View>

      {/* Polling indicator */}
      {isPolling && (
        <View style={styles.pollingRow}>
          <ActivityIndicator size="small" color="#3b82f6" />
          <Text style={styles.pollingText}>Waiting for payment...</Text>
        </View>
      )}

      {/* Instructions */}
      <Text style={styles.hint}>
        Customer scans this QR with their phone camera{'\n'}
        Opens payment page in browser → Pays via UPI / Card
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
  },
  amount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#16a34a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
  },
  qrCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pollingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  pollingText: {
    fontSize: 13,
    color: '#3b82f6',
    fontWeight: '500',
  },
  hint: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 16,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
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
  successCard: {
    alignItems: 'center',
    padding: 24,
  },
  successIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#16a34a',
    marginBottom: 4,
  },
  successAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: '#16a34a',
  },
});

export default UpiQrView;
