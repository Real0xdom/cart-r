import CustomButton from "@/components/CustomButton";
import { AddonSelector } from "@/components/AddonSelector";
import { AddonService, calculateAddonCharges, getApplicableAddons } from "@/lib/addonUtils";
import { calculateFares, FareEstimate } from "@/lib/fare";
import {
  getActiveVehicleTypes,
  getVehicleDescription,
  getVehicleDisplayName,
  getVehicleIcon,
  getVehicleImageSource,
  VehicleType,
} from "@/lib/vehicleTypes";
import { useBookingStore, useLocationStore, useRideStore } from "@/store";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

const SelectVehiclePage = () => {
  const {
    userAddress,
    userLatitude,
    userLongitude,
    destinationAddress,
    destinationLatitude,
    destinationLongitude,
  } = useLocationStore();
  const { setSelectedVehicle, clearSelectedVehicle, selectedVehicle } = useRideStore();
  const {
    receiverDetails,
    selectedAddonIds: storedAddonIds,
    setSelectedAddonIds: setStoredAddonIds,
  } = useBookingStore();

  const [fares, setFares] = useState<FareEstimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vehicleSpecs, setVehicleSpecs] = useState<VehicleType[]>([]);
  const [availableAddons, setAvailableAddons] = useState<AddonService[]>([]);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>(storedAddonIds);
  const [showAddonModal, setShowAddonModal] = useState(false);
  const pendingAddonModalVehicleTypeRef = useRef<string | null>(null);
  const addonFetchRequestIdRef = useRef(0);

  const activeVehicleTypes = new Set(vehicleSpecs.map((vehicle) => vehicle.vehicle_type));
  const visibleFares = fares.filter((fare) => activeVehicleTypes.has(fare.vehicle_type));

  useEffect(() => {
    if (!userAddress || !destinationAddress) {
      router.replace("/find-ride");
      return;
    }

    if (!receiverDetails) {
      router.replace("/receiver-details");
    }
  }, [destinationAddress, receiverDetails, userAddress]);

  useEffect(() => {
    const fetchVehicleSpecs = async () => {
      const { data, error: vehicleError } = await getActiveVehicleTypes();
      if (data && !vehicleError) {
        setVehicleSpecs(data);
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
        const options = await calculateFares(
          userLatitude,
          userLongitude,
          destinationLatitude,
          destinationLongitude
        );
        setFares(options);
      } catch (fareError) {
        console.error("[SELECT VEHICLE] Failed to load fares:", fareError);
        setError("Failed to load vehicle options. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchFares();
  }, [destinationLatitude, destinationLongitude, userLatitude, userLongitude]);

  useEffect(() => {
    const fetchAddonsForVehicle = async () => {
      if (!selectedVehicle) {
        setAvailableAddons([]);
        setSelectedAddonIds([]);
        setStoredAddonIds([]);
        pendingAddonModalVehicleTypeRef.current = null;
        setShowAddonModal(false);
        return;
      }

      const requestId = ++addonFetchRequestIdRef.current;
      const vehicleType = selectedVehicle.vehicle_type;
      const { data, error: addonError } = await getApplicableAddons(vehicleType);

      // Ignore stale responses from older vehicle selections.
      if (requestId !== addonFetchRequestIdRef.current) {
        return;
      }

      if (data && !addonError) {
        setAvailableAddons(data);

        if (pendingAddonModalVehicleTypeRef.current === vehicleType) {
          pendingAddonModalVehicleTypeRef.current = null;
          setShowAddonModal(data.length > 0);
        }

        return;
      }

      console.error("[SELECT VEHICLE] Failed to load add-ons:", addonError);
      setAvailableAddons([]);
      if (pendingAddonModalVehicleTypeRef.current === vehicleType) {
        pendingAddonModalVehicleTypeRef.current = null;
      }
    };

    fetchAddonsForVehicle();
  }, [selectedVehicle, setStoredAddonIds]);

  useEffect(() => {
    if (selectedVehicle && !activeVehicleTypes.has(selectedVehicle.vehicle_type)) {
      clearSelectedVehicle();
      setSelectedAddonIds([]);
      setStoredAddonIds([]);
    }
  }, [activeVehicleTypes, clearSelectedVehicle, selectedVehicle, setStoredAddonIds]);

  const addonChargesForIds = (ids: string[]) => calculateAddonCharges(ids, availableAddons);
  const totalFare = selectedVehicle ? selectedVehicle.total_fare + addonChargesForIds(selectedAddonIds) : 0;

  const handleSelectVehicle = (vehicle: FareEstimate) => {
    if (
      selectedVehicle?.vehicle_type === vehicle.vehicle_type &&
      !showAddonModal &&
      availableAddons.length > 0
    ) {
      setShowAddonModal(true);
      return;
    }

    setShowAddonModal(false);
    pendingAddonModalVehicleTypeRef.current = vehicle.vehicle_type;
    setSelectedVehicle(vehicle);
    setSelectedAddonIds([]);
    setStoredAddonIds([]);
  };

  const openReviewBooking = (addonIds: string[]) => {
    if (!selectedVehicle) {
      return;
    }

    setStoredAddonIds(addonIds);
    setShowAddonModal(false);

    router.push({
      pathname: "/review-booking",
      params: {
        vehicle: JSON.stringify(selectedVehicle),
        vehicleType: selectedVehicle.vehicle_type,
        baseFare: String(selectedVehicle.base_fare),
        totalFare: String(selectedVehicle.total_fare + addonChargesForIds(addonIds)),
        durationMinutes: String(selectedVehicle.duration_minutes),
        distanceKm: String(selectedVehicle.distance_km),
        addonIds: JSON.stringify(addonIds),
      },
    });
  };

  const handleReviewBooking = () => {
    if (!selectedVehicle) {
      return;
    }

    if (availableAddons.length > 0) {
      setShowAddonModal(true);
      return;
    }

    openReviewBooking([]);
  };

  const renderVehicleItem = ({ item, index }: { item: FareEstimate; index: number }) => (
    <TouchableOpacity
      testID={"vehicle.option." + index}
      accessibilityLabel={"vehicle.option." + index}
      onPress={() => handleSelectVehicle(item)}
      className={`mb-2 flex-row items-center rounded-2xl border p-2.5 ${
        selectedVehicle?.vehicle_type === item.vehicle_type
          ? "border-brand-500 bg-brand-100"
          : "border-gray-100 bg-white"
      }`}
    >
      <View className="mr-3 h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-gray-50">
        {(() => {
          const spec = vehicleSpecs.find((vehicle) => vehicle.vehicle_type === item.vehicle_type);
          const source = getVehicleImageSource(item.vehicle_type, spec?.icon_url);

          if (source) {
            return <Image source={source} className="h-full w-full" resizeMode="contain" />;
          }

          return <Text className="text-xl">{getVehicleIcon(item.vehicle_type, vehicleSpecs)}</Text>;
        })()}
      </View>

      <View className="flex-1">
        <Text className="text-base font-JakartaBold capitalize text-gray-900">
          {getVehicleDisplayName(item.vehicle_type, vehicleSpecs)}
        </Text>
        <Text className="text-xs font-JakartaMedium text-gray-500" numberOfLines={1}>
          {getVehicleDescription(item.vehicle_type, vehicleSpecs)}
        </Text>
        <Text className="mt-0.5 text-xs text-gray-400">
          {item.duration_minutes} min • {item.distance_km} km
        </Text>
      </View>

      <View className="items-end">
        <Text className="text-lg font-JakartaBold text-gray-900">₹{item.total_fare}</Text>
        {selectedVehicle?.vehicle_type === item.vehicle_type ? (
          <View className="mt-1 rounded-full bg-brand-500 p-1">
            <Feather name="check" size={10} color="#fff" />
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-[#f8fafc]">
      {/* Header */}
      <View className="flex-row items-center px-5 py-4 bg-white border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center">
          <Feather name="arrow-left" size={20} color="#333" />
        </TouchableOpacity>
        <Text className="ml-4 text-xl font-JakartaBold text-gray-900">Select Vehicle</Text>
      </View>

      <View testID="vehicle.selectVehicle" accessibilityLabel="vehicle.selectVehicle" className="flex-1">
        {loading ? (
          <View className="items-center justify-center py-10">
            <ActivityIndicator size="large" color="#FF9800" />
            <Text className="mt-2 font-JakartaMedium text-gray-500">Calculating fares...</Text>
          </View>
        ) : error ? (
          <View className="items-center justify-center py-10">
            <Text className="mb-4 text-center font-JakartaMedium text-red-500">{error}</Text>
            <CustomButton title="Retry" onPress={() => setFares([])} bgVariant="outline" />
          </View>
        ) : (
          <>
            <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
              {visibleFares.map((item, index) => (
                <View key={item.vehicle_type}>{renderVehicleItem({ item, index })}</View>
              ))}
            </ScrollView>

            {/* Fixed footer so the Review Booking button is always visible without scrolling */}
            <View className="border-t border-gray-100 bg-[#f8fafc] px-1 pb-2 pt-3">
              {selectedVehicle ? (
                <View className="mb-3 flex-row items-center justify-between px-1">
                  <Text className="font-JakartaMedium text-gray-600">Fare</Text>
                  <Text className="text-xl font-JakartaBold text-green-600">
                    ₹{selectedVehicle.total_fare}
                    {availableAddons.length > 0 ? (
                      <Text className="text-sm font-JakartaMedium text-gray-500"> + add-ons in next step</Text>
                    ) : null}
                  </Text>
                </View>
              ) : null}

              <TouchableOpacity
                onPress={handleReviewBooking}
                testID="booking.confirmButton"
                accessibilityLabel="booking.confirmButton"
                disabled={!selectedVehicle}
                className={`w-full flex-row items-center justify-center rounded-xl py-4 ${
                  selectedVehicle ? "bg-brand-500" : "bg-gray-300"
                }`}
              >
                <Feather name="arrow-right" size={18} color="#fff" />
                <Text className="ml-2 font-JakartaBold text-white">Review Booking</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <Modal
          visible={showAddonModal}
          animationType="slide"
          transparent
          onRequestClose={() => setShowAddonModal(false)}
        >
          <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setShowAddonModal(false)}>
            <Pressable className="max-h-[70%] rounded-t-3xl bg-white" onPress={(event) => event.stopPropagation()}>
              <View className="mb-1 mt-2 h-1 w-12 self-center rounded-full bg-gray-300" />
              <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
                {selectedVehicle ? (
                  <AddonSelector
                    addons={availableAddons}
                    selectedAddonIds={selectedAddonIds}
                    onToggleAddon={(id) =>
                      setSelectedAddonIds((previous) =>
                        previous.includes(id)
                          ? previous.filter((selectedId) => selectedId !== id)
                          : [...previous, id]
                      )
                    }
                    vehicleType={selectedVehicle.vehicle_type}
                  />
                ) : null}
              </ScrollView>

              {/* Fixed footer so Total + Continue are always visible without scrolling */}
              <View className="border-t border-gray-100 px-5 pb-6 pt-3">
                <View className="mb-3 flex-row items-center justify-between">
                  <Text className="font-JakartaBold text-gray-800">Total</Text>
                  <Text className="text-2xl font-JakartaBold text-green-600">₹{totalFare}</Text>
                </View>

                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => setShowAddonModal(false)}
                    className="flex-1 flex-row items-center justify-center rounded-xl bg-gray-100 py-4"
                  >
                    <Feather name="arrow-left" size={18} color="#333" />
                    <Text className="ml-2 font-JakartaSemiBold text-gray-700">Back</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => openReviewBooking(selectedAddonIds)}
                    testID="booking.confirmButton"
                    accessibilityLabel="booking.confirmButton"
                    className="flex-[2] flex-row items-center justify-center rounded-xl bg-brand-500 py-4"
                  >
                    <Feather name="arrow-right" size={18} color="#fff" />
                    <Text className="ml-2 font-JakartaBold text-white">Continue</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

export default SelectVehiclePage;
