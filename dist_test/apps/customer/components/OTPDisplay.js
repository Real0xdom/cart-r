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
// OTP Display Component for Customer App
// Shows the OTP that customer must share with driver at pickup
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const OTPDisplay = ({ otpCode, driverName, status }) => {
    const pulseAnim = (0, react_1.useRef)(new react_native_1.Animated.Value(1)).current;
    const scaleAnim = (0, react_1.useRef)(new react_native_1.Animated.Value(0.9)).current;
    (0, react_1.useEffect)(() => {
        // Entry animation
        react_native_1.Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
        }).start();
        // Pulse animation when driver arrived
        if (status === 'driver_arrived') {
            const pulse = react_native_1.Animated.loop(react_native_1.Animated.sequence([
                react_native_1.Animated.timing(pulseAnim, {
                    toValue: 1.05,
                    duration: 800,
                    useNativeDriver: true,
                }),
                react_native_1.Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ]));
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
    return (<react_native_1.Animated.View style={[
            styles.container,
            { transform: [{ scale: scaleAnim }] },
            status === 'driver_arrived' && { transform: [{ scale: pulseAnim }] }
        ]}>
      {/* Status Indicator */}
      <react_native_1.View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
        <react_native_1.Text style={styles.statusText}>{getStatusMessage()}</react_native_1.Text>
      </react_native_1.View>

      {/* OTP Display */}
      <react_native_1.View style={styles.otpContainer}>
        <react_native_1.Text style={styles.otpLabel}>Your Pickup OTP</react_native_1.Text>
        <react_native_1.View style={styles.otpDigits}>
          {otpCode.split('').map((digit, index) => (<react_native_1.View key={index} style={styles.digitBox}>
              <react_native_1.Text style={styles.digit}>{digit}</react_native_1.Text>
            </react_native_1.View>))}
        </react_native_1.View>
      </react_native_1.View>

      {/* Instructions */}
      {status !== 'verified' && (<react_native_1.View style={styles.instructions}>
          <react_native_1.Text style={styles.instructionText}>
            🔒 Share this code with your driver to start the trip
          </react_native_1.Text>
          <react_native_1.Text style={styles.warningText}>
            Do NOT share before verifying the driver and vehicle
          </react_native_1.Text>
        </react_native_1.View>)}

      {status === 'verified' && (<react_native_1.View style={styles.verifiedContainer}>
          <react_native_1.Text style={styles.verifiedEmoji}>✅</react_native_1.Text>
          <react_native_1.Text style={styles.verifiedText}>Trip is starting...</react_native_1.Text>
        </react_native_1.View>)}
    </react_native_1.Animated.View>);
};
const styles = react_native_1.StyleSheet.create({
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
exports.default = OTPDisplay;
