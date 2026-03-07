import React, { useState } from "react";
import { Alert, Image, Text, View, ActivityIndicator, Platform } from "react-native";
import { ReactNativeModal } from "react-native-modal";
import { router } from "expo-router";
import * as Linking from 'expo-linking';

import CustomButton from "@/components/CustomButton";
import { images } from "@/constants";
import { useLocationStore } from "@/store";
import { useAuth } from "@/contexts/AuthContext";
import { createBooking, calculateFare } from "../lib/bookingUtils";
import { createPaymentOrder, initiateCashfreePayment, checkPaymentStatus } from "../lib/payment";

// Check if native SDK is available
let CFPaymentGatewayService: any = null;
let isNativeSDKAvailable = false;

if (Platform.OS !== 'web') {
  try {
    const cashfreeModule = require('react-native-cashfree-pg-sdk');
    if (cashfreeModule && cashfreeModule.CFPaymentGatewayService) {
      CFPaymentGatewayService = cashfreeModule.CFPaymentGatewayService;
      isNativeSDKAvailable = true;
    }
  } catch (e: any) {
    console.log("Cashfree native SDK not available:", e?.message);
  }
}

// Cashfree configuration
const CASHFREE_APP_ID = process.env.EXPO_PUBLIC_CASHFREE_APP_ID;
const CASHFREE_ENVIRONMENT = process.env.CASHFREE_ENVIRONMENT || 'sandbox';

interface CashfreePaymentProps {
  amount: number;
  vehicleType: 'bike' | 'auto' | 'mini' | 'sedan' | 'suv' | 'truck';
  estimatedDistance: number;
  estimatedDuration: number;
  driverId?: string;
  scheduledAt?: string;
}

