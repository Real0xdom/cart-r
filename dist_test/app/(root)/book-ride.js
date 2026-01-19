"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const clerk_expo_1 = require("@clerk/clerk-expo");
const stripe_react_native_1 = require("@stripe/stripe-react-native");
const react_native_1 = require("react-native");
const Payment_1 = __importDefault(require("@/components/Payment"));
const RideLayout_1 = __importDefault(require("@/components/RideLayout"));
const constants_1 = require("@/constants");
const utils_1 = require("@/lib/utils");
const store_1 = require("@/store");
const BookRide = () => {
    const { user } = (0, clerk_expo_1.useUser)();
    const { userAddress, destinationAddress } = (0, store_1.useLocationStore)();
    const { drivers, selectedDriver } = (0, store_1.useDriverStore)();
    const driverDetails = drivers === null || drivers === void 0 ? void 0 : drivers.filter((driver) => +driver.id === selectedDriver)[0];
    return (<stripe_react_native_1.StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY} merchantIdentifier="merchant.com.uber" urlScheme="myapp">
      <RideLayout_1.default title="Book Ride">
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
                ${driverDetails === null || driverDetails === void 0 ? void 0 : driverDetails.price}
              </react_native_1.Text>
            </react_native_1.View>

            <react_native_1.View className="flex flex-row items-center justify-between w-full border-b border-white py-3">
              <react_native_1.Text className="text-lg font-JakartaRegular">Pickup Time</react_native_1.Text>
              <react_native_1.Text className="text-lg font-JakartaRegular">
                {(0, utils_1.formatTime)(driverDetails === null || driverDetails === void 0 ? void 0 : driverDetails.time)}
              </react_native_1.Text>
            </react_native_1.View>

            <react_native_1.View className="flex flex-row items-center justify-between w-full py-3">
              <react_native_1.Text className="text-lg font-JakartaRegular">Car Seats</react_native_1.Text>
              <react_native_1.Text className="text-lg font-JakartaRegular">
                {driverDetails === null || driverDetails === void 0 ? void 0 : driverDetails.car_seats}
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

          <Payment_1.default fullName={user === null || user === void 0 ? void 0 : user.fullName} email={user === null || user === void 0 ? void 0 : user.emailAddresses[0].emailAddress} amount={driverDetails === null || driverDetails === void 0 ? void 0 : driverDetails.price} driverId={driverDetails === null || driverDetails === void 0 ? void 0 : driverDetails.id} rideTime={driverDetails === null || driverDetails === void 0 ? void 0 : driverDetails.time}/>
        </>
      </RideLayout_1.default>
    </stripe_react_native_1.StripeProvider>);
};
exports.default = BookRide;
