"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const clerk_expo_1 = require("@clerk/clerk-expo");
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const RideCard_1 = __importDefault(require("@/components/RideCard"));
const constants_1 = require("@/constants");
const fetch_1 = require("@/lib/fetch");
const Rides = () => {
    const { user } = (0, clerk_expo_1.useUser)();
    const { data: recentRides, loading, error, } = (0, fetch_1.useFetch)(`/(api)/ride/${user === null || user === void 0 ? void 0 : user.id}`);
    return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-white">
      <react_native_1.FlatList data={recentRides} renderItem={({ item }) => <RideCard_1.default ride={item}/>} keyExtractor={(item, index) => index.toString()} className="px-5" keyboardShouldPersistTaps="handled" contentContainerStyle={{
            paddingBottom: 100,
        }} ListEmptyComponent={() => (<react_native_1.View className="flex flex-col items-center justify-center">
            {!loading ? (<>
                <react_native_1.Image source={constants_1.images.noResult} className="w-40 h-40" alt="No recent rides found" resizeMode="contain"/>
                <react_native_1.Text className="text-sm">No recent rides found</react_native_1.Text>
              </>) : (<react_native_1.ActivityIndicator size="small" color="#000"/>)}
          </react_native_1.View>)} ListHeaderComponent={<>
            <react_native_1.Text className="text-2xl font-JakartaBold my-5">All Rides</react_native_1.Text>
          </>}/>
    </react_native_safe_area_context_1.SafeAreaView>);
};
exports.default = Rides;
