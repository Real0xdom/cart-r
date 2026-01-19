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
// OTP Verification Component for Pickup
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const OTPVerification = ({ otpCode, onVerified, onCancel, customerName, }) => {
    const [otp, setOtp] = (0, react_1.useState)(['', '', '', '']);
    const [error, setError] = (0, react_1.useState)('');
    const [attempts, setAttempts] = (0, react_1.useState)(0);
    const inputRefs = (0, react_1.useRef)([]);
    const shakeAnim = (0, react_1.useRef)(new react_native_1.Animated.Value(0)).current;
    // Focus first input on mount
    (0, react_1.useEffect)(() => {
        setTimeout(() => {
            var _a;
            (_a = inputRefs.current[0]) === null || _a === void 0 ? void 0 : _a.focus();
        }, 100);
    }, []);
    const handleOtpChange = (value, index) => {
        var _a, _b;
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
            (_a = inputRefs.current[lastFilledIndex]) === null || _a === void 0 ? void 0 : _a.focus();
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
            (_b = inputRefs.current[index + 1]) === null || _b === void 0 ? void 0 : _b.focus();
        }
        // Auto-verify if all filled
        if (newOtp.every(d => d !== '')) {
            verifyOtp(newOtp.join(''));
        }
    };
    const handleKeyPress = (key, index) => {
        var _a;
        if (key === 'Backspace' && !otp[index] && index > 0) {
            (_a = inputRefs.current[index - 1]) === null || _a === void 0 ? void 0 : _a.focus();
        }
    };
    const verifyOtp = (enteredOtp) => {
        if (enteredOtp === otpCode) {
            onVerified();
        }
        else {
            setError('Incorrect OTP. Please try again.');
            setAttempts(prev => prev + 1);
            // Shake animation
            react_native_1.Animated.sequence([
                react_native_1.Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
                react_native_1.Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
                react_native_1.Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
                react_native_1.Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
            ]).start();
            // Clear OTP after shake
            setTimeout(() => {
                var _a;
                setOtp(['', '', '', '']);
                (_a = inputRefs.current[0]) === null || _a === void 0 ? void 0 : _a.focus();
            }, 300);
            if (attempts >= 2) {
                react_native_1.Alert.alert('Multiple Failed Attempts', 'Please ensure you are entering the correct OTP shown to the customer.', [{ text: 'OK' }]);
            }
        }
    };
    return (<react_native_1.View style={styles.container}>
      <react_native_1.View style={styles.header}>
        <react_native_1.Text style={styles.title}>🔐 Verify Pickup OTP</react_native_1.Text>
        <react_native_1.Text style={styles.subtitle}>
          Ask {customerName || 'the customer'} for the 4-digit code
        </react_native_1.Text>
      </react_native_1.View>

      <react_native_1.Animated.View style={[styles.otpContainer, { transform: [{ translateX: shakeAnim }] }]}>
        {otp.map((digit, index) => (<react_native_1.TextInput key={index} ref={(ref) => (inputRefs.current[index] = ref)} style={[
                styles.otpInput,
                digit ? styles.otpInputFilled : null,
                error ? styles.otpInputError : null,
            ]} value={digit} onChangeText={(value) => handleOtpChange(value, index)} onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)} keyboardType="number-pad" maxLength={4} selectTextOnFocus/>))}
      </react_native_1.Animated.View>

      {error && (<react_native_1.Text style={styles.errorText}>{error}</react_native_1.Text>)}

      <react_native_1.View style={styles.infoBox}>
        <react_native_1.Text style={styles.infoText}>
          💡 The OTP is displayed on the customer's app.{'\n'}
          Verify it before starting the trip.
        </react_native_1.Text>
      </react_native_1.View>

      {onCancel && (<react_native_1.TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <react_native_1.Text style={styles.cancelText}>Cancel Pickup</react_native_1.Text>
        </react_native_1.TouchableOpacity>)}
    </react_native_1.View>);
};
const styles = react_native_1.StyleSheet.create({
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
exports.default = OTPVerification;
