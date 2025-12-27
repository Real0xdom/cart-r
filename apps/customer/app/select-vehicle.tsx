import CustomButton from "@/components/CustomButton";
import RideLayout from "@/components/RideLayout";
import { useLocationStore, useRideStore } from "@/store";
import { router } from "expo-router";
import { useState, useEffect } from "react";
import { 
  Text, 
  View, 
  TouchableOpacity, 
  ScrollView,
  ActivityIndicator,
  Image,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { calculateFares, FareEstimate } from "@/lib/fare";
import { icons } from "@/constants";

const SelectVehiclePage = () => {
  const {
    userLatitude,
    userLongitude,
    destinationLatitude,
    destinationLongitude,
    destinationAddress,
  } = useLocationStore();
  
  const { setSelectedVehicle, selectedVehicle } = useRideStore();

  const [fares, setFares] = useState<FareEstimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      } catch (err) {
        console.error(err);
        setError("Failed to load vehicle options. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchFares();
  }, [userLatitude, userLongitude, destinationLatitude, destinationLongitude]);

  const handleSelectVehicle = (vehicle: FareEstimate) => {
    setSelectedVehicle(vehicle);
  };

  const handleProceed = () => {
    if (selectedVehicle) {
      router.push("/confirm-booking");
    }
  };

  const getVehicleIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'bike': return '🛵'; // Placeholder until images are loaded
      case 'auto': return '🛺';
      case 'mini': return '🚗';
      case 'sedan': return '🚘';
      case 'suv': return '🚙';
      case 'truck': return '🚚';
      default: return '🚗';
    }
  };

  const getVehicleDescription = (type: string) => {
    switch (type.toLowerCase()) {
      case 'bike': return 'Best for small packages up to 20kg';
      case 'auto': return 'Good for medium loads up to 100kg';
      case 'mini': return 'For furniture & appliances';
      case 'sedan': return 'Comfortable ride for 4 people';
      case 'suv': return 'Luxury & Space for 6 people';
      case 'truck': return 'Large cargo moving';
      default: return 'Standard ride';
    }
  };

  // Helper to map vehicle type to icon from constants if available
  const getIconSource = (type: string) => {
      // You can map these to your actual image assets
      return icons.car; // Fallback to generic car icon for now
  };

  return (
    <RideLayout 
      title="Step 3: Select Vehicle" 
      snapPoints={["40%", "85%"]}
    >
        {/* Drop Location Summary */}
        <View className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
          <View className="flex-row items-center">
            <View className="bg-red-500 rounded-full p-1.5 mr-3">
              <Feather name="map-pin" size={12} color="#fff" />
            </View>
            <Text className="text-sm font-JakartaMedium text-gray-800 flex-1" numberOfLines={1}>
              {destinationAddress || 'Drop Location'}
            </Text>
          </View>
        </View>

        <Text className="text-xl font-JakartaBold text-gray-800 mb-4">
          Available Vehicles
        </Text>

        {loading ? (
             <View className="items-center justify-center py-10">
                <ActivityIndicator size="large" color="#0286FF" />
                <Text className="text-gray-500 mt-2 font-JakartaMedium">Calculating best fares...</Text>
             </View>
        ) : error ? (
            <View className="items-center justify-center py-10">
                <Text className="text-red-500 font-JakartaMedium text-center mb-4">{error}</Text>
                <CustomButton title="Retry" onPress={() => setFares([])} bgVariant="outline" />
            </View>
        ) : (
            <ScrollView showsVerticalScrollIndicator={false} className="mb-20">
                {fares.map((item) => (
                    <TouchableOpacity
                        key={item.vehicle_type}
                        onPress={() => handleSelectVehicle(item)}
                        className={`flex-row items-center p-4 mb-3 rounded-2xl border ${
                            selectedVehicle?.vehicle_type === item.vehicle_type
                                ? 'bg-blue-50 border-blue-500 shadow-sm'
                                : 'bg-white border-gray-100'
                        }`}
                    >
                        <View className="w-14 h-14 bg-gray-50 rounded-full items-center justify-center mr-4">
                           {/* Replace with actual Image component when assets are ready */}
                           <Text className="text-2xl">{getVehicleIcon(item.vehicle_type)}</Text>
                        </View>
                        
                        <View className="flex-1">
                            <Text className="text-lg font-JakartaBold capitalize text-gray-900">
                                {item.vehicle_type}
                            </Text>
                            <Text className="text-xs text-gray-500 font-JakartaMedium mt-0.5">
                                {getVehicleDescription(item.vehicle_type)}
                            </Text>
                            <View className="flex-row items-center mt-1">
                                <Feather name="clock" size={12} color="#777" />
                                <Text className="text-xs text-gray-500 ml-1">
                                    {item.duration_minutes} min • {item.distance_km} km
                                </Text>
                            </View>
                        </View>

                        <View className="items-end">
                            <Text className="text-lg font-JakartaBold text-gray-900">
                                ₹{item.total_fare}
                            </Text>
                            {selectedVehicle?.vehicle_type === item.vehicle_type && (
                                <View className="bg-blue-500 rounded-full p-1 mt-1">
                                    <Feather name="check" size={12} color="#fff" />
                                </View>
                            )}
                        </View>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        )}

      <View className="absolute bottom-0 left-0 right-0 bg-white p-5 border-t border-gray-100">
        {/* Progress indicator */}
        <View className="flex-row items-center justify-center mb-4">
          <View className="w-3 h-3 bg-green-500 rounded-full" />
          <View className="w-8 h-0.5 bg-green-500 mx-1" />
          <View className="w-3 h-3 bg-green-500 rounded-full" />
          <View className="w-8 h-0.5 bg-green-500 mx-1" />
          <View className="w-3 h-3 bg-blue-500 rounded-full" />
        </View>

         <View className="flex-row gap-3">
          <TouchableOpacity 
            onPress={() => router.back()}
            className="flex-1 bg-gray-100 py-4 rounded-xl items-center flex-row justify-center"
          >
            <Feather name="arrow-left" size={18} color="#333" />
            <Text className="ml-2 font-JakartaSemiBold text-gray-700">Back</Text>
          </TouchableOpacity>
          
          <CustomButton
            title="Confirm & Find Driver"
            onPress={handleProceed}
            className="flex-[2]"
            disabled={!selectedVehicle}
            bgVariant={selectedVehicle ? "primary" : "secondary"}
          />
        </View>
      </View>
    </RideLayout>
  );
};

export default SelectVehiclePage;
