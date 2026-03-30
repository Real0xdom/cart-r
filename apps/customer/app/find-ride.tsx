import CustomButton from "@/components/CustomButton";
import GoogleTextInput from "@/components/GoogleTextInput";
import Map from "@/components/Map";
import { icons } from "@/constants";
import { useLocation } from "@/contexts/LocationContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLocationStore } from "@/store";
import { router } from "expo-router";
import { useState, useCallback, useEffect, useRef } from "react";
import { Text, View, TouchableOpacity, ActivityIndicator, Animated, ScrollView, Image, KeyboardAvoidingView, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { isLocationSupported, getActiveServiceAreas, ServiceArea, haversineDistance } from "@/lib/serviceArea";

import { getSavedAddresses, saveAddress, SavedAddress, getPlaceIoniconName } from "@/lib/savedPlaces";
import { Alert } from "react-native";

type LocationStatus = 'idle' | 'checking' | 'valid' | 'invalid';

const FindRide = () => {
  const { t } = useLanguage();
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const {
    userAddress,
    userLatitude,
    userLongitude,
    destinationAddress,
    destinationLatitude,
    destinationLongitude,
    setDestinationLocation,
    setUserLocation,
    clearUserLocation,
    clearDestination,
  } = useLocationStore();

  const { getCurrentLocation, isLoadingLocation } = useLocation();

  const [selectingOnMap, setSelectingOnMap] = useState<'from' | 'to' | null>(null);
  const [fetchingLocation, setFetchingLocation] = useState(false);

  // Per-field service area validation
  const [pickupStatus, setPickupStatus] = useState<LocationStatus>('idle');
  const [dropStatus, setDropStatus] = useState<LocationStatus>('idle');
  const [pickupError, setPickupError] = useState<string | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);

  // Service areas for location bias
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);

  // Animation for warning banners
  const pickupShake = useRef(new Animated.Value(0)).current;
  const dropShake = useRef(new Animated.Value(0)).current;

  // Track active field for z-index management
  const [activeField, setActiveField] = useState<'pickup' | 'drop' | null>(null);
  const [isSuggestionListOpen, setIsSuggestionListOpen] = useState(false);

  // Load service areas and saved addresses on mount
  useEffect(() => {
    getActiveServiceAreas().then(({ data }) => {
      if (data) setServiceAreas(data);
    });
    fetchSavedPlaces();
  }, []);

  const fetchSavedPlaces = async () => {
    setLoadingSaved(true);
    const { data } = await getSavedAddresses();
    if (data) setSavedAddresses(data);
    setLoadingSaved(false);
  };

  const handleSavePlace = async (type: 'pickup' | 'drop') => {
    const address = type === 'pickup' ? userAddress : destinationAddress;
    const { userLatitude, userLongitude, destinationLatitude, destinationLongitude } = useLocationStore.getState();
    const lat = type === 'pickup' ? userLatitude : destinationLatitude;
    const lng = type === 'pickup' ? userLongitude : destinationLongitude;

    if (!address || !lat || !lng) {
      Alert.alert(t("error"), t("pleaseSelectLocation"));
      return;
    }

    // Checking if already saved
    const isAlreadySaved = savedAddresses.some(sa => sa.address === address);
    if (isAlreadySaved) {
      Alert.alert(t("info"), t("locationAlreadySaved"));
      return;
    }

    setLoadingSaved(true); // Fix: Re-using the existing loadingSaved state
    const defaultLabel = address.split(',')[0];

    const { data, error } = await saveAddress({
      label: defaultLabel,
      address,
      latitude: lat,
      longitude: lng,
      icon_type: address.toLowerCase().includes('home') ? 'home' : 
                 address.toLowerCase().includes('work') ? 'briefcase' : 'location-outline'
    });

    if (data) {
      fetchSavedPlaces();
      Alert.alert(t("success"), `"${defaultLabel}" ${t("savedToAddresses")}`);
    } else {
      Alert.alert(t("error"), t("failedToSaveLocation"));
    }
    setLoadingSaved(false);
  };

  const shakeAnimation = (anim: Animated.Value) => {
    Animated.sequence([
      Animated.timing(anim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(anim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(anim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  // Validate pickup location
  const validatePickup = useCallback(async (lat: number, lng: number) => {
    setPickupStatus('checking');
    setPickupError(null);
    const result = await isLocationSupported(lat, lng);
    if (result.supported) {
      setPickupStatus('valid');
      setPickupError(null);
    } else {
      setPickupStatus('invalid');
      setPickupError(t('pickupOutsideService'));
      shakeAnimation(pickupShake);
    }
  }, []);

  // Validate drop location
  const validateDrop = useCallback(async (lat: number, lng: number) => {
    setDropStatus('checking');
    setDropError(null);
    const result = await isLocationSupported(lat, lng);
    if (result.supported) {
      setDropStatus('valid');
      setDropError(null);
    } else {
      setDropStatus('invalid');
      setDropError(t('dropOutsideService'));
      shakeAnimation(dropShake);
    }
  }, []);

  const handleUseCurrentLocation = useCallback(async () => {
    setFetchingLocation(true);
    try {
      await getCurrentLocation();
    } catch (error) {
      console.error("Error fetching current location:", error);
    } finally {
      setFetchingLocation(false);
    }
  }, [getCurrentLocation]);

  const handleSelectOnMap = (field: 'from' | 'to') => {
    setSelectingOnMap(prev => prev === field ? null : field);
  };

  const handleMapLocationSelected = useCallback(() => {
    setSelectingOnMap(null);
  }, []);

  // Handle pickup selection
  const handlePickupSelected = useCallback((location: { latitude: number; longitude: number; address: string }) => {
    setUserLocation(location);
  }, [setUserLocation]);

  // Handle drop selection
  const handleDropSelected = useCallback((location: { latitude: number; longitude: number; address: string }) => {
    setDestinationLocation(location);
  }, [setDestinationLocation]);

  useEffect(() => {
    if (userLatitude && userLongitude) {
      validatePickup(userLatitude, userLongitude);
    } else {
      setPickupStatus('idle');
      setPickupError(null);
    }
  }, [userLatitude, userLongitude, validatePickup]);

  useEffect(() => {
    if (destinationLatitude && destinationLongitude) {
      validateDrop(destinationLatitude, destinationLongitude);
    } else {
      setDropStatus('idle');
      setDropError(null);
    }
  }, [destinationLatitude, destinationLongitude, validateDrop]);

  const handleNext = () => {
    if (canProceed) {
      router.push("/receiver-details");
    }
  };

  const handleClearPickup = useCallback(() => {
    clearUserLocation();
    setPickupStatus('idle');
    setPickupError(null);
  }, [clearUserLocation]);

  const handleClearDrop = useCallback(() => {
    clearDestination();
    setDropStatus('idle');
    setDropError(null);
  }, [clearDestination]);

  const isLoading = isLoadingLocation || fetchingLocation;

  // Can only proceed if both addresses set AND both are valid (or drop not yet checked)
  const pickupOk = pickupStatus === 'valid';
  const dropOk = dropStatus === 'valid';
  const canProceed = !!(userAddress && destinationAddress && pickupOk && dropOk);

  // Get location bias for Google Places
  // If we have user location, find the NEAREST service area to bias towards
  // Otherwise default to the first one
  const locationBias = (() => {
    if (serviceAreas.length === 0) return undefined;
    
    let bestArea = serviceAreas[0];
    
    // If we have user coordinates, find the closest service area
    const { userLatitude, userLongitude } = useLocationStore.getState();
    if (userLatitude && userLongitude) {
      // simple find-min
      let minDist = Infinity;
      serviceAreas.forEach(area => {
         const d = haversineDistance(
           userLatitude, 
           userLongitude, 
           Number(area.center_latitude), 
           Number(area.center_longitude)
         );
         if (d < minDist) {
           minDist = d;
           bestArea = area;
         }
      });
    }

    return {
      latitude: Number(bestArea.center_latitude),
      longitude: Number(bestArea.center_longitude),
      radius: Number(bestArea.radius_km) * 1000,
    };
  })();

  const isPickupSaved = !!userAddress && savedAddresses.some((sa) => sa.address === userAddress);
  const isDropSaved = !!destinationAddress && savedAddresses.some((sa) => sa.address === destinationAddress);

  return (
    <GestureHandlerRootView className="flex-1">
      <View className="flex-1 bg-white">
        {/* Map Section (Top 50%) */}
        <View className="h-1/2 w-full">
          <View className="absolute z-10 top-12 left-5 flex-row items-center w-full pr-10">
            <TouchableOpacity onPress={() => router.back()}>
              <View className="w-10 h-10 bg-white rounded-full items-center justify-center shadow-md">
                <Image
                  source={icons.backArrow}
                  resizeMode="contain"
                  className="w-6 h-6"
                />
              </View>
            </TouchableOpacity>
            <View className="bg-white/95 px-5 py-2 rounded-full shadow-md ml-4 flex-shrink">
              <Text className="text-lg font-JakartaSemiBold text-black" numberOfLines={1}>
                {t("selectLocations")}
              </Text>
            </View>
          </View>

          {selectingOnMap && (
            <View className="absolute z-10 top-28 left-5 right-5 bg-blue-600 p-3 rounded-xl shadow-lg">
              <Text className="text-white text-center font-JakartaSemiBold">
                Tap on the map to select your {selectingOnMap === 'from' ? 'pickup' : 'destination'} location
              </Text>
            </View>
          )}

          <Map
            selectionMode={selectingOnMap}
            onLocationSelected={handleMapLocationSelected}
            interactionEnabled={!!selectingOnMap || !isSuggestionListOpen}
          />
        </View>

        {/* Input Form Section (Bottom 50%) */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
          className="flex-1"
          style={{ overflow: "visible" }}
        >
          <View
            className="bg-gray-50 flex-1"
            style={{ borderTopLeftRadius: 30, borderTopRightRadius: 30, marginTop: -20, zIndex: 10, elevation: 20, overflow: 'visible' }}
          >
            <View className="flex-1 px-5 pt-6 pb-6 justify-between">
              <View>
            {/* Pickup Field Section */}
            <View style={{ zIndex: activeField === 'pickup' ? 50 : 1 }}>
              <View className="flex-row items-center justify-between mb-2 ml-1">
                <Text className="text-xs font-JakartaSemiBold text-gray-500">
                  Enter pickup location
                </Text>
                {!!userAddress && pickupStatus === 'valid' && (
                  <TouchableOpacity
                    onPress={() => handleSavePlace('pickup')}
                    disabled={isPickupSaved || loadingSaved}
                    className="flex-row items-center bg-white border border-gray-200 rounded-full px-2.5 py-1"
                  >
                    <Ionicons
                      name={isPickupSaved ? "checkmark" : "create-outline"}
                      size={12}
                      color={isPickupSaved ? "#16a34a" : "#6b7280"}
                    />
                    <Text className={`ml-1 text-[10px] font-JakartaMedium ${
                      isPickupSaved ? 'text-green-600' : 'text-gray-600'
                    }`}>
                      {isPickupSaved ? 'Saved' : 'Save address'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <GoogleTextInput
                initialLocation={userAddress ?? undefined}
                containerStyle={`bg-white rounded-2xl border ${pickupStatus === 'invalid' ? 'border-red-300' : 'border-gray-100'} shadow-sm`}
                textInputBackgroundColor="transparent"
                handlePress={handlePickupSelected}
                testID="ride.pickupInput"
                locationBias={locationBias}
                showMapAction={true}
                onMapActionPress={() => handleSelectOnMap('from')}
                onClear={handleClearPickup}
                onFocus={() => setActiveField('pickup')}
                onBlur={() => setActiveField(null)}
                onListVisibilityChange={setIsSuggestionListOpen}
              />

              {/* Compact Current Location & Saved Places */}
              {!isSuggestionListOpen && (
              <View className="flex-row items-center justify-between mt-2 px-1">
                <TouchableOpacity
                  onPress={handleUseCurrentLocation}
                  className="flex-row items-center"
                  disabled={isLoading}
                >
                  <Ionicons name="navigate-outline" size={14} color="#3b82f6" />
                  <Text className="ml-1 text-xs font-JakartaMedium text-blue-500">
                    {t("useCurrentLocation")}
                  </Text>
                </TouchableOpacity>

                {savedAddresses.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1 ml-4">
                    {savedAddresses.map((place) => (
                      <TouchableOpacity
                        key={place.id}
                        onPress={() => handlePickupSelected({
                          latitude: Number(place.latitude),
                          longitude: Number(place.longitude),
                          address: place.address
                        })}
                        className="flex-row items-center bg-white border border-gray-100 rounded-full px-2 py-1 mr-2 shadow-sm"
                      >
                        <Ionicons name={getPlaceIoniconName(place.icon_type) as any} size={12} color="#FF9800" />
                        <Text className="ml-1 text-[10px] font-JakartaMedium text-gray-700">{place.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
              )}

              {/* Pickup error banner */}
              {!isSuggestionListOpen && pickupStatus === 'invalid' && pickupError && (
                  <View className="mt-2 bg-red-50 border border-red-200 rounded-xl p-3 flex-row items-start">
                  <MaterialIcons name="location-off" size={16} color="#EF4444" />
                  <View className="flex-1 ml-2">
                    <Text className="text-red-700 text-xs font-JakartaBold mb-0.5">{t("outsideServiceArea")}</Text>
                    <Text className="text-red-600 text-xs font-JakartaMedium">{pickupError}</Text>
                  </View>
                </View>
              )}
            </View>

            <View className="h-5 w-px bg-gray-300 ml-10 my-1" />

            {/* Drop Field Section */}
            <View style={{ zIndex: activeField === 'drop' ? 50 : 1 }}>
              <View className="flex-row items-center justify-between mb-2 ml-1">
                <Text className="text-xs font-JakartaSemiBold text-gray-500">
                  Enter drop location
                </Text>
                {!!destinationAddress && dropOk && (
                  <TouchableOpacity
                    onPress={() => handleSavePlace('drop')}
                    disabled={isDropSaved || loadingSaved}
                    className="flex-row items-center bg-white border border-gray-200 rounded-full px-2.5 py-1"
                  >
                    <Ionicons
                      name={isDropSaved ? "checkmark" : "create-outline"}
                      size={12}
                      color={isDropSaved ? "#16a34a" : "#6b7280"}
                    />
                    <Text className={`ml-1 text-[10px] font-JakartaMedium ${
                      isDropSaved ? 'text-green-600' : 'text-gray-600'
                    }`}>
                      {isDropSaved ? 'Saved' : 'Save address'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <GoogleTextInput
                initialLocation={destinationAddress ?? undefined}
                containerStyle={`bg-white rounded-2xl border ${dropStatus === 'invalid' ? 'border-red-300' : 'border-gray-100'} shadow-sm`}
                textInputBackgroundColor="transparent"
                listPosition="top"
                handlePress={handleDropSelected}
                testID="ride.dropInput"
                locationBias={locationBias}
                showMapAction={true}
                onMapActionPress={() => handleSelectOnMap('to')}
                onClear={handleClearDrop}
                onFocus={() => setActiveField('drop')}
                onBlur={() => setActiveField(null)}
                onListVisibilityChange={setIsSuggestionListOpen}
              />

              {/* Saved Places for Drop */}
              {!isSuggestionListOpen && savedAddresses.length > 0 && (
                <View className="mt-2 px-1">
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {savedAddresses.map((place) => (
                      <TouchableOpacity
                        key={place.id}
                        onPress={() => handleDropSelected({
                          latitude: Number(place.latitude),
                          longitude: Number(place.longitude),
                          address: place.address
                        })}
                        className="flex-row items-center bg-white border border-gray-100 rounded-full px-2 py-1 mr-2 shadow-sm"
                      >
                        <Ionicons name={getPlaceIoniconName(place.icon_type) as any} size={12} color="#FF9800" />
                        <Text className="ml-1 text-[10px] font-JakartaMedium text-gray-700">{place.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Drop error banner */}
              {!isSuggestionListOpen && dropStatus === 'invalid' && dropError && (
                <View className="mt-2 bg-red-50 border border-red-200 rounded-xl p-3 flex-row items-start">
                  <MaterialIcons name="location-off" size={16} color="#EF4444" />
                  <View className="flex-1 ml-2">
                    <Text className="text-red-700 text-xs font-JakartaBold mb-0.5">{t("outsideServiceArea")}</Text>
                    <Text className="text-red-600 text-xs font-JakartaMedium">{dropError}</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Service area hint when both invalid */}
            {!isSuggestionListOpen && (pickupStatus === 'invalid' || dropStatus === 'invalid') && serviceAreas.length > 0 && (
              <View className="mt-4 bg-orange-50 border border-orange-200 rounded-xl p-4">
                <View className="flex-row items-center mb-2">
                  <MaterialIcons name="place" size={16} color="#F97316" />
                  <Text className="ml-2 text-sm font-JakartaBold text-orange-800">{t("availableServiceAreas")}</Text>
                </View>
                <View className="flex-row flex-wrap gap-2">
                  {serviceAreas.slice(0, 5).map(area => (
                    <View key={area.id} className="bg-orange-100 px-3 py-1 rounded-full">
                      <Text className="text-orange-700 text-xs font-JakartaMedium">{area.city}, {area.state}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
              </View>

            {!isSuggestionListOpen && (
            <View className="mt-6">
               {/* Next button with contextual message */}
               <CustomButton
                 title={
                   !userAddress ? t("enterPickupLocation") :
                   !destinationAddress ? t("enterDropLocation") :
                   pickupStatus === 'checking' || dropStatus === 'checking' ? t("validatingLocations") :
                   pickupStatus === 'invalid' ? t("changePickupSupported") :
                   dropStatus === 'invalid' ? t("changeDropSupported") :
                   t("nextReceiverDetails")
                 }
                 onPress={handleNext}
                 testID="ride.nextToReceiverDetails"
                 accessibilityLabel="ride.nextToReceiverDetails"
                 bgVariant={canProceed ? "primary" : "secondary"}
                 disabled={!canProceed}
               />
            </View>
            )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </GestureHandlerRootView>
  );
};

export default FindRide;
