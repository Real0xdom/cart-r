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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const react_native_modal_1 = require("react-native-modal");
const expo_router_1 = require("expo-router");
const CustomButton_1 = __importDefault(require("@/components/CustomButton"));
const constants_1 = require("@/constants");
const store_1 = require("@/store");
const AuthContext_1 = require("@/contexts/AuthContext");
const bookingUtils_1 = require("../lib/bookingUtils");
// Cashfree configuration
const CASHFREE_APP_ID = process.env.EXPO_PUBLIC_CASHFREE_APP_ID;
const CASHFREE_ENVIRONMENT = process.env.CASHFREE_ENVIRONMENT || 'sandbox';
const CashfreePayment = ({ amount, vehicleType, estimatedDistance, estimatedDuration, driverId, }) => {
    const { user, profile } = (0, AuthContext_1.useAuth)();
    const { userAddress, userLongitude, userLatitude, destinationLatitude, destinationAddress, destinationLongitude, } = (0, store_1.useLocationStore)();
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [success, setSuccess] = (0, react_1.useState)(false);
    const [bookingDetails, setBookingDetails] = (0, react_1.useState)(null);
    // Generate a unique key when the component mounts
    // This ensures that if the user presses the button multiple times (accidentally or retry),
    // we effectively reuse the SAME key for this specific payment session.
    // Ideally, if the user backs out and comes back, this recycles.
    const [idempotencyKey] = (0, react_1.useState)(() => `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const handleCashPayment = async () => {
        if (!(user === null || user === void 0 ? void 0 : user.id) || !userAddress || !destinationAddress) {
            react_native_1.Alert.alert("Error", "Missing booking information. Please try again.");
            return;
        }
        setLoading(true);
        try {
            // Create booking with cash payment method
            const { data: booking, error } = await (0, bookingUtils_1.createBooking)({
                customerId: user.id,
                originAddress: userAddress,
                originLatitude: userLatitude,
                originLongitude: userLongitude,
                destinationAddress: destinationAddress,
                destinationLatitude: destinationLatitude,
                destinationLongitude: destinationLongitude,
                vehicleType: vehicleType,
                estimatedDistance: estimatedDistance,
                estimatedDuration: estimatedDuration,
                idempotencyKey: idempotencyKey, // Pass the unique key
            });
            if (error || !booking) {
                throw new Error(error || "Failed to create booking");
            }
            setBookingDetails(booking);
            setSuccess(true);
        }
        catch (err) {
            console.error("Booking error:", err);
            react_native_1.Alert.alert("Booking Failed", err.message || "Something went wrong. Please try again.");
        }
        finally {
            setLoading(false);
        }
    };
    const handleOnlinePayment = async () => {
        if (!(user === null || user === void 0 ? void 0 : user.id) || !userAddress || !destinationAddress) {
            react_native_1.Alert.alert("Error", "Missing booking information. Please try again.");
            return;
        }
        setLoading(true);
        try {
            // First create the booking
            // Reuse the same idempotency key
            const { data: booking, error } = await (0, bookingUtils_1.createBooking)({
                customerId: user.id,
                originAddress: userAddress,
                originLatitude: userLatitude,
                originLongitude: userLongitude,
                destinationAddress: destinationAddress,
                destinationLatitude: destinationLatitude,
                destinationLongitude: destinationLongitude,
                vehicleType: vehicleType,
                estimatedDistance: estimatedDistance,
                estimatedDuration: estimatedDuration,
                idempotencyKey: idempotencyKey,
            });
            if (error || !booking) {
                throw new Error(error || "Failed to create booking");
            }
            // TODO: Integrate Cashfree SDK for online payment
            react_native_1.Alert.alert("Online Payment", "Cashfree integration coming soon. For now, your booking is placed with cash payment.", [
                {
                    text: "OK",
                    onPress: () => {
                        setBookingDetails(booking);
                        setSuccess(true);
                    },
                },
            ]);
        }
        catch (err) {
            console.error("Payment error:", err);
            react_native_1.Alert.alert("Payment Failed", err.message || "Something went wrong. Please try again.");
        }
        finally {
            setLoading(false);
        }
    };
    return (<>
      <react_native_1.View className="gap-3 mt-5">
        <CustomButton_1.default title={loading ? "Processing..." : `Pay Cash - ₹${amount}`} className="bg-green-500" onPress={handleCashPayment} disabled={loading}/>
        
        <CustomButton_1.default title={loading ? "Processing..." : `Pay Online - ₹${amount}`} className="bg-primary-500" onPress={handleOnlinePayment} disabled={loading}/>

        {loading && (<react_native_1.View className="items-center mt-3">
            <react_native_1.ActivityIndicator size="small" color="#FF9800"/>
            <react_native_1.Text className="text-gray-500 mt-2">Creating your booking...</react_native_1.Text>
          </react_native_1.View>)}
      </react_native_1.View>

      <react_native_modal_1.ReactNativeModal isVisible={success} onBackdropPress={() => setSuccess(false)}>
        <react_native_1.View className="flex flex-col items-center justify-center bg-white p-7 rounded-2xl">
          <react_native_1.Image source={constants_1.images.check} className="w-28 h-28 mt-5"/>

          <react_native_1.Text className="text-2xl text-center font-JakartaBold mt-5">
            Booking Confirmed! 🎉
          </react_native_1.Text>

          <react_native_1.Text className="text-md text-general-200 font-JakartaRegular text-center mt-3">
            Your ride has been booked successfully. A driver will be assigned shortly.
          </react_native_1.Text>

          {bookingDetails && (<react_native_1.View className="bg-gray-100 w-full p-4 rounded-xl mt-4">
              <react_native_1.Text className="text-sm text-gray-600">Booking Number:</react_native_1.Text>
              <react_native_1.Text className="text-lg font-JakartaBold text-primary-500">
                {bookingDetails.booking_number}
              </react_native_1.Text>
              
              <react_native_1.Text className="text-sm text-gray-600 mt-2">Pickup OTP:</react_native_1.Text>
              <react_native_1.Text className="text-2xl font-JakartaBold text-green-600">
                {bookingDetails.pickup_otp}
              </react_native_1.Text>
              <react_native_1.Text className="text-xs text-gray-500">
                Share this OTP with your driver to start the ride
              </react_native_1.Text>
            </react_native_1.View>)}

          <CustomButton_1.default title="Back Home" onPress={() => {
            setSuccess(false);
            expo_router_1.router.push("/(tabs)/home");
        }} className="mt-5"/>
        </react_native_1.View>
      </react_native_modal_1.ReactNativeModal>
    </>);
};
exports.default = CashfreePayment;
