"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const AuthContext_1 = require("@/contexts/AuthContext");
const react_native_1 = require("react-native");
const RideLayout_1 = __importDefault(require("@/components/RideLayout"));
const constants_1 = require("@/constants");
const utils_1 = require("@/lib/utils");
const store_1 = require("@/store");
const CashfreePayment_1 = __importDefault(require("@/components/CashfreePayment"));
const BookRide = () => {
    const { profile } = (0, AuthContext_1.useAuth)();
    const { userAddress, destinationAddress } = (0, store_1.useLocationStore)();
    const { drivers, selectedDriver } = (0, store_1.useDriverStore)();
    const driverDetails = drivers === null || drivers === void 0 ? void 0 : drivers.filter((driver) => +driver.id === selectedDriver)[0];
    /*
     * Calculate random distance/duration for demo purposes if not available
     * In a real app, this would come from the map/directions API
     */
    const estimatedDistance = 12.5; // km
    const estimatedDuration = 25; // mins
    return (<RideLayout_1.default title="Book Ride">
      <>
        <react_native_1.Text className="text-xl font-JakartaSemiBold mb-3">
          Ride Information
        </react_native_1.Text>

        <react_native_1.View className="flex flex-col w-full items-center justify-center mt-10">
          <react_native_1.Image source={{ uri: driverDetails === null || driverDetails === void 0 ? void 0 : driverDetails.profile_image_url }} className="w-28 h-28 rounded-full"/>

          <react_native_1.View className="flex flex-row items-center justify-center mt-5 space-x-2">
            <react_native_1.Text className="text-lg font-JakartaSemiBold">
              {driverDetails === null || driverDetails === void 0 ? void 0 : driverDetails.title}
            </react_native_1.Text>

            <react_native_1.View className="flex flex-row items-center space-x-0.5">
              <react_native_1.Image source={constants_1.icons.star} className="w-5 h-5" resizeMode="contain"/>
              <react_native_1.Text className="text-lg font-JakartaRegular">
                {driverDetails === null || driverDetails === void 0 ? void 0 : driverDetails.rating}
              </react_native_1.Text>
            </react_native_1.View>
          </react_native_1.View>
        </react_native_1.View>

        <react_native_1.View className="flex flex-col w-full items-start justify-center py-3 px-5 rounded-3xl bg-general-600 mt-5">
          <react_native_1.View className="flex flex-row items-center justify-between w-full border-b border-white py-3">
            <react_native_1.Text className="text-lg font-JakartaRegular">Ride Price</react_native_1.Text>
            <react_native_1.Text className="text-lg font-JakartaRegular text-[#0CC25F]">
              ₹{driverDetails === null || driverDetails === void 0 ? void 0 : driverDetails.price}
            </react_native_1.Text>
          </react_native_1.View>

          <react_native_1.View className="flex flex-row items-center justify-between w-full border-b border-white py-3">
            <react_native_1.Text className="text-lg font-JakartaRegular">Pickup Time</react_native_1.Text>
            <react_native_1.Text className="text-lg font-JakartaRegular">
              {(0, utils_1.formatTime)(parseInt(`${driverDetails === null || driverDetails === void 0 ? void 0 : driverDetails.time}`) || 5)}
            </react_native_1.Text>
          </react_native_1.View>

          <react_native_1.View className="flex flex-row items-center justify-between w-full py-3">
            <react_native_1.Text className="text-lg font-JakartaRegular">Vehicle Type</react_native_1.Text>
            <react_native_1.Text className="text-lg font-JakartaRegular">
              {driverDetails === null || driverDetails === void 0 ? void 0 : driverDetails.car_seats} Seater
            </react_native_1.Text>
          </react_native_1.View>
        </react_native_1.View>

        <react_native_1.View className="flex flex-col w-full items-start justify-center mt-5">
          <react_native_1.View className="flex flex-row items-center justify-start mt-3 border-t border-b border-general-700 w-full py-3">
            <react_native_1.Image source={constants_1.icons.to} className="w-6 h-6"/>
            <react_native_1.Text className="text-lg font-JakartaRegular ml-2">
              {userAddress}
            </react_native_1.Text>
          </react_native_1.View>

          <react_native_1.View className="flex flex-row items-center justify-start border-b border-general-700 w-full py-3">
            <react_native_1.Image source={constants_1.icons.point} className="w-6 h-6"/>
            <react_native_1.Text className="text-lg font-JakartaRegular ml-2">
              {destinationAddress}
            </react_native_1.Text>
          </react_native_1.View>
        </react_native_1.View>

        {/* Cashfree Payment Component */}
        <CashfreePayment_1.default amount={Number(driverDetails === null || driverDetails === void 0 ? void 0 : driverDetails.price) || 0} vehicleType="sedan" // Default to sedan or map from driverDetails
     estimatedDistance={estimatedDistance} estimatedDuration={estimatedDuration} driverId={(driverDetails === null || driverDetails === void 0 ? void 0 : driverDetails.id) ? String(driverDetails.id) : undefined}/>
      </>
    </RideLayout_1.default>);
};
exports.default = BookRide;
