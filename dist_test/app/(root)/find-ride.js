"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const expo_router_1 = require("expo-router");
const react_native_1 = require("react-native");
const CustomButton_1 = __importDefault(require("@/components/CustomButton"));
const GoogleTextInput_1 = __importDefault(require("@/components/GoogleTextInput"));
const RideLayout_1 = __importDefault(require("@/components/RideLayout"));
const constants_1 = require("@/constants");
const store_1 = require("@/store");
const FindRide = () => {
    const { userAddress, destinationAddress, setDestinationLocation, setUserLocation, } = (0, store_1.useLocationStore)();
    return (<RideLayout_1.default title="Ride">
      <react_native_1.View className="my-3">
        <react_native_1.Text className="text-lg font-JakartaSemiBold mb-3">From</react_native_1.Text>

        <GoogleTextInput_1.default icon={constants_1.icons.target} initialLocation={userAddress} containerStyle="bg-neutral-100" textInputBackgroundColor="#f5f5f5" handlePress={(location) => setUserLocation(location)}/>
      </react_native_1.View>

      <react_native_1.View className="my-3">
        <react_native_1.Text className="text-lg font-JakartaSemiBold mb-3">To</react_native_1.Text>

        <GoogleTextInput_1.default icon={constants_1.icons.map} initialLocation={destinationAddress} containerStyle="bg-neutral-100" textInputBackgroundColor="transparent" handlePress={(location) => setDestinationLocation(location)}/>
      </react_native_1.View>

      <CustomButton_1.default title="Find Now" onPress={() => expo_router_1.router.push(`/(root)/confirm-ride`)} className="mt-5"/>
    </RideLayout_1.default>);
};
exports.default = FindRide;
