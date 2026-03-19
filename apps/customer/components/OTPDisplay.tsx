// OTP Display Component for Customer App
// Shows the OTP that customer must share with driver at pickup
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

interface OTPDisplayProps {
  otpCode: string;
  driverName?: string;
  status: 'waiting' | 'driver_arrived' | 'verified';
}

const OTPDisplay: React.FC<OTPDisplayProps> = ({ otpCode, driverName, status }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    // Entry animation
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();

    // Pulse animation when driver arrived
    if (status === 'driver_arrived') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [status]);

  const getStatusMessage = () => {
    switch (status) {
      case 'waiting':
        return `${driverName || 'Driver'} is on the way`;
      case 'driver_arrived':
        return 'Driver has arrived! Share this OTP';
      case 'verified':
        return '✓ OTP Verified - Trip Starting';
      default:
        return '';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'waiting':
        return '#3b82f6';
      case 'driver_arrived':
        return '#22c55e';
      case 'verified':
        return '#10b981';
      default:
        return '#6b7280';
    }
  };

  return (
    <Animated.View 
      style={[
        styles.container, 
        { transform: [{ scale: scaleAnim }] },
        status === 'driver_arrived' && { transform: [{ scale: pulseAnim }] }
      ]}
    >
      {/* Status Indicator */}
      <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
        <Text style={styles.statusText}>{getStatusMessage()}</Text>
      </View>

      {/* OTP Display */}
      <View style={styles.otpContainer}>
        <Text style={styles.otpLabel}>Your Pickup OTP</Text>
        <View style={styles.otpDigits}>
          {otpCode.split('').map((digit, index) => (
            <View key={index} style={styles.digitBox}>
              <Text style={styles.digit}>{digit}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Instructions */}
      {status !== 'verified' && (
        <View style={styles.instructions}>
          <Text style={styles.instructionText}>
            🔒 Share this code with your driver to start the trip
          </Text>
          <Text style={styles.warningText}>
            Do NOT share before verifying the driver and vehicle
          </Text>
        </View>
      )}

      {status === 'verified' && (
        <View style={styles.verifiedContainer}>
          <Text style={styles.verifiedEmoji}>✅</Text>
          <Text style={styles.verifiedText}>Trip is starting...</Text>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 20,
  },
  statusText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  otpContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  otpLabel: {
    color: '#6b7280',
    fontSize: 14,
    marginBottom: 12,
  },
  otpDigits: {
    flexDirection: 'row',
    gap: 12,
  },
  digitBox: {
    width: 56,
    height: 64,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  digit: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1f2937',
  },
  instructions: {
    backgroundColor: '#fef3c7',
    padding: 16,
    borderRadius: 12,
  },
  instructionText: {
    color: '#92400e',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  warningText: {
    color: '#b45309',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  verifiedContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  verifiedEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  verifiedText: {
    color: '#059669',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default OTPDisplay;