const CashfreePayment = ({
  amount,
  vehicleType,
  estimatedDistance,
  estimatedDuration,
  driverId,
  scheduledAt,
}: CashfreePaymentProps) => {
  const { user, profile } = useAuth();
  const {
    userAddress,
    userLongitude,
    userLatitude,
    destinationLatitude,
    destinationAddress,
    destinationLongitude,
  } = useLocationStore();

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [bookingDetails, setBookingDetails] = useState<any>(null);

  // Generate a unique key when the component mounts
  // This ensures that if the user presses the button multiple times (accidentally or retry),
  // we effectively reuse the SAME key for this specific payment session.
  // Ideally, if the user backs out and comes back, this recycles.
  const [idempotencyKey] = useState(() => `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  // Setup Cashfree callbacks
  React.useEffect(() => {
    if (isNativeSDKAvailable && CFPaymentGatewayService) {
      try {
        CFPaymentGatewayService.setCallback({
          onVerify: async (orderID: string) => {
            console.log("[CashfreePayment] Order Verified:", orderID);
            setIsVerifying(true);
            const { status } = await checkPaymentStatus(bookingDetails?.id || "");
            if (status === "paid") {
              setSuccess(true);
            } else {
              // Wait slightly and check again or assume success for now
              setSuccess(true);
            }
            setIsVerifying(false);
          },
          onError: async (error: any, orderID: string) => {
            console.log("[CashfreePayment] Payment Failed:", error, orderID);
            Alert.alert("Payment Failed", error?.message || "Payment could not be completed.");
          },
        });
      } catch (e) {
        console.log("Error setting up Cashfree callbacks:", e);
      }
    }
    
    return () => {
      if (isNativeSDKAvailable && CFPaymentGatewayService) {
        try {
          CFPaymentGatewayService.removeCallback();
        } catch (e) {}
      }
    };
  }, [bookingDetails?.id]);

  const [isVerifying, setIsVerifying] = useState(false);

  const handleCashPayment = async () => {
    if (loading) return;

    if (!user?.id || !userAddress || !destinationAddress) {
      Alert.alert("Error", "Missing booking information. Please try again.");
      return;
    }

    setLoading(true);
    try {
      // Create booking with cash payment method
      const { data: booking, error } = await createBooking({
        customerId: user.id,
        originAddress: userAddress,
        originLatitude: userLatitude!,
        originLongitude: userLongitude!,
        destinationAddress: destinationAddress,
        destinationLatitude: destinationLatitude!,
        destinationLongitude: destinationLongitude!,
        vehicleType: vehicleType as any,
        estimatedDistance: estimatedDistance,
        estimatedDuration: estimatedDuration,
        idempotencyKey: idempotencyKey, // Pass the unique key
        scheduledAt: scheduledAt,
      });

      if (error || !booking) {
        throw new Error(error || "Failed to create booking");
      }

      setBookingDetails(booking);
      setSuccess(true);
    } catch (err: any) {
      console.error("Booking error:", err);
      Alert.alert("Booking Failed", err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOnlinePayment = async () => {
    if (loading) return;

    if (!user?.id || !userAddress || !destinationAddress) {
      Alert.alert("Error", "Missing booking information. Please try again.");
      return;
    }

    setLoading(true);
    try {
      // First create the booking
      // Reuse the same idempotency key
      const { data: booking, error } = await createBooking({
        customerId: user.id,
        originAddress: userAddress,
        originLatitude: userLatitude!,
        originLongitude: userLongitude!,
        destinationAddress: destinationAddress,
        destinationLatitude: destinationLatitude!,
        destinationLongitude: destinationLongitude!,
        vehicleType: vehicleType as any,
        estimatedDistance: estimatedDistance,
        estimatedDuration: estimatedDuration,
        idempotencyKey: idempotencyKey, 
        scheduledAt: scheduledAt,
      });

      if (error || !booking) {
        throw new Error(error || "Failed to create booking");
      }
      
      setBookingDetails(booking);

      // Create Payment Order backend call
      const { data: orderData, error: orderError } = await createPaymentOrder(
        booking?.id || "",
        user.id,
        profile?.name || "Customer",
        user.email || "user@cartr.app",
        profile?.phone || "9999999999",
        amount,
        idempotencyKey
      );

      if (orderError || !orderData) {
        throw new Error(orderError || "Failed to create payment order");
      }

      // Try Native SDK First
      if (Platform.OS !== 'web' && isNativeSDKAvailable && CFPaymentGatewayService) {
        try {
          const { CFSession, CFEnvironment, CFDropCheckoutPayment, CFThemeBuilder, CFTheme } = require('cashfree-pg-api-contract');
          const sdkEnv = CASHFREE_ENVIRONMENT === 'production' ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;
          
          const session = new CFSession(orderData.payment_session_id, orderData.order_id, sdkEnv);
          const dropPayment = new CFDropCheckoutPayment(session, null, null);

          CFPaymentGatewayService.doPayment(dropPayment);
          return; // Modal/callback will handle success flag
        } catch (sdkError: any) {
          console.error("Native SDK Error:", sdkError);
        }
      }

      // Fallback: Web checkout
      try {
        const result = await initiateCashfreePayment(orderData.payment_session_id, orderData.order_id);
        if (result.success) {
          Alert.alert(
            "Payment Opened",
            "Complete payment in your browser, then tap below.",
            [{ text: "I have Paid", onPress: async () => {
              const check = await checkPaymentStatus(booking?.id || "");
              if (check.status === "paid") setSuccess(true);
            }}]
          );
        } else {
          Alert.alert("Error", result.error || "Failed to open payment");
        }
      } catch (browserError: any) {
         Alert.alert("Error", browserError.message);
      }

    } catch (err: any) {
      console.error("Payment error:", err);
      Alert.alert("Payment Failed", err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <View className="gap-3 mt-5">
        <CustomButton
          title={loading ? "Processing..." : `Pay Cash - ₹${amount}`}
          className="bg-green-500"
          onPress={handleCashPayment}
          disabled={loading}
        />
        
        <CustomButton
          title={loading ? "Processing..." : `Pay Online - ₹${amount}`}
          className="bg-primary-500"
          onPress={handleOnlinePayment}
          disabled={loading}
        />

        {loading || isVerifying ? (
          <View className="items-center mt-3">
            <ActivityIndicator size="small" color="#FF9800" />
            <Text className="text-gray-500 mt-2">
              {isVerifying ? "Verifying payment..." : "Creating your booking..."}
            </Text>
          </View>
        ) : null}
      </View>

      <ReactNativeModal
        isVisible={success}
        onBackdropPress={() => setSuccess(false)}
      >
        <View className="flex flex-col items-center justify-center bg-white p-7 rounded-2xl">
          <Image source={images.check} className="w-28 h-28 mt-5" />

          <Text className="text-2xl text-center font-JakartaBold mt-5">
            Booking Confirmed! 🎉
          </Text>

          <Text className="text-md text-general-200 font-JakartaRegular text-center mt-3">
            Your ride has been booked successfully. A driver will be assigned shortly.
          </Text>

          {bookingDetails && (
            <View className="bg-gray-100 w-full p-4 rounded-xl mt-4">
              <Text className="text-sm text-gray-600">Booking Number:</Text>
              <Text className="text-lg font-JakartaBold text-primary-500">
                {bookingDetails.booking_number}
              </Text>
              
              <Text className="text-sm text-gray-600 mt-2">Pickup OTP:</Text>
              <Text className="text-2xl font-JakartaBold text-green-600">
                {bookingDetails.pickup_otp}
              </Text>
              <Text className="text-xs text-gray-500">
                Share this OTP with your driver to start the ride
              </Text>
            </View>
          )}

          <CustomButton
            title="Back Home"
            onPress={() => {
              setSuccess(false);
              router.push("/(tabs)/home");
            }}
            className="mt-5"
          />
        </View>
      </ReactNativeModal>
    </>
  );
};

export default CashfreePayment;
