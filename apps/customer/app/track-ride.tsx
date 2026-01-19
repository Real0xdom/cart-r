// Track Ride Screen
// Live tracking of driver location during shipment

import { useBookingStore, useLocationStore } from "@/store";
import { router, useLocalSearchParams } from "expo-router";
import { useState, useEffect, useRef } from "react";
import { 
  Text, 
  View, 
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from "react-native-maps";
import { subscribeToBooking, subscribeToDriverLocation, getBookingById, cancelBooking } from "@/lib/bookings";
import PaymentConfirmationModal from "@/components/PaymentConfirmationModal";
import CancelRideModal from "@/components/CancelRideModal";
import type { Booking } from "@/types/type";
import { useAuth } from "@/contexts/AuthContext";

const TrackRidePage = () => {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { currentBooking, setCurrentBooking } = useBookingStore();
  const { destinationAddress } = useLocationStore();

  const [booking, setBooking] = useState<Booking | null>(currentBooking);
  const [driverLocation, setDriverLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPaymentConfirmation, setShowPaymentConfirmation] = useState(false);
  const [completedBookingAmount, setCompletedBookingAmount] = useState(0);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const mapRef = useRef<MapView>(null);
  const { user } = useAuth();

  // Fetch booking and set up subscriptions
  useEffect(() => {
    if (!bookingId) {
      router.replace("/(tabs)/home");
      return;
    }

    // Fetch latest booking data
    getBookingById(bookingId).then(({ data }) => {
      if (data) {
        // If booking is still pending (finding driver), redirect back to waiting screen
        if (data.status === 'pending' || !data.driver_id) {
            router.replace({
              pathname: "/waiting-for-driver",
              params: { bookingId }
            });
            return;
        }

        setBooking(data);
        setCurrentBooking(data);
        setIsLoading(false);
      }
    });

    // Subscribe to booking status updates
    const unsubscribeBooking = subscribeToBooking(bookingId, (updatedBooking) => {
      setBooking(updatedBooking);
      setCurrentBooking(updatedBooking);

      // If completed, show payment confirmation modal first
      if (updatedBooking.status === 'completed') {
        setCompletedBookingAmount(updatedBooking.driver_payout || updatedBooking.total_fare);
        setShowPaymentConfirmation(true);
      } else if (updatedBooking.status === 'pending') {
        // Driver cancelled - redirect back to waiting screen to find new driver
        router.replace({
          pathname: "/waiting-for-driver",
          params: { bookingId }
        });
      } else if (updatedBooking.status === 'cancelled') {
        // Ride was cancelled (by customer or driver) - go back home
        Alert.alert(
          'Ride Cancelled',
          updatedBooking.cancellation_reason || 'This ride has been cancelled',
          [{ text: 'OK', onPress: () => router.replace("/(tabs)/home") }]
        );
      }
    });

    return () => unsubscribeBooking();
  }, [bookingId]);

  // Subscribe to driver location when we have driver info
  useEffect(() => {
    if (!booking?.driver_id) return;

    const unsubscribeLocation = subscribeToDriverLocation(
      booking.driver_id,
      setDriverLocation
    );

    return () => unsubscribeLocation();
  }, [booking?.driver_id]);

  // Fit map to show driver and destination
  useEffect(() => {
    if (driverLocation && booking && mapRef.current) {
      const isInProgress = booking.status === 'in_progress';
      const targetLat = isInProgress ? booking.destination_latitude : booking.origin_latitude;
      const targetLng = isInProgress ? booking.destination_longitude : booking.origin_longitude;
      
      mapRef.current.fitToCoordinates([
        driverLocation,
        { latitude: targetLat, longitude: targetLng }
      ], {
        edgePadding: { top: 80, right: 50, bottom: 400, left: 50 },
        animated: true
      });
    }
  }, [driverLocation, booking?.status]);

  // Call driver
  const handleCallDriver = () => {
    if (booking?.driver?.user?.phone) {
      Linking.openURL(`tel:${booking.driver.user.phone}`);
    }
  };

  // Handle ride cancellation
  const handleCancelRide = async (reason: string) => {
    if (!bookingId || !user?.id) return;

    setIsCancelling(true);
    try {
      const { success, error } = await cancelBooking(bookingId, user.id, reason);
      
      if (success) {
        setShowCancelModal(false);
        Alert.alert(
          'Ride Cancelled',
          'Your ride has been cancelled successfully.',
          [
            {
              text: 'OK',
              onPress: () => {
                setCurrentBooking(null);
                router.replace("/(tabs)/home");
              }
            }
          ]
        );
      } else {
        setIsCancelling(false);
        Alert.alert('Error', error || 'Failed to cancel ride');
      }
    } catch (err) {
      setIsCancelling(false);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  // Check if customer can cancel (only before driver arrives and enters OTP)
  const canCustomerCancel = booking?.status === 'accepted';

  // Get status message
  const getStatusMessage = () => {
    switch (booking?.status) {
      case 'accepted':
        return { text: 'Driver is on the way to pickup', color: 'bg-blue-500' };
      case 'driver_arrived':
        return { text: 'Driver has arrived at pickup', color: 'bg-yellow-500' };
      case 'in_progress':
        return { text: 'Shipment in progress', color: 'bg-green-500' };
      default:
        return { text: 'Tracking shipment...', color: 'bg-gray-500' };
    }
  };

  const status = getStatusMessage();
  const isInProgress = booking?.status === 'in_progress';

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#FF9800" />
        <Text className="mt-4 text-gray-500 font-JakartaMedium">Loading tracking...</Text>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-white">
      {/* Map with driver tracking */}
      <View className="absolute inset-0 h-[55%]">
        {booking ? (
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: booking.origin_latitude,
              longitude: booking.origin_longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
            showsUserLocation={false}
            showsMyLocationButton={false}
          >
            {/* Driver marker */}
            {driverLocation && (
              <Marker
                coordinate={driverLocation}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={{ backgroundColor: '#3b82f6', padding: 8, borderRadius: 20, borderWidth: 2, borderColor: 'white' }}>
                  <Text style={{ fontSize: 18 }}>🚗</Text>
                </View>
              </Marker>
            )}

            {/* Pickup marker */}
            <Marker
              coordinate={{
                latitude: booking.origin_latitude,
                longitude: booking.origin_longitude,
              }}
              title="Pickup"
              pinColor={isInProgress ? "gray" : "green"}
            />

            {/* Dropoff marker */}
            <Marker
              coordinate={{
                latitude: booking.destination_latitude,
                longitude: booking.destination_longitude,
              }}
              title="Drop-off"
              pinColor="red"
            />

            {/* Route line from driver to current target */}
            {driverLocation && (
              <Polyline
                coordinates={[
                  driverLocation,
                  {
                    latitude: isInProgress ? booking.destination_latitude : booking.origin_latitude,
                    longitude: isInProgress ? booking.destination_longitude : booking.origin_longitude
                  }
                ]}
                strokeColor={isInProgress ? "#ef4444" : "#22c55e"}
                strokeWidth={4}
                lineDashPattern={[10, 5]}
              />
            )}
          </MapView>
        ) : (
          <View className="flex-1 bg-gray-100 items-center justify-center">
            <ActivityIndicator size="large" color="#22c55e" />
          </View>
        )}
      </View>

      {/* Header */}
      <SafeAreaView className="z-10 bg-transparent pointer-events-box-none">
        <View className="flex-row items-center justify-between px-5 pt-2">
          <TouchableOpacity 
            onPress={() => router.back()}
            className="w-12 h-12 bg-white rounded-full items-center justify-center shadow-sm"
          >
            <Feather name="chevron-left" size={24} color="black" />
          </TouchableOpacity>
          <Text className="text-xl font-JakartaBold text-black">Track Shipment</Text>
          <TouchableOpacity 
            className="w-12 h-12 bg-white rounded-full items-center justify-center shadow-sm"
          >
            <Feather name="more-vertical" size={24} color="black" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Bottom Sheet */}
      <View className="absolute bottom-0 w-full bg-white rounded-t-[32px] shadow-lg h-[50%]">
        <ScrollView 
          className="pt-6 pb-8 px-6"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          {/* Status Badge */}
          <View className="items-center mb-4">
            <View className={`${status.color} px-4 py-2 rounded-full`}>
              <Text className="text-white font-JakartaSemiBold">{status.text}</Text>
            </View>
          </View>

          {/* Driver Info */}
          {booking?.driver && (
            <View className="bg-gray-50 rounded-2xl p-4 mb-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View className="w-14 h-14 bg-gray-200 rounded-full items-center justify-center mr-3">
                    <Feather name="user" size={24} color="#666" />
                  </View>
                  <View>
                    <Text className="text-lg font-JakartaBold text-gray-800">
                      {booking.driver.user?.name || 'Driver'}
                    </Text>
                    <View className="flex-row items-center">
                      <Text className="text-gray-500 text-sm font-JakartaMedium mr-2">
                        {booking.driver.vehicle_number}
                      </Text>
                      <Feather name="star" size={12} color="#f59e0b" />
                      <Text className="text-gray-500 text-sm ml-1">
                        {booking.driver.rating}
                      </Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity 
                  onPress={handleCallDriver}
                  className="w-12 h-12 bg-green-500 rounded-full items-center justify-center"
                >
                  <Feather name="phone" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Trip Info */}
          <View className="bg-gray-50 rounded-2xl p-4 mb-4">
            <View className="flex-row justify-between mb-3">
              <View>
                <Text className="text-xs text-gray-500 font-JakartaMedium">DROP LOCATION</Text>
                <Text className="text-sm font-JakartaSemiBold text-gray-800" numberOfLines={1}>
                  {destinationAddress || booking?.destination_address}
                </Text>
              </View>
            </View>

            <View className="h-px bg-gray-200 my-2" />

            <View className="flex-row justify-between">
              <View className="items-center flex-1">
                <Text className="text-xs text-gray-500">Receiver</Text>
                <Text className="text-sm font-JakartaSemiBold text-gray-800">
                  {booking?.receiver_name}
                </Text>
              </View>
              
              {/* Show Pickup OTP before trip starts, Delivery OTP during/after trip */}
              {booking?.status === 'in_progress' || booking?.status === 'completed' ? (
                <View className="items-center flex-1">
                  <Text className="text-xs text-gray-500">Delivery OTP</Text>
                  <Text className="text-lg font-JakartaBold text-orange-600">
                    {booking?.delivery_otp || '------'}
                  </Text>
                  <Text className="text-[10px] text-gray-400 mt-1">Share with Driver to Receive</Text>
                </View>
              ) : (
                <View className="items-center flex-1">
                  <Text className="text-xs text-gray-500">Pickup OTP</Text>
                  <Text className="text-lg font-JakartaBold text-blue-600">
                    {booking?.pickup_otp}
                  </Text>
                  <Text className="text-[10px] text-gray-400 mt-1">Give to driver</Text>
                </View>
              )}
              
              <View className="items-center flex-1">
                <Text className="text-xs text-gray-500">Fare</Text>
                <Text className="text-sm font-JakartaBold text-green-600">
                  ₹{booking?.driver_payout || booking?.total_fare}
                </Text>
              </View>
            </View>

            {/* Payment Request Banner */}
            {/* Note: In a real app we'd add a 'payment_requested_at' field or similar logic. 
                For now we rely on status='in_progress' and user check manually via push notification, 
                or we can add a persistent button here if not paid. */}
            {booking?.status === 'in_progress' && booking?.payment_status !== 'paid' && (
               <TouchableOpacity
                  onPress={() => router.push({ pathname: "/pay-booking", params: { bookingId: booking.id } })}
                  className="mt-4 bg-primary-100 p-3 rounded-lg flex-row items-center justify-between"
               >
                  <View className="flex-row items-center">
                      <Feather name="credit-card" size={18} color="#FF9800" />
                      <Text className="ml-2 text-primary-600 font-JakartaSemiBold">Pay Online</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#FF9800" />
               </TouchableOpacity>
            )}

            {booking?.payment_status === 'paid' && (
               <View className="mt-4 bg-green-100 p-2 rounded-lg items-center">
                  <Text className="text-green-700 font-JakartaBold text-xs">PAYMENT COMPLETE</Text>
               </View>
            )}

          </View>

          {/* Cancel Ride Button - Only show before driver arrives */}
          {canCustomerCancel && (
            <TouchableOpacity 
              onPress={() => setShowCancelModal(true)}
              className="bg-gray-100 py-4 rounded-xl flex-row items-center justify-center mb-3"
            >
              <Feather name="x-circle" size={20} color="#ef4444" />
              <Text className="ml-2 text-red-500 font-JakartaBold">Cancel Ride</Text>
            </TouchableOpacity>
          )}

          {/* SOS Button */}
          <TouchableOpacity 
            onPress={() => {
              Alert.alert(
                "Emergency SOS", 
                "Are you sure you want to call emergency services?",
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Call 112", style: "destructive", onPress: () => Linking.openURL('tel:112') }
                ]
              );
            }}
            className="bg-red-500 py-4 rounded-xl flex-row items-center justify-center"
          >
            <Feather name="alert-triangle" size={20} color="#fff" />
            <Text className="ml-2 text-white font-JakartaBold">Emergency SOS</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Payment Confirmation Modal - shown after trip completion */}
      <PaymentConfirmationModal
        visible={showPaymentConfirmation}
        bookingId={bookingId || ''}
        amount={completedBookingAmount}
        onConfirm={() => {
          setShowPaymentConfirmation(false);
          router.replace("/(tabs)/home");
        }}
        onSkip={() => {
          setShowPaymentConfirmation(false);
          router.replace("/(tabs)/home");
        }}
      />

      {/* Cancel Ride Modal */}
      <CancelRideModal
        visible={showCancelModal}
        isLoading={isCancelling}
        onCancel={() => setShowCancelModal(false)}
        onConfirm={handleCancelRide}
      />
    </View>
  );
};

export default TrackRidePage;
