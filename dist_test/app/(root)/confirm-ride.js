"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const expo_router_1 = require("expo-router");
const react_native_1 = require("react-native");
const CustomButton_1 = __importDefault(require("@/components/CustomButton"));
const DriverCard_1 = __importDefault(require("@/components/DriverCard"));
const RideLayout_1 = __importDefault(require("@/components/RideLayout"));
const store_1 = require("@/store");
const ConfirmRide = () => {
    const { drivers, selectedDriver, setSelectedDriver } = (0, store_1.useDriverStore)();
    return (<RideLayout_1.default title={"Choose a Rider"} snapPoints={["65%", "85%"]}>
      <react_native_1.FlatList data={drivers} keyExtractor={(item, index) => index.toString()} renderItem={({ item, index }) => (<DriverCard_1.default item={item} selected={selectedDriver} setSelected={() => setSelectedDriver(item.id)}/>)} ListFooterComponent={() => (<react_native_1.View className="mx-5 mt-10">
            <CustomButton_1.default title="Select Ride" onPress={() => expo_router_1.router.push("/(root)/book-ride")}/>
          </react_native_1.View>)}/>
    </RideLayout_1.default>);
};
exports.default = ConfirmRide;
