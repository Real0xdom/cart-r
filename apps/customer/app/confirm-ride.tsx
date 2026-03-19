import CustomButton from "@/components/CustomButton";
import DriverCard from "@/components/DriverCard";
import RideLayout from "@/components/RideLayout";
import { useDriverStore, useRideStore } from "@/store";
import { router } from "expo-router";
import { FlatList, Text, View } from "react-native";
import { useState } from "react";

const ConfirmRide = () => {
  const { drivers: storeDrivers, selectedDriver, setSelectedDriver } = useDriverStore();
  const { selectedVehicle } = useRideStore();
  const [isNavigating, setIsNavigating] = useState(false);
  
  const drivers = storeDrivers.map(d => ({
    ...d,
    price: selectedVehicle?.total_fare.toString() || d.price || '0',
    time: selectedVehicle?.duration_minutes || d.time || 5,
  } as any));

  const handleSelectRide = () => {
    if (isNavigating) return;
    setIsNavigating(true);
    // Tiny delay to show visual feedback if needed, but mainly to lock
    router.push("/book-ride");
    // We don't need to reset isNavigating because we're moving away. 
    // If user comes back, component re-mounts (or we can use useFocusEffect to reset, 
    // but in stack nav, coming back usually preserves state. 
    // However, for "push", safer to timeout reset just in case nav fails or is cancelled? 
    // Expo Router push usually succeeds. 
    setTimeout(() => setIsNavigating(false), 1000); 
  };

  return (
    <RideLayout title="Choose a driver" snapPoints={["65%", "85%"]} useView={true}>
      <View className="mb-4 bg-blue-50 p-3 rounded-xl flex-row items-center justify-between">
         <View>
            <Text className="text-gray-500 font-JakartaMedium text-xs">Selected Vehicle</Text>
            <Text className="text-gray-900 font-JakartaBold capitalize">{selectedVehicle?.vehicle_type || 'Standard'}</Text>
         </View>
         <Text className="text-blue-600 font-JakartaBold text-lg">₹{selectedVehicle?.total_fare || 0}</Text>
      </View>

      <FlatList
        data={drivers}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <DriverCard
            selected={selectedDriver!}
            setSelected={() => setSelectedDriver(item.id)}
            item={item}
          />
        )}
        ListEmptyComponent={() => (
          <View className="mx-5 mt-8 bg-gray-50 p-4 rounded-xl">
            <Text className="text-gray-800 font-JakartaSemiBold">No live drivers available</Text>
            <Text className="text-gray-500 font-JakartaMedium mt-1">
              We are only showing real nearby drivers now. Try again in a moment.
            </Text>
          </View>
        )}
        ListFooterComponent={() => (
          <View className="mx-5 mt-10">
            <CustomButton
              title="Select Ride"
              onPress={handleSelectRide}
              disabled={isNavigating || drivers.length === 0}
            />
          </View>
        )}
      />
    </RideLayout>
  );
};

export default ConfirmRide;

