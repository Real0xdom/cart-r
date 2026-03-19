import { useAuth } from "@/contexts/AuthContext";
import { Image, Text, View, TouchableOpacity, ScrollView } from "react-native";
import { useState } from "react";

import RideLayout from "@/components/RideLayout";
import { icons } from "@/constants";
import { formatTime } from "@/lib/utils";
import { useDriverStore, useLocationStore } from "@/store";
import CashfreePayment from "@/components/CashfreePayment";

const BookRide = () => {
  const { profile } = useAuth();
  const { userAddress, destinationAddress } = useLocationStore();
  const { drivers, selectedDriver } = useDriverStore();
  
  const [scheduledOffset, setScheduledOffset] = useState<number | null>(null);

  const driverDetails = drivers?.filter(
    (driver) => driver.id === selectedDriver,
  )[0];



  /*
   * Calculate random distance/duration for demo purposes if not available
   * In a real app, this would come from the map/directions API
   */
  const estimatedDistance = 12.5; // km
  const estimatedDuration = 25; // mins

  let scheduledAt: string | undefined = undefined;
  if (scheduledOffset) {
    const d = new Date();
    d.setMinutes(d.getMinutes() + scheduledOffset);
    scheduledAt = d.toISOString();
  }

  return (
    <RideLayout title="Book Ride">
      <>
        <Text className="text-xl font-JakartaSemiBold mb-3">
          Ride Information
        </Text>

        <View className="flex flex-col w-full items-center justify-center mt-10">
          <Image
            source={{ uri: driverDetails?.profile_image_url }}
            className="w-28 h-28 rounded-full"
          />

          <View className="flex flex-row items-center justify-center mt-5 space-x-2">
            <Text className="text-lg font-JakartaSemiBold">
              {driverDetails?.title}
            </Text>

            <View className="flex flex-row items-center space-x-0.5">
              <Image
                source={icons.star}
                className="w-5 h-5"
                resizeMode="contain"
              />
              <Text className="text-lg font-JakartaRegular">
                {driverDetails?.rating}
              </Text>
            </View>
          </View>
        </View>

        <View className="flex flex-col w-full items-start justify-center py-3 px-5 rounded-3xl bg-general-600 mt-5">
          <View className="flex flex-row items-center justify-between w-full border-b border-white py-3">
            <Text className="text-lg font-JakartaRegular">Ride Price</Text>
            <Text className="text-lg font-JakartaRegular text-[#0CC25F]">
              ₹{driverDetails?.price}
            </Text>
          </View>

          <View className="flex flex-row items-center justify-between w-full border-b border-white py-3">
            <Text className="text-lg font-JakartaRegular">Pickup Time</Text>
            <Text className="text-lg font-JakartaRegular">
              {formatTime(parseInt(`${driverDetails?.time}`) || 5)}
            </Text>
          </View>

          <View className="flex flex-row items-center justify-between w-full py-3">
            <Text className="text-lg font-JakartaRegular">Vehicle Type</Text>
            <Text className="text-lg font-JakartaRegular">
              {driverDetails?.car_seats} Seater
            </Text>
          </View>
        </View>

        <View className="flex flex-col w-full items-start justify-center mt-5">
          <View className="flex flex-row items-center justify-start mt-3 border-t border-b border-general-700 w-full py-3">
            <Image source={icons.to} className="w-6 h-6" />
            <Text className="text-lg font-JakartaRegular ml-2">
              {userAddress}
            </Text>
          </View>

          <View className="flex flex-row items-center justify-start border-b border-general-700 w-full py-3">
            <Image source={icons.point} className="w-6 h-6" />
            <Text className="text-lg font-JakartaRegular ml-2">
              {destinationAddress}
            </Text>
          </View>
        </View>

        {/* Schedule Ride Options */}
        <View className="mt-5 mb-2 w-full">
          <Text className="text-lg font-JakartaSemiBold mb-3">Schedule Ride</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
            <TouchableOpacity
              onPress={() => setScheduledOffset(null)}
              className={`px-5 py-2 rounded-full mr-3 ${scheduledOffset === null ? 'bg-primary-500' : 'bg-gray-200'}`}
            >
              <Text className={`font-JakartaSemiBold ${scheduledOffset === null ? 'text-white' : 'text-gray-700'}`}>Now</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setScheduledOffset(30)}
              className={`px-5 py-2 rounded-full mr-3 ${scheduledOffset === 30 ? 'bg-primary-500' : 'bg-gray-200'}`}
            >
              <Text className={`font-JakartaSemiBold ${scheduledOffset === 30 ? 'text-white' : 'text-gray-700'}`}>+30 Min</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setScheduledOffset(60)}
              className={`px-5 py-2 rounded-full mr-3 ${scheduledOffset === 60 ? 'bg-primary-500' : 'bg-gray-200'}`}
            >
              <Text className={`font-JakartaSemiBold ${scheduledOffset === 60 ? 'text-white' : 'text-gray-700'}`}>+1 Hour</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setScheduledOffset(120)}
              className={`px-5 py-2 rounded-full mr-3 ${scheduledOffset === 120 ? 'bg-primary-500' : 'bg-gray-200'}`}
            >
              <Text className={`font-JakartaSemiBold ${scheduledOffset === 120 ? 'text-white' : 'text-gray-700'}`}>+2 Hours</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Cashfree Payment Component */}
        <CashfreePayment
          amount={Number(driverDetails?.price) || 0}
          vehicleType="sedan" // Default to sedan or map from driverDetails
          estimatedDistance={estimatedDistance}
          estimatedDuration={estimatedDuration}
          driverId={driverDetails?.id ? String(driverDetails.id) : undefined}
          scheduledAt={scheduledAt}
        />
      </>
    </RideLayout>
  );
};

export default BookRide;
