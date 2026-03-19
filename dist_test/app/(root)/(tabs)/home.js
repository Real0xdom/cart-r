"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const clerk_expo_1 = require("@clerk/clerk-expo");
const clerk_expo_2 = require("@clerk/clerk-expo");
const Location = __importStar(require("expo-location"));
const expo_router_1 = require("expo-router");
const react_1 = require("react");
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const GoogleTextInput_1 = __importDefault(require("@/components/GoogleTextInput"));
const Map_1 = __importDefault(require("@/components/Map"));
const RideCard_1 = __importDefault(require("@/components/RideCard"));
const constants_1 = require("@/constants");
const fetch_1 = require("@/lib/fetch");
const store_1 = require("@/store");
const Home = () => {
    const { user } = (0, clerk_expo_1.useUser)();
    const { signOut } = (0, clerk_expo_2.useAuth)();
    const { setUserLocation, setDestinationLocation } = (0, store_1.useLocationStore)();
    const handleSignOut = () => {
        signOut();
        expo_router_1.router.replace("/(auth)/sign-in");
    };
    const [hasPermission, setHasPermission] = (0, react_1.useState)(false);
    const { data: recentRides, loading, error, } = (0, fetch_1.useFetch)(`/(api)/ride/${user === null || user === void 0 ? void 0 : user.id}`);
    (0, react_1.useEffect)(() => {
        (async () => {
            var _a, _b, _c, _d;
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== "granted") {
                setHasPermission(false);
                return;
            }
            let location = await Location.getCurrentPositionAsync({});
            const address = await Location.reverseGeocodeAsync({
                latitude: (_a = location.coords) === null || _a === void 0 ? void 0 : _a.latitude,
                longitude: (_b = location.coords) === null || _b === void 0 ? void 0 : _b.longitude,
            });
            setUserLocation({
                latitude: (_c = location.coords) === null || _c === void 0 ? void 0 : _c.latitude,
                longitude: (_d = location.coords) === null || _d === void 0 ? void 0 : _d.longitude,
                address: `${address[0].name}, ${address[0].region}`,
            });
        })();
    }, []);
    const handleDestinationPress = (location) => {
        setDestinationLocation(location);
        expo_router_1.router.push("/(root)/find-ride");
    };
    return (<react_native_safe_area_context_1.SafeAreaView className="bg-general-500">
      <react_native_1.FlatList data={recentRides === null || recentRides === void 0 ? void 0 : recentRides.slice(0, 5)} renderItem={({ item }) => <RideCard_1.default ride={item}/>} keyExtractor={(item, index) => index.toString()} className="px-5" keyboardShouldPersistTaps="handled" contentContainerStyle={{
            paddingBottom: 100,
        }} ListEmptyComponent={() => (<react_native_1.View className="flex flex-col items-center justify-center">
            {!loading ? (<>
                <react_native_1.Image source={constants_1.images.noResult} className="w-40 h-40" alt="No recent rides found" resizeMode="contain"/>
                <react_native_1.Text className="text-sm">No recent rides found</react_native_1.Text>
              </>) : (<react_native_1.ActivityIndicator size="small" color="#000"/>)}
          </react_native_1.View>)} ListHeaderComponent={<>
            <react_native_1.View className="flex flex-row items-center justify-between my-5">
              <react_native_1.Text className="text-2xl font-JakartaExtraBold">
                Welcome {user === null || user === void 0 ? void 0 : user.firstName}👋
              </react_native_1.Text>
              <react_native_1.TouchableOpacity onPress={handleSignOut} className="justify-center items-center w-10 h-10 rounded-full bg-white">
                <react_native_1.Image source={constants_1.icons.out} className="w-4 h-4"/>
              </react_native_1.TouchableOpacity>
            </react_native_1.View>

            <GoogleTextInput_1.default icon={constants_1.icons.search} containerStyle="bg-white shadow-md shadow-neutral-300" handlePress={handleDestinationPress}/>

            <>
              <react_native_1.Text className="text-xl font-JakartaBold mt-5 mb-3">
                Your current location
              </react_native_1.Text>
              <react_native_1.View className="flex flex-row items-center bg-transparent h-[300px]">
                <Map_1.default />
              </react_native_1.View>
            </>

            <react_native_1.Text className="text-xl font-JakartaBold mt-5 mb-3">
              Recent Rides
            </react_native_1.Text>
          </>}/>
    </react_native_safe_area_context_1.SafeAreaView>);
};
exports.default = Home;
