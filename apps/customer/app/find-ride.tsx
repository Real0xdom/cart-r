import CustomButton from "@/components/CustomButton";
import GoogleTextInput from "@/components/GoogleTextInput";
import RideLayout from "@/components/RideLayout";
import { icons } from "@/constants";
import { useLocation } from "@/contexts/LocationContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLocationStore } from "@/store";
import { router } from "expo-router";
import { useState, useCallback, useEffect, useRef } from "react";
import { Text, View, TouchableOpacity, ActivityIndicator, Animated, ScrollView, TouchableWithoutFeedback, Keyboard } from "react-native";
import { Feather, MaterialIcons, Ionicons } from "@expo/vector-icons";
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
    destinationAddress,
    setDestinationLocation,
    setUserLocation,
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
    if (location.latitude && location.longitude) {
      validatePickup(location.latitude, location.longitude);
    }
  }, [setUserLocation, validatePickup]);

  // Handle drop selection
  const handleDropSelected = useCallback((location: { latitude: number; longitude: number; address: string }) => {
    setDestinationLocation(location);
    if (location.latitude && location.longitude) {
      validateDrop(location.latitude, location.longitude);
    }
  }, [setDestinationLocation, validateDrop]);

  useEffect(() => {
    const { userLatitude, userLongitude } = useLocationStore.getState();
    if (userLatitude && userLongitude && userAddress) {
      validatePickup(userLatitude, userLongitude);
    } else {
      setPickupStatus('idle');
    }
  }, [userAddress, validatePickup]);

  // Also validate when destination address changes (e.g. from map selection or saved addresses)
  useEffect(() => {
    const { destinationLatitude, destinationLongitude } = useLocationStore.getState();
    if (destinationLatitude && destinationLongitude && destinationAddress) {
      validateDrop(destinationLatitude, destinationLongitude);
    } else {
      setDropStatus('idle');
    }
  }, [destinationAddress, validateDrop]);

  const handleNext = () => {
    if (canProceed) {
      router.push("/receiver-details");
    }
  };

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

  return (
    <RideLayout
      title={t("selectLocations")}
      snapPoints={["15%", "50%", "85%"]}
      mapSelectionMode={selectingOnMap}
      onMapLocationSelected={handleMapLocationSelected}
      useView={false}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View 
        testID="ride.findRide" 
        accessibilityLabel="ride.findRide"
        style={{ overflow: 'visible' }}
      >
        {/* Pickup Field Section */}
        <View 
          className="my-3" 
          style={{ 
            zIndex: activeField === 'pickup' ? 1000 : 1,
            elevation: activeField === 'pickup' ? 20 : 0,
            overflow: 'visible'
          }}
        >
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <View className={`w-6 h-6 rounded-full items-center justify-center mr-2 ${
                pickupStatus === 'valid' ? 'bg-green-500' :
                pickupStatus === 'invalid' ? 'bg-red-500' : 'bg-green-500'
              }`}>
                <Text className="text-white text-xs font-JakartaBold">1</Text>
              </View>
              <Text className="text-lg font-JakartaSemiBold">{t("pickupLocation")}</Text>
            </View>
            {(isLoading || pickupStatus === 'checking') && (
              <ActivityIndicator size="small" color="#FF9800" />
            )}
            {pickupStatus === 'valid' && (
              <View className="flex-row items-center">
                <MaterialIcons name="check-circle" size={18} color="#4CAF50" />
                <Text className="text-green-600 text-xs font-JakartaMedium ml-1">{t("inServiceArea")}</Text>
              </View>
            )}
          </View>

          <Animated.View 
            style={{ 
              transform: [{ translateX: pickupShake }],
              zIndex: activeField === 'pickup' ? 1000 : 1,
            }}
          >
            <GoogleTextInput
              icon={icons.target}
              initialLocation={userAddress ?? undefined}
              containerStyle={`bg-neutral-100 ${pickupStatus === 'invalid' ? 'border border-red-300' : ''}`}
              textInputBackgroundColor="#f5f5f5"
              handlePress={handlePickupSelected}
              testID="ride.pickupInput"
              locationBias={locationBias}
              showAction={!!userAddress && pickupStatus === 'valid'}
              onActionPress={() => handleSavePlace('pickup')}
              actionIcon={savedAddresses.some(sa => sa.address === userAddress) ? "bookmark" : "bookmark-outline"}
              onFocus={() => setActiveField('pickup')}
              onBlur={() => setActiveField(null)}
            />
          </Animated.View>

          {/* Quick selection of saved addresses */}
          {savedAddresses.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2 pl-2">
              {savedAddresses.map((place) => (
                <TouchableOpacity
                  key={place.id}
                  onPress={() => handlePickupSelected({
                    latitude: Number(place.latitude),
                    longitude: Number(place.longitude),
                    address: place.address
                  })}
                  className="flex-row items-center bg-gray-50 border border-gray-100 rounded-full px-3 py-1.5 mr-2"
                >
                  <Ionicons name={getPlaceIoniconName(place.icon_type) as any} size={14} color="#FF9800" />
                  <Text className="ml-1.5 text-xs font-JakartaMedium text-gray-700">{place.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Pickup error banner */}
          {pickupStatus === 'invalid' && pickupError && (
              <View className="mt-2 mx-5 bg-red-50 border border-red-200 rounded-xl p-3 flex-row items-start">
              <MaterialIcons name="location-off" size={16} color="#EF4444" />
              <View className="flex-1 ml-2">
                <Text className="text-red-700 text-xs font-JakartaBold mb-0.5">{t("outsideServiceArea")}</Text>
                <Text className="text-red-600 text-xs font-JakartaMedium">{pickupError}</Text>
              </View>
            </View>
          )}

          <View className="flex-row items-center justify-between mt-2 px-2">
            <TouchableOpacity
              onPress={handleUseCurrentLocation}
              className="flex-row items-center py-2"
              disabled={isLoading}
            >
              <Feather name="navigation" size={16} color="#FF9800" />
              <Text className="ml-2 text-sm font-JakartaMedium text-blue-500">
                {t("useCurrentLocation")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleSelectOnMap('from')}
              className={`flex-row items-center py-2 px-3 rounded-lg ${selectingOnMap === 'from' ? 'bg-blue-500' : 'bg-gray-100'}`}
            >
              <Feather name="map-pin" size={16} color={selectingOnMap === 'from' ? '#fff' : '#777'} />
              <Text className={`ml-2 text-sm font-JakartaMedium ${selectingOnMap === 'from' ? 'text-white' : 'text-gray-600'}`}>
                {selectingOnMap === 'from' ? t("selecting") : t("selectOnMap")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Drop Field Section */}
        <View 
          className="my-3" 
          style={{ 
            zIndex: activeField === 'drop' ? 1000 : 1,
            elevation: activeField === 'drop' ? 20 : 0,
            overflow: 'visible'
          }}
        >
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <View className={`w-6 h-6 rounded-full items-center justify-center mr-2 ${
                dropStatus === 'valid' ? 'bg-green-500' :
                dropStatus === 'invalid' ? 'bg-red-500' : 'bg-red-500'
              }`}>
                <Text className="text-white text-xs font-JakartaBold">2</Text>
              </View>
              <Text className="text-lg font-JakartaSemiBold">{t("dropLocation")}</Text>
            </View>
            {dropStatus === 'checking' && (
              <ActivityIndicator size="small" color="#FF9800" />
            )}
            {dropStatus === 'valid' && (
              <View className="flex-row items-center">
                <MaterialIcons name="check-circle" size={18} color="#4CAF50" />
                <Text className="text-green-600 text-xs font-JakartaMedium ml-1">{t("inServiceArea")}</Text>
              </View>
            )}
          </View>

          <Animated.View 
            style={{ 
              transform: [{ translateX: dropShake }],
              zIndex: activeField === 'drop' ? 1000 : 1,
            }}
          >
            <GoogleTextInput
              icon={icons.target}
              initialLocation={destinationAddress ?? undefined}
              containerStyle={`bg-neutral-100 ${dropStatus === 'invalid' ? 'border border-red-300' : ''}`}
              textInputBackgroundColor="transparent"
              handlePress={handleDropSelected}
              testID="ride.dropInput"
              locationBias={locationBias}
              showAction={!!destinationAddress && dropOk}
              onActionPress={() => handleSavePlace('drop')}
              actionIcon={savedAddresses.some(sa => sa.address === destinationAddress) ? "bookmark" : "bookmark-outline"}
              onFocus={() => setActiveField('drop')}
              onBlur={() => setActiveField(null)}
            />
          </Animated.View>

          {/* Quick selection of saved addresses for drop */}
          {savedAddresses.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2 pl-2">
              {savedAddresses.map((place) => (
                <TouchableOpacity
                  key={place.id}
                  onPress={() => handleDropSelected({
                    latitude: Number(place.latitude),
                    longitude: Number(place.longitude),
                    address: place.address
                  })}
                  className="flex-row items-center bg-gray-50 border border-gray-100 rounded-full px-3 py-1.5 mr-2"
                >
                  <Ionicons name={getPlaceIoniconName(place.icon_type) as any} size={14} color="#FF9800" />
                  <Text className="ml-1.5 text-xs font-JakartaMedium text-gray-700">{place.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Drop error banner */}
          {dropStatus === 'invalid' && dropError && (
            <View className="mt-2 mx-5 bg-red-50 border border-red-200 rounded-xl p-3 flex-row items-start">
              <MaterialIcons name="location-off" size={16} color="#EF4444" />
              <View className="flex-1 ml-2">
                <Text className="text-red-700 text-xs font-JakartaBold mb-0.5">{t("outsideServiceArea")}</Text>
                <Text className="text-red-600 text-xs font-JakartaMedium">{dropError}</Text>
              </View>
            </View>
          )}

          <View className="flex-row items-center justify-end mt-2 px-2">
            <TouchableOpacity
              onPress={() => handleSelectOnMap('to')}
              className={`flex-row items-center py-2 px-3 rounded-lg ${selectingOnMap === 'to' ? 'bg-blue-500' : 'bg-gray-100'}`}
            >
              <Feather name="map-pin" size={16} color={selectingOnMap === 'to' ? '#fff' : '#777'} />
              <Text className={`ml-2 text-sm font-JakartaMedium ${selectingOnMap === 'to' ? 'text-white' : 'text-gray-600'}`}>
                {selectingOnMap === 'to' ? t("selecting") : t("selectOnMap")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Map selection hint */}
        {selectingOnMap && (
          <View className="bg-blue-100 p-4 rounded-xl mb-4 flex-row items-center">
            <Feather name="info" size={18} color="#FF9800" />
            <Text className="ml-3 text-sm font-JakartaMedium text-blue-700 flex-1">
              {selectingOnMap === 'from' ? t("mapHintPickup") : t("mapHintDrop")}
            </Text>
            <TouchableOpacity onPress={() => setSelectingOnMap(null)} className="bg-blue-500 rounded-full p-1">
              <Feather name="x" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Service area hint when both invalid */}
        {(pickupStatus === 'invalid' || dropStatus === 'invalid') && serviceAreas.length > 0 && (
          <View className="mx-0 mb-3 bg-orange-50 border border-orange-200 rounded-xl p-4">
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
          className="mt-4"
          bgVariant={canProceed ? "primary" : "secondary"}
          disabled={!canProceed}
        />
      </View>
      </TouchableWithoutFeedback>
    </RideLayout>
  );
};

export default FindRide;
