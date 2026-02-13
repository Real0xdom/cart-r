import CustomButton from "@/components/CustomButton";
import GoogleTextInput from "@/components/GoogleTextInput";
import RideLayout from "@/components/RideLayout";
import { icons } from "@/constants";
import { useLocation } from "@/contexts/LocationContext";
import { useLocationStore } from "@/store";
import { router } from "expo-router";
import { useState, useCallback, useEffect } from "react";
import { Text, View, TouchableOpacity, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { isLocationSupported } from "@/lib/serviceArea";

const FindRide = () => {
  const {
    userAddress,
    destinationAddress,
    setDestinationLocation,
    setUserLocation,
  } = useLocationStore();

  const { getCurrentLocation, isLoadingLocation } = useLocation();

  const [selectingOnMap, setSelectingOnMap] = useState<'from' | 'to' | null>(null);
  const [fetchingLocation, setFetchingLocation] = useState(false);

  const handleUseCurrentLocation = useCallback(async () => {
    setFetchingLocation(true);
    try {
      await getCurrentLocation();
      // Note: Location validation happens in useEffect when userLatitude/userLongitude changes
    } catch (error) {
      console.error("Error fetching current location:", error);
    } finally {
      setFetchingLocation(false);
    }
  }, [getCurrentLocation]);

  const handleSelectOnMap = (field: 'from' | 'to') => {
    if (selectingOnMap === field) {
      setSelectingOnMap(null);
    } else {
      setSelectingOnMap(field);
    }
  };

  const handleMapLocationSelected = useCallback(() => {
    setSelectingOnMap(null);
  }, []);

  const handleCancelSelection = useCallback(() => {
    setSelectingOnMap(null);
  }, []);

  const handleNext = () => {
    if (userAddress && destinationAddress) {
      // Service area already validated - proceed to receiver details
      router.push("/receiver-details");
    }
  };

  // Validate service area when user location changes
  useEffect(() => {
    const validateServiceArea = async () => {
      if (!userAddress) return; // No location selected yet

      const { userLatitude, userLongitude } = useLocationStore.getState();
      if (!userLatitude || !userLongitude) return;

      console.log('[FIND RIDE] Checking service area for:', userAddress);
      const result = await isLocationSupported(userLatitude, userLongitude);

      if (!result.supported && !result.error) {
        // Location is not supported - show friendly message
        console.log('[FIND RIDE] Location not supported, redirecting to notification screen');
        router.replace('/service-not-available');
      } else if (result.supported) {
        console.log('[FIND RIDE] Location is supported:', result.area?.name);
      }
    };

    validateServiceArea();
  }, [userAddress]); // Check whenever pickup address changes

  const isLoading = isLoadingLocation || fetchingLocation;
  const canProceed = userAddress && destinationAddress;

  return (
    <RideLayout 
      title="Select Locations" 
      snapPoints={["15%", "50%", "85%"]}
      mapSelectionMode={selectingOnMap}
      onMapLocationSelected={handleMapLocationSelected}
      useView={true}
    >
      {/* From Field */}
      <View className="my-3">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center">
            <View className="w-6 h-6 bg-green-500 rounded-full items-center justify-center mr-2">
              <Text className="text-white text-xs font-JakartaBold">1</Text>
            </View>
            <Text className="text-lg font-JakartaSemiBold">Pickup Location</Text>
          </View>
          {isLoading && (
            <ActivityIndicator size="small" color="#FF9800" />
          )}
        </View>
        
        <GoogleTextInput
          icon={icons.target}
          initialLocation={userAddress ?? undefined}
          containerStyle="bg-neutral-100"
          textInputBackgroundColor="#f5f5f5"
          handlePress={(location) => setUserLocation(location)}
        />
        
        <View className="flex-row items-center justify-between mt-2 px-2">
          <TouchableOpacity 
            onPress={handleUseCurrentLocation}
            className="flex-row items-center py-2"
            disabled={isLoading}
          >
            <Feather name="navigation" size={16} color="#FF9800" />
            <Text className="ml-2 text-sm font-JakartaMedium text-blue-500">
              Use current location
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={() => handleSelectOnMap('from')}
            className={`flex-row items-center py-2 px-3 rounded-lg ${selectingOnMap === 'from' ? 'bg-blue-500' : 'bg-gray-100'}`}
          >
            <Feather name="map-pin" size={16} color={selectingOnMap === 'from' ? '#fff' : '#777'} />
            <Text className={`ml-2 text-sm font-JakartaMedium ${selectingOnMap === 'from' ? 'text-white' : 'text-gray-600'}`}>
              {selectingOnMap === 'from' ? 'Selecting...' : 'Select on map'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* To Field */}
      <View className="my-3">
        <View className="flex-row items-center mb-3">
          <View className="w-6 h-6 bg-red-500 rounded-full items-center justify-center mr-2">
            <Text className="text-white text-xs font-JakartaBold">2</Text>
          </View>
          <Text className="text-lg font-JakartaSemiBold">Drop Location</Text>
        </View>
        
        <GoogleTextInput
          icon={icons.target}
          initialLocation={destinationAddress ?? undefined}
          containerStyle="bg-neutral-100"
          textInputBackgroundColor="transparent"
          handlePress={(location) => setDestinationLocation(location)}
        />
        
        <View className="flex-row items-center justify-end mt-2 px-2">
          <TouchableOpacity 
            onPress={() => handleSelectOnMap('to')}
            className={`flex-row items-center py-2 px-3 rounded-lg ${selectingOnMap === 'to' ? 'bg-blue-500' : 'bg-gray-100'}`}
          >
            <Feather name="map-pin" size={16} color={selectingOnMap === 'to' ? '#fff' : '#777'} />
            <Text className={`ml-2 text-sm font-JakartaMedium ${selectingOnMap === 'to' ? 'text-white' : 'text-gray-600'}`}>
              {selectingOnMap === 'to' ? 'Selecting...' : 'Select on map'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Info message when selecting on map */}
      {selectingOnMap && (
        <View className="bg-blue-100 p-4 rounded-xl mb-4 flex-row items-center">
          <Feather name="info" size={18} color="#FF9800" />
          <Text className="ml-3 text-sm font-JakartaMedium text-blue-700 flex-1">
            Drag the sheet down and tap on the map to select your {selectingOnMap === 'from' ? 'pickup' : 'drop'} location
          </Text>
          <TouchableOpacity onPress={handleCancelSelection} className="bg-blue-500 rounded-full p-1">
            <Feather name="x" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      )}



      <CustomButton
        title={canProceed ? "Next: Receiver Details →" : "Enter both locations"}
        onPress={handleNext}
        className="mt-4"
        bgVariant={canProceed ? "primary" : "secondary"}
        disabled={!canProceed}
      />

      {/* Optional: Show service area info */}
      <View className="mt-4 p-3 bg-green-50 rounded-xl border border-green-100">
        <View className="flex-row items-center">
          <Feather name="check-circle" size={16} color="#4CAF50" />
          <Text className="ml-2 text-xs text-green-700 font-JakartaMedium">
            Location validated for service availability
          </Text>
        </View>
      </View>
    </RideLayout>
  );
};

export default FindRide;
