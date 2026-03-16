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
  Animated,
  Image
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, MaterialIcons } from "@expo/vector-icons";
import MapView, { Marker, Polyline, UrlTile } from "react-native-maps";
import OlaMapViewDirections from '@/components/OlaMapViewDirections';
import { subscribeToBooking, subscribeToDriverLocation, getBookingById, cancelBooking } from "@/lib/bookings";
import PaymentConfirmationModal from "@/components/PaymentConfirmationModal";
import CancelRideModal from "@/components/CancelRideModal";
import { WaitingTimer } from "@/components/WaitingTimer";
import { getActiveVehicleTypes, getVehicleImageSource, VehicleType } from "@/lib/vehicleTypes";
import type { Booking } from "@/types/type";
import { saveRoute, saveAddress } from "@/lib/savedPlaces";
import { useAuth } from "@/contexts/AuthContext";
import { useAnimatedLocation } from "@/lib/mapAnimation";
import { icons, images } from "@/constants";

const olaMapsApiKey = process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY;

const TrackRidePage = () => {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { currentBooking, setCurrentBooking } = useBookingStore();
  const { destinationAddress } = useLocationStore();

  const [booking, setBooking] = useState<Booking | null>(
    currentBooking?.id === bookingId ? currentBooking : null
  );
  const [driverLocation, setDriverLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPaymentConfirmation, setShowPaymentConfirmation] = useState(false);
  const [completedBookingAmount, setCompletedBookingAmount] = useState(0);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [vehicleSpecs, setVehicleSpecs] = useState<VehicleType[]>([]);
  const mapRef = useRef<MapView>(null);
  const { user } = useAuth();
  const [isNavigating, setIsNavigating] = useState(false);
  const [isSavingRoute, setIsSavingRoute] = useState(false);

  const { animatedCoordinate, heading } = useAnimatedLocation(driverLocation);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const handleSaveRoute = async () => {
    if (!booking) return;

    setIsSavingRoute(true);
    // Use a default name since Alert.prompt is unreliable on Android
    const defaultName = `${booking.origin_address.split(',')[0]} to ${booking.destination_address.split(',')[0]}`;
    
    const { data: routeData, error: routeError } = await saveRoute({
      name: defaultName,
      origin_address: booking.origin_address,
      origin_latitude: booking.origin_latitude,
      origin_longitude: booking.origin_longitude,
      destination_address: booking.destination_address,
      destination_latitude: booking.destination_latitude,
      destination_longitude: booking.destination_longitude,
    });

    if (routeError) {
      console.error('Error saving route:', routeError);
      Alert.alert("Error", "Failed to save route");
      setIsSavingRoute(false);
      return;
    }

    // Also save the pickup and drop addresses individually as requested
    await saveAddress({
      label: booking.origin_address.split(',')[0],
      address: booking.origin_address,
      latitude: booking.origin_latitude,
      longitude: booking.origin_longitude,
      icon_type: 'location-outline'
    });

    await saveAddress({
      label: booking.destination_address.split(',')[0],
      address: booking.destination_address,
      latitude: booking.destination_latitude,
      longitude: booking.destination_longitude,
      icon_type: 'location-outline'
    });

    setIsSavingRoute(false);
    Alert.alert("Success", "Route and addresses saved to your favorites!");
  };

  // Fetch vehicle specifications
  useEffect(() => {
    const fetchVehicleSpecs = async () => {
      const { data } = await getActiveVehicleTypes();
      if (data) setVehicleSpecs(data);
    };
    fetchVehicleSpecs();
  }, []);

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
        
        // Set initial driver location if available
        // Set initial driver location if available
        if ((data.driver as any)?.current_latitude && (data.driver as any)?.current_longitude) {
          console.log('[TRACK-RIDE] Setting initial driver location:', {
            lat: (data.driver as any).current_latitude,
            lng: (data.driver as any).current_longitude
          });
          setDriverLocation({
            latitude: parseFloat((data.driver as any).current_latitude),
            longitude: parseFloat((data.driver as any).current_longitude),
          });
        } else {
          console.log('[TRACK-RIDE] No driver location in booking data');
        }
        
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
      } else if (updatedBooking.status === 'in_progress' && updatedBooking.delivery_otp) {
        // Show delivery OTP in sheet (previous behavior) - stay on track-ride
        console.log('[TRACK-RIDE] Delivery OTP generated:', updatedBooking.delivery_otp);
        // OTP now prominently displayed in bottom sheet - no navigation needed
      }
    });

    return () => unsubscribeBooking();
  }, [bookingId]);

  // Subscribe to driver location when we have driver info
  useEffect(() => {
    if (!booking?.driver_id) {
      console.log('[TRACK-RIDE] No driver_id, skipping location subscription');
      return;
    }

    console.log('[TRACK-RIDE] Subscribing to driver location for driver_id:', booking.driver_id);
    
    const unsubscribeLocation = subscribeToDriverLocation(
      booking.driver_id,
      (location) => {
        console.log('[TRACK-RIDE] Driver location update received:', location);
        setDriverLocation(location);
      }
    );

    return () => {
      console.log('[TRACK-RIDE] Unsubscribing from driver location');
      unsubscribeLocation();
    };
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
        edgePadding: { top: 120, right: 60, bottom: 420, left: 60 },
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
      case 'completed':
        return { text: 'Shipment completed', color: 'bg-emerald-600' };
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
    <View testID="booking.trackRide" accessibilityLabel="booking.trackRide" className="flex-1 bg-white">
      {/* Map with driver tracking */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '55%' }}>
        {booking ? (
          <MapView
            ref={mapRef}
            style={{ width: '100%', height: '100%' }}
            mapType="standard"
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
            {driverLocation ? (
              <Marker.Animated
                coordinate={animatedCoordinate as any}
                anchor={{ x: 0.5, y: 0.5 }}
                title="Driver"
                description="En route"
                tracksViewChanges={false}
                rotation={heading}
                flat={true}
              >
                <Animated.View style={{ 
                  transform: [{ scale: pulseAnim }],
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Image 
                    source={(() => {
                      const spec = vehicleSpecs.find(s => s.vehicle_type === booking?.vehicle_type);
                      return getVehicleImageSource(booking?.vehicle_type || "", spec?.icon_url) || images.truckTransparent;
                    })()}
                    style={{ width: 44, height: 44, resizeMode: 'contain' }} 
                  />
                </Animated.View>
              </Marker.Animated>
            ) : null}

            {/* Pickup marker */}
            <Marker
              coordinate={{
                latitude: booking.origin_latitude,
                longitude: booking.origin_longitude,
              }}
              title="Pickup"
              anchor={{ x: 0.5, y: 0.5 }}
            >
               <Image source={icons.point} style={{ width: 30, height: 30, resizeMode: 'contain' }} />
            </Marker>

            {/* Dropoff marker */}
            <Marker
              coordinate={{
                latitude: booking.destination_latitude,
                longitude: booking.destination_longitude,
              }}
              title="Drop-off"
              anchor={{ x: 0.5, y: 0.5 }}
            >
               <Image source={icons.pin} style={{ width: 36, height: 36, resizeMode: 'contain' }} />
            </Marker>

            {/* Route line from driver to current target */}
            {driverLocation && (
              <OlaMapViewDirections
                origin={driverLocation}
                destination={{
                  latitude: isInProgress ? booking.destination_latitude : booking.origin_latitude,
                  longitude: isInProgress ? booking.destination_longitude : booking.origin_longitude
                }}
                strokeColor={isInProgress ? "#ef4444" : "#22c55e"}
                strokeWidth={4}
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
      <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }} pointerEvents="box-none">
        <View className="flex-row items-center justify-between px-5 pt-2" pointerEvents="box-none">
          <TouchableOpacity 
            onPress={() => router.back()}
            className="w-12 h-12 bg-white rounded-full items-center justify-center shadow-sm"
          >
            <Feather name="chevron-left" size={24} color="black" />
          </TouchableOpacity>
          <View className="bg-white/95 px-5 py-2 rounded-full shadow-md ml-4 mr-5 flex-shrink">
            <Text className="text-xl font-JakartaBold text-black" numberOfLines={1}>Track Shipment</Text>
          </View>
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
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {/* Status Badge */}
          <View className="items-center mb-4">
            <View className={`${status.color} px-4 py-2 rounded-full mb-2`}>
              <Text className="text-white font-JakartaSemiBold">{status.text}</Text>
            </View>
            <View className="bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
                <Text className="text-xs font-JakartaBold text-gray-500">
                    Ride ID: #{bookingId?.slice(-6).toUpperCase()}
                </Text>
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

          {/* Waiting Timer - show when driver has arrived */}
          {booking?.status === 'driver_arrived' && booking?.driver_arrived_at && (
            <WaitingTimer
              driverArrivedAt={booking.driver_arrived_at}
              freeWaitingMinutes={booking.free_waiting_time_minutes || 5}
              waitingChargePerMinute={booking.waiting_charge_per_minute || 2}
            />
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
              <TouchableOpacity
                onPress={handleSaveRoute}
                disabled={isSavingRoute}
                className="bg-brand-50 px-3 py-1.5 rounded-lg border border-brand-100 flex-row items-center"
              >
                {isSavingRoute ? (
                  <ActivityIndicator size="small" color="#FF9800" />
                ) : (
                  <>
                    <Feather name="plus" size={14} color="#FF9800" />
                    <Text className="ml-1 text-xs font-JakartaBold text-brand-600">Save Route</Text>
                  </>
                )}
              </TouchableOpacity>
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
                  <Text testID="booking.deliveryOtpValue" accessibilityLabel="booking.deliveryOtpValue" className="text-lg font-JakartaBold text-orange-600">{booking?.delivery_otp || "------"}</Text>
                  <Text className="text-[10px] text-gray-400 mt-1">Share with Driver to Receive</Text>
                </View>
              ) : (
                <View className="items-center flex-1">
                  <Text className="text-xs text-gray-500">Pickup OTP</Text>
                  <Text testID="booking.pickupOtpValue" accessibilityLabel="booking.pickupOtpValue" className="text-lg font-JakartaBold text-blue-600">{booking?.pickup_otp}</Text>
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
                  testID="booking.payOnlineButton"
                  accessibilityLabel="booking.payOnlineButton"
                  onPress={() => {
                      if (isNavigating) return;
                      setIsNavigating(true);
                      router.push({ pathname: "/pay-booking", params: { bookingId: booking.id } });
                      // Reset after delay to allow navigation to happen
                      setTimeout(() => setIsNavigating(false), 2000);
                  }}
                  disabled={isNavigating}
                  className={`mt-4 w-full py-4 rounded-xl flex-row items-center justify-center shadow-md shadow-primary-300 ${isNavigating ? 'bg-gray-400' : 'bg-primary-500'}`}
               >
                  <Text className="text-white font-JakartaBold text-lg mr-2">Pay Now</Text>
                  <Feather name="arrow-right" size={20} color="white" />
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
            testID="booking.sosButton"
            accessibilityLabel="booking.sosButton"
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
          router.replace({
            pathname: '/ride-details/[id]',
            params: { id: bookingId },
          });
        }}
        onSkip={() => {
          setShowPaymentConfirmation(false);
          router.replace({
            pathname: '/ride-details/[id]',
            params: { id: bookingId },
          });
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


