// OTP Verification Component for Pickup
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, Animated } from 'react-native';

interface OTPVerificationProps {
  otpCode: string; // The correct OTP to verify against
  onVerified: () => void;
  onCancel?: () => void;
  customerName?: string;
}

const OTPVerification: React.FC<OTPVerificationProps> = ({
  otpCode,
  onVerified,
  onCancel,
  customerName,
}) => {
  const [otp, setOtp] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Focus first input on mount
  useEffect(() => {
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 100);
  }, []);

  const handleOtpChange = (value: string, index: number) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, '').slice(0, 4).split('');
      const newOtp = [...otp];
      digits.forEach((digit, i) => {
        if (index + i < 4) {
          newOtp[index + i] = digit;
        }
      });
      setOtp(newOtp);
      setError('');
      
      // Focus last filled input
      const lastFilledIndex = Math.min(index + digits.length - 1, 3);
      inputRefs.current[lastFilledIndex]?.focus();
      
      // Auto-verify if all filled
      if (newOtp.every(d => d !== '')) {
        verifyOtp(newOtp.join(''));
      }
      return;
    }

    // Handle single digit
    const newOtp = [...otp];
    newOtp[index] = value.replace(/\D/g, '');
    setOtp(newOtp);
    setError('');

    // Auto-focus next input
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify if all filled
    if (newOtp.every(d => d !== '')) {
      verifyOtp(newOtp.join(''));
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const verifyOtp = (enteredOtp: string) => {
    if (enteredOtp === otpCode) {
      onVerified();
    } else {
      setError('Incorrect OTP. Please try again.');
      setAttempts(prev => prev + 1);
      
      // Shake animation
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();

      // Clear OTP after shake
      setTimeout(() => {
        setOtp(['', '', '', '']);
        inputRefs.current[0]?.focus();
      }, 300);

      if (attempts >= 2) {
        Alert.alert(
          'Multiple Failed Attempts',
          'Please ensure you are entering the correct OTP shown to the customer.',
          [{ text: 'OK' }]
        );
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🔐 Verify Pickup OTP</Text>
        <Text style={styles.subtitle}>
          Ask {customerName || 'the customer'} for the 4-digit code
        </Text>
      </View>

      <Animated.View style={[styles.otpContainer, { transform: [{ translateX: shakeAnim }] }]}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => (inputRefs.current[index] = ref)}
            style={[
              styles.otpInput,
              digit ? styles.otpInputFilled : null,
              error ? styles.otpInputError : null,
            ]}
            value={digit}
            onChangeText={(value) => handleOtpChange(value, index)}
            onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
            keyboardType="number-pad"
            maxLength={4}
            selectTextOnFocus
          />
        ))}
      </Animated.View>

      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          💡 The OTP is displayed on the customer's app.{'\n'}
          Verify it before starting the trip.
        </Text>
      </View>

      {onCancel && (
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel Pickup</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1f2937',
    padding: 24,
    borderRadius: 24,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  otpInput: {
    width: 56,
    height: 64,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#374151',
    backgroundColor: '#111827',
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  otpInputFilled: {
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  otpInputError: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginBottom: 16,
  },
  infoBox: {
    backgroundColor: '#374151',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  infoText: {
    color: '#9ca3af',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  cancelButton: {
    marginTop: 20,
    padding: 12,
  },
  cancelText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default OTPVerification;
