// UPI QR View Component
// Renders a native QR code for the Cashfree UPI payload / intent.
// Customer scans with their phone camera -> UPI app opens with amount prefilled.
// Payment confirmation comes via Cashfree webhook -> updates booking -> real-time subscription picks it up.

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

let QRCode: any = null;
try {
  QRCode = require("react-native-qrcode-svg").default;
} catch (e) {
  console.log("[UpiQrView] QRCode library not available:", e);
}

interface UpiQrViewProps {
  qrValue: string;
  amount: number;
  isPaid?: boolean;
  isPolling?: boolean;
  channel?: string | null;
}

const UpiQrView: React.FC<UpiQrViewProps> = ({
  qrValue,
  amount,
  isPaid = false,
  isPolling = false,
  channel,
}) => {
  if (isPaid) {
    return (
      <View style={styles.container}>
        <View style={styles.successCard}>
          <Ionicons
            name="checkmark-circle"
            size={48}
            color="#16a34a"
            style={styles.successIcon}
          />
          <Text style={styles.successTitle}>Payment Received!</Text>
          <Text style={styles.successAmount}>Rs {amount}</Text>
        </View>
      </View>
    );
  }

  if (!QRCode) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>
          QR code library not available. Please restart the app.
        </Text>
      </View>
    );
  }

  if (!qrValue) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={styles.loadingText}>Generating QR Code...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.amount}>Rs {amount}</Text>
      <Text style={styles.subtitle}>Scan to Pay</Text>
      {!!channel && <Text style={styles.channel}>Cashfree {channel}</Text>}

      <View style={styles.qrCard}>
        <QRCode value={qrValue} size={220} color="#000" backgroundColor="#fff" />
      </View>

      {isPolling && (
        <View style={styles.pollingRow}>
          <ActivityIndicator size="small" color="#3b82f6" />
          <Text style={styles.pollingText}>Waiting for payment...</Text>
        </View>
      )}

      <Text style={styles.hint}>
        Customer scans this QR with any camera or scanner{"\n"}
        Their UPI app should open with the payable amount already filled in
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 16,
    backgroundColor: "#f8fafc",
    borderRadius: 16,
  },
  amount: {
    fontSize: 28,
    fontWeight: "800",
    color: "#16a34a",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 8,
  },
  channel: {
    fontSize: 12,
    color: "#3b82f6",
    fontWeight: "600",
    marginBottom: 12,
  },
  qrCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  pollingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    gap: 8,
  },
  pollingText: {
    fontSize: 13,
    color: "#3b82f6",
    fontWeight: "500",
  },
  hint: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 16,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  loadingText: {
    marginTop: 8,
    color: "#6b7280",
    fontSize: 14,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 14,
    textAlign: "center",
    padding: 20,
  },
  successCard: {
    alignItems: "center",
    padding: 24,
  },
  successIcon: {
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#16a34a",
    marginBottom: 4,
  },
  successAmount: {
    fontSize: 24,
    fontWeight: "800",
    color: "#16a34a",
  },
});

export default UpiQrView;
