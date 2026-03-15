import CustomButton from "@/components/CustomButton";
import RideLayout from "@/components/RideLayout";
import { useLocationStore, useRideStore, useBookingStore } from "@/store";
import { useAuth } from "@/contexts/AuthContext";
import { router } from "expo-router";
import { useState, useEffect } from "react";
import {
  getActiveVehicleTypes,
  getVehicleIcon,
  getVehicleDescription,
  getVehicleDisplayName,
  VehicleType,
} from "@/lib/vehicleTypes";
import {
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { calculateFares, FareEstimate } from "@/lib/fare";
import { createBooking } from "@/lib/bookings";
import { payWithWallet, getWalletBalance, calculatePaymentSplit } from "@/lib/walletPayment";
import { AddonSelector, AddonService } from "@/components/AddonSelector";
import { getApplicableAddons, calculateAddonCharges, addAddonToBooking } from "@/lib/addonUtils";

const SelectVehiclePage = () => {
  const { profile } = useAuth();
  const {
    userAddress,
    userLatitude,
    userLongitude,
    destinationAddress,
    destinationLatitude,
    destinationLongitude,
  } = useLocationStore();
  
  const { setSelectedVehicle, clearSelectedVehicle, selectedVehicle } = useRideStore();
  const { receiverDetails, setCurrentBooking } = useBookingStore();

  const [fares, setFares] = useState<FareEstimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBooking, setIsBooking] = useState(false);

  // Vehicle specifications from database
  const [vehicleSpecs, setVehicleSpecs] = useState<VehicleType[]>([]);

  // Addon services (only shown in bottom modal when vehicle has addons)
  const [availableAddons, setAvailableAddons] = useState<AddonService[]>([]);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [showAddonModal, setShowAddonModal] = useState(false);

  // Wallet payment state
  const [walletBalance, setWalletBalance] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'wallet' | 'partial_wallet'>('cash');
  const [isPaying, setIsPaying] = useState(false);
  const activeVehicleTypes = new Set(vehicleSpecs.map((vehicle) => vehicle.vehicle_type));
  const visibleFares = fares.filter((fare) => activeVehicleTypes.has(fare.vehicle_type));

  // Redirect if missing required data
  useEffect(() => {
    if (!userAddress || !destinationAddress) {
      router.replace("/find-ride");
      return;
    }
    if (!receiverDetails) {
      router.replace("/receiver-details");
      return;
    }
  }, [userAddress, destinationAddress, receiverDetails]);

  // Fetch vehicle specifications from database
  useEffect(() => {
    const fetchVehicleSpecs = async () => {
      const { data, error } = await getActiveVehicleTypes();
      if (data && !error) {
        setVehicleSpecs(data);
        console.log('[SELECT VEHICLE] Loaded vehicle specs from database:', data.length);
      } else {
        console.error('[SELECT VEHICLE] Failed to load vehicle specs:', error);
      }
    };
    fetchVehicleSpecs();
  }, []);

  useEffect(() => {
    const fetchFares = async () => {
      if (!userLatitude || !userLongitude || !destinationLatitude || !destinationLongitude) {
        return;
      }

      setLoading(true);
      setError(null);
      try {
        console.log('[SELECT VEHICLE] Calculating fares...');
        const options = await calculateFares(
          userLatitude,
          userLongitude,
          destinationLatitude,
          destinationLongitude
        );
        console.log('[SELECT VEHICLE] Fare options received:', options.length);
        console.log('[SELECT VEHICLE] Vehicle types:', options.map(o => o.vehicle_type).join(', '));
        console.log('[SELECT VEHICLE] Full fare data:', JSON.stringify(options, null, 2));
        
        const hasTruck = options.some(o => o.vehicle_type === 'truck');
        console.log('[SELECT VEHICLE] Has truck?', hasTruck);
        
        setFares(options);
      } catch (err) {
        console.error('[SELECT VEHICLE] Error:', err);
        setError("Failed to load vehicle options. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchFares();
  }, [userLatitude, userLongitude, destinationLatitude, destinationLongitude]);

  // Fetch wallet balance
  useEffect(() => {
    const fetchWallet = async () => {
      if (profile?.id) {
        const balance = await getWalletBalance(profile.id);
        setWalletBalance(balance);
      }
    };
    fetchWallet();
  }, [profile]);

  // Fetch addons when vehicle is selected
  useEffect(() => {
    const fetchAddonsForVehicle = async () => {
      if (!selectedVehicle) {
        setAvailableAddons([]);
        setSelectedAddonIds([]);
        return;
      }

      const { data, error } = await getApplicableAddons(selectedVehicle.vehicle_type);
      if (data && !error) {
        setAvailableAddons(data);
        console.log('[SELECT VEHICLE] Loaded addons for', selectedVehicle.vehicle_type, ':', data.length);
      } else {
        console.error('[SELECT VEHICLE] Failed to load addons:', error);
        setAvailableAddons([]);
      }
    };

    fetchAddonsForVehicle();
  }, [selectedVehicle]);

  // When vehicle has addons, show bottom modal (slide up)
  useEffect(() => {
    if (selectedVehicle && availableAddons.length > 0) {
      setShowAddonModal(true);
    } else {
      setShowAddonModal(false);
    }
  }, [selectedVehicle, availableAddons.length]);

  useEffect(() => {
    if (selectedVehicle && !activeVehicleTypes.has(selectedVehicle.vehicle_type)) {
      clearSelectedVehicle();
    }
  }, [activeVehicleTypes, clearSelectedVehicle, selectedVehicle]);

  const handleSelectVehicle = (vehicle: FareEstimate) => {
    setSelectedVehicle(vehicle);
    setSelectedAddonIds([]);
  };

  const addonChargesForIds = (ids: string[]) => calculateAddonCharges(ids, availableAddons);
  const totalFareForAddons = (ids: string[]) =>
    selectedVehicle ? selectedVehicle.total_fare + addonChargesForIds(ids) : 0;
  const totalFare = selectedVehicle ? selectedVehicle.total_fare + addonChargesForIds(selectedAddonIds) : 0;
  const paymentSplit = selectedVehicle
    ? calculatePaymentSplit(walletBalance, totalFare)
    : null;

  const doCreateBookingAndNavigate = async (addonIds: string[]) => {
    if (isBooking) return;

    if (!selectedVehicle || !profile?.id) {
      Alert.alert("Error", "Please sign in and select a vehicle.");
      return;
    }

    if (!userLatitude || !userLongitude || !destinationLatitude || !destinationLongitude) {
      Alert.alert("Error", "Location data is missing. Please try again.");
      return;
    }

    if (!receiverDetails) {
      Alert.alert("Error", "Missing receiver details.");
      return;
    }

    const fareWithAddons = totalFareForAddons(addonIds);
    const split = selectedVehicle ? calculatePaymentSplit(walletBalance, fareWithAddons) : null;
    if (paymentMethod === 'wallet' && split && !split.canPayFull) {
      Alert.alert(
        "Insufficient Balance",
        `You need ₹${fareWithAddons.toFixed(2)} to pay fully with wallet. Please add money or choose another method.`,
        [
          { text: "Add Money", onPress: () => router.push("/(tabs)/payment") },
          { text: "Cancel", style: "cancel" },
        ]
      );
      return;
    }

    setIsBooking(true);
    setIsPaying(true);

    try {
      const bookingParams = {
        customerId: profile.id,
        originAddress: userAddress || "",
        originLatitude: userLatitude,
        originLongitude: userLongitude,
        destinationAddress: destinationAddress || "",
        destinationLatitude: destinationLatitude,
        destinationLongitude: destinationLongitude,
        vehicle: selectedVehicle,
        receiverDetails: receiverDetails,
        paymentMethod: paymentMethod === 'cash' ? 'cash' : 'wallet',
        tip_amount: 0,
      };

      const { data, error } = await createBooking(bookingParams);

      if (error) {
        Alert.alert("Error", error.message);
        return;
      }

      if (!data) {
        Alert.alert("Error", "Failed to create booking");
        return;
      }

      if (addonIds.length > 0) {
        for (const addonId of addonIds) {
          const addon = availableAddons.find((a) => a.id === addonId);
          if (addon?.code) {
            await addAddonToBooking(data.id, addon.code);
          }
        }
      }

      if (paymentMethod === 'wallet' || paymentMethod === 'partial_wallet') {
        const result = await payWithWallet(data.id, profile.id, paymentMethod === 'wallet');
        if (!result.success) {
          Alert.alert("Payment Failed", result.error || "Wallet deduction failed. Paying with cash instead.");
        } else if (result.new_wallet_balance !== undefined) {
          setWalletBalance(result.new_wallet_balance);
        }
      }

      setCurrentBooking(data);
      setShowAddonModal(false);
      router.replace({ pathname: "/waiting-for-driver", params: { bookingId: data.id } });
    } catch (err: any) {
      console.error("[BOOKING ERROR]:", err);
      Alert.alert("Error", err.message || "Booking failed.");
    } finally {
      setIsBooking(false);
      setIsPaying(false);
    }
  };

  const handleBookNow = () => {
    if (!selectedVehicle) return;
    if (availableAddons.length > 0) {
      setShowAddonModal(true);
    } else {
      doCreateBookingAndNavigate([]);
    }
  };

  const renderVehicleItem = ({ item, index }: { item: FareEstimate; index: number }) => (
    <TouchableOpacity
      testID={'vehicle.option.' + index}
      accessibilityLabel={'vehicle.option.' + index}
      onPress={() => handleSelectVehicle(item)}
      className={`flex-row items-center p-4 mb-3 rounded-2xl border ${
        selectedVehicle?.vehicle_type === item.vehicle_type
          ? 'bg-brand-100 border-brand-500'
          : 'bg-white border-gray-100'
      }`}
    >
      <View className="w-12 h-12 bg-gray-50 rounded-full items-center justify-center mr-3">
        <Text className="text-xl">{getVehicleIcon(item.vehicle_type, vehicleSpecs)}</Text>
      </View>
      
      <View className="flex-1">
        <Text className="text-base font-JakartaBold capitalize text-gray-900">
          {getVehicleDisplayName(item.vehicle_type, vehicleSpecs)}
        </Text>
        <Text className="text-xs text-gray-500 font-JakartaMedium">
          {getVehicleDescription(item.vehicle_type, vehicleSpecs)}
        </Text>
        <Text className="text-xs text-gray-400 mt-0.5">
          {item.duration_minutes} min • {item.distance_km} km
        </Text>
      </View>

      <View className="items-end">
        <Text className="text-lg font-JakartaBold text-gray-900">
          ₹{item.total_fare}
        </Text>
        {selectedVehicle?.vehicle_type === item.vehicle_type && (
          <View className="bg-brand-500 rounded-full p-1 mt-1">
            <Feather name="check" size={10} color="#fff" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <RideLayout 
      title="Select Vehicle" 
      snapPoints={["50%", "90%"]}
      useView={false}
    >
      <View testID="vehicle.selectVehicle" accessibilityLabel="vehicle.selectVehicle">

        {loading ? (
          <View className="items-center justify-center py-10">
            <ActivityIndicator size="large" color="#FF9800" />
            <Text className="text-gray-500 mt-2 font-JakartaMedium">Calculating fares...</Text>
          </View>
        ) : error ? (
          <View className="items-center justify-center py-10">
            <Text className="text-red-500 font-JakartaMedium text-center mb-4">{error}</Text>
            <CustomButton title="Retry" onPress={() => setFares([])} bgVariant="outline" />
          </View>
        ) : (
          <>
            {/* Vehicle List only */}
            <View>
              {visibleFares.map((item, index) => (
                <View key={item.vehicle_type}>
                  {renderVehicleItem({ item, index })}
                </View>
              ))}
            </View>

            {/* Total & Book / Back - no tip on this page */}
            <View className="mt-4">
              {selectedVehicle && (
                <View className="flex-row justify-between items-center mb-3 px-1">
                  <Text className="text-gray-600 font-JakartaMedium">Fare</Text>
                  <Text className="text-xl font-JakartaBold text-green-600">
                    ₹{selectedVehicle.total_fare}
                    {availableAddons.length > 0 && (
                      <Text className="text-sm font-JakartaMedium text-gray-500"> + add-ons in next step</Text>
                    )}
                  </Text>
                </View>
              )}

              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => router.back()}
                  className="flex-1 bg-gray-100 py-4 rounded-xl items-center flex-row justify-center"
                  disabled={isBooking}
                >
                  <Feather name="arrow-left" size={18} color="#333" />
                  <Text className="ml-2 font-JakartaSemiBold text-gray-700">Back</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleBookNow}
                  testID="booking.confirmButton"
                  accessibilityLabel="booking.confirmButton"
                  disabled={!selectedVehicle || isBooking}
                  className={`flex-[2] py-4 rounded-xl items-center justify-center flex-row ${
                    selectedVehicle && !isBooking ? "bg-brand-500" : "bg-gray-300"
                  }`}
                >
                  {isBooking ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Feather name="search" size={18} color="#fff" />
                      <Text className="ml-2 font-JakartaBold text-white">Book Now</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

      {/* Add-on Services bottom modal - slides up when vehicle has addons */}
      <Modal
        visible={showAddonModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddonModal(false)}
      >
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setShowAddonModal(false)}>
          <Pressable className="bg-white rounded-t-3xl max-h-[85%]" onPress={(e) => e.stopPropagation()}>
            <View className="w-12 h-1 bg-gray-300 rounded-full self-center mt-2 mb-1" />
            <ScrollView className="px-5 pb-8" showsVerticalScrollIndicator={false}>
              {selectedVehicle && (
                <AddonSelector
                  addons={availableAddons}
                  selectedAddonIds={selectedAddonIds}
                  onToggleAddon={(id) =>
                    setSelectedAddonIds((prev) =>
                      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                    )
                  }
                  vehicleType={selectedVehicle.vehicle_type}
                />
              )}

              <View className="flex-row justify-between items-center mt-4 mb-6">
                <Text className="text-gray-800 font-JakartaBold">Total</Text>
                <Text className="text-2xl font-JakartaBold text-green-600">₹{totalFare}</Text>
              </View>

              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => setShowAddonModal(false)}
                  className="flex-1 bg-gray-100 py-4 rounded-xl items-center flex-row justify-center"
                  disabled={isBooking}
                >
                  <Feather name="arrow-left" size={18} color="#333" />
                  <Text className="ml-2 font-JakartaSemiBold text-gray-700">Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => doCreateBookingAndNavigate(selectedAddonIds)}
                  testID="booking.confirmButton"
                  accessibilityLabel="booking.confirmButton"
                  disabled={isBooking}
                  className="flex-[2] py-4 rounded-xl items-center justify-center flex-row bg-brand-500"
                >
                  {isBooking ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Feather name="search" size={18} color="#fff" />
                      <Text className="ml-2 font-JakartaBold text-white">Book Now</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      </View>
    </RideLayout>
  );
};

export default SelectVehiclePage;


