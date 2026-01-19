"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_native_1 = require("react-native");
const constants_1 = require("@/constants");
const utils_1 = require("@/lib/utils");
const RideCard = ({ ride }) => {
    return (<react_native_1.View className="flex flex-row items-center justify-center bg-white rounded-lg shadow-sm shadow-neutral-300 mb-3">
      <react_native_1.View className="flex flex-col items-start justify-center p-3">
        <react_native_1.View className="flex flex-row items-center justify-between">
          <react_native_1.Image source={{
            uri: `https://maps.geoapify.com/v1/staticmap?style=osm-bright&width=600&height=400&center=lonlat:${ride.destination_longitude},${ride.destination_latitude}&zoom=14&apiKey=${process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY}`,
        }} className="w-[80px] h-[90px] rounded-lg"/>

          <react_native_1.View className="flex flex-col mx-5 gap-y-5 flex-1">
            <react_native_1.View className="flex flex-row items-center gap-x-2">
              <react_native_1.Image source={constants_1.icons.to} className="w-5 h-5"/>
              <react_native_1.Text className="text-md font-JakartaMedium" numberOfLines={1}>
                {ride.origin_address}
              </react_native_1.Text>
            </react_native_1.View>

            <react_native_1.View className="flex flex-row items-center gap-x-2">
              <react_native_1.Image source={constants_1.icons.point} className="w-5 h-5"/>
              <react_native_1.Text className="text-md font-JakartaMedium" numberOfLines={1}>
                {ride.destination_address}
              </react_native_1.Text>
            </react_native_1.View>
          </react_native_1.View>
        </react_native_1.View>

        <react_native_1.View className="flex flex-col w-full mt-5 bg-general-500 rounded-lg p-3 items-start justify-center">
          <react_native_1.View className="flex flex-row items-center w-full justify-between mb-5">
            <react_native_1.Text className="text-md font-JakartaMedium text-gray-500">
              Date & Time
            </react_native_1.Text>
            <react_native_1.Text className="text-md font-JakartaBold" numberOfLines={1}>
              {(0, utils_1.formatDate)(ride.created_at)}, {(0, utils_1.formatTime)(ride.ride_time)}
            </react_native_1.Text>
          </react_native_1.View>

          <react_native_1.View className="flex flex-row items-center w-full justify-between mb-5">
            <react_native_1.Text className="text-md font-JakartaMedium text-gray-500">
              Driver
            </react_native_1.Text>
            <react_native_1.Text className="text-md font-JakartaBold">
              {ride.driver.first_name} {ride.driver.last_name}
            </react_native_1.Text>
          </react_native_1.View>

          <react_native_1.View className="flex flex-row items-center w-full justify-between mb-5">
            <react_native_1.Text className="text-md font-JakartaMedium text-gray-500">
              Car Seats
            </react_native_1.Text>
            <react_native_1.Text className="text-md font-JakartaBold">
              {ride.driver.car_seats}
            </react_native_1.Text>
          </react_native_1.View>

          <react_native_1.View className="flex flex-row items-center w-full justify-between">
            <react_native_1.Text className="text-md font-JakartaMedium text-gray-500">
              Payment Status
            </react_native_1.Text>
            <react_native_1.Text className={`text-md capitalize font-JakartaBold ${ride.payment_status === "paid" ? "text-green-500" : "text-red-500"}`}>
              {ride.payment_status}
            </react_native_1.Text>
          </react_native_1.View>
        </react_native_1.View>
      </react_native_1.View>
    </react_native_1.View>);
};
exports.default = RideCard;
