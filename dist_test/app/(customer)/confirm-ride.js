"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const CustomButton_1 = __importDefault(require("@/components/CustomButton"));
const DriverCard_1 = __importDefault(require("@/components/DriverCard"));
const RideLayout_1 = __importDefault(require("@/components/RideLayout"));
const store_1 = require("@/store");
const expo_router_1 = require("expo-router");
const react_native_1 = require("react-native");
const drivers = [
    {
        id: "1",
        first_name: "James",
        last_name: "Wilson",
        profile_image_url: "https://ucarecdn.com/dae59f69-2c1f-48c3-a883-017bcf0f9950/-/preview/1000x666/",
        car_image_url: "https://ucarecdn.com/a2dc52b2-8bf7-4e49-9a36-3ffb5229ed02/-/preview/465x466/",
        car_seats: 4,
        rating: "4.80",
    },
    {
        id: "2",
        first_name: "David",
        last_name: "Brown",
        profile_image_url: "https://ucarecdn.com/6ea6d83d-ef1a-483f-9106-837a3a5b3f67/-/preview/1000x666/",
        car_image_url: "https://ucarecdn.com/a3872f80-c094-409c-82f8-c9ff38429327/-/preview/930x932/",
        car_seats: 5,
        rating: "4.60",
    },
    {
        id: "3",
        first_name: "Michael",
        last_name: "Johnson",
        profile_image_url: "https://ucarecdn.com/0330d85c-232e-4c30-bd04-e5e4d0e3d688/-/preview/826x822/",
        car_image_url: "https://ucarecdn.com/289764fb-55b6-4427-b1d1-f655987b4a14/-/preview/930x932/",
        car_seats: 4,
        rating: "4.70",
    },
    {
        id: "4",
        first_name: "Robert",
        last_name: "Green",
        profile_image_url: "https://ucarecdn.com/fdfc54df-9d24-40f7-b7d3-6f391561c0db/-/preview/626x417/",
        car_image_url: "https://ucarecdn.com/b6fb3b55-7676-4ff3-8484-fb115e268d32/-/preview/930x932/",
        car_seats: 4,
        rating: "4.90",
    },
];
const ConfirmRide = () => {
    const { drivers, selectedDriver, setSelectedDriver } = (0, store_1.useDriverStore)();
    return (<RideLayout_1.default title="Choose a driver" snapPoints={["65%", "85%"]}>
      <react_native_1.FlatList data={drivers} renderItem={({ item }) => (<DriverCard_1.default selected={selectedDriver} setSelected={() => setSelectedDriver(Number(item.id))} item={item}/>)} ListFooterComponent={() => (<react_native_1.View className="mx-5 mt-10">
            <CustomButton_1.default title="Select Ride" onPress={() => expo_router_1.router.push("/(root)/book-ride")}/>
          </react_native_1.View>)}/>
    </RideLayout_1.default>);
};
exports.default = ConfirmRide;
