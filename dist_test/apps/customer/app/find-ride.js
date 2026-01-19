"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const CustomButton_1 = __importDefault(require("@/components/CustomButton"));
const GoogleTextInput_1 = __importDefault(require("@/components/GoogleTextInput"));
const RideLayout_1 = __importDefault(require("@/components/RideLayout"));
const constants_1 = require("@/constants");
const LocationContext_1 = require("@/contexts/LocationContext");
const store_1 = require("@/store");
const expo_router_1 = require("expo-router");
const react_1 = require("react");
const react_native_1 = require("react-native");
const vector_icons_1 = require("@expo/vector-icons");
const FindRide = () => {
    const { userAddress, destinationAddress, setDestinationLocation, setUserLocation, } = (0, store_1.useLocationStore)();
    const { getCurrentLocation, isLoadingLocation } = (0, LocationContext_1.useLocation)();
    const [selectingOnMap, setSelectingOnMap] = (0, react_1.useState)(null);
    const [fetchingLocation, setFetchingLocation] = (0, react_1.useState)(false);
    const handleUseCurrentLocation = (0, react_1.useCallback)(async () => {
        setFetchingLocation(true);
        try {
            await getCurrentLocation();
        }
        catch (error) {
            console.error("Error fetching current location:", error);
        }
        finally {
            setFetchingLocation(false);
        }
    }, [getCurrentLocation]);
    const handleSelectOnMap = (field) => {
        if (selectingOnMap === field) {
            setSelectingOnMap(null);
        }
        else {
            setSelectingOnMap(field);
        }
    };
    const handleMapLocationSelected = (0, react_1.useCallback)(() => {
        setSelectingOnMap(null);
    }, []);
    const handleCancelSelection = (0, react_1.useCallback)(() => {
        setSelectingOnMap(null);
    }, []);
    const handleNext = () => {
        if (userAddress && destinationAddress) {
            // Go to step 2: receiver details
            expo_router_1.router.push("/receiver-details");
        }
    };
    const isLoading = isLoadingLocation || fetchingLocation;
    const canProceed = userAddress && destinationAddress;
    return (<RideLayout_1.default title="Select Locations" snapPoints={["15%", "50%", "85%"]} mapSelectionMode={selectingOnMap} onMapLocationSelected={handleMapLocationSelected} useView={true}>
      {/* From Field */}
      <react_native_1.View className="my-3">
        <react_native_1.View className="flex-row items-center justify-between mb-3">
          <react_native_1.View className="flex-row items-center">
            <react_native_1.View className="w-6 h-6 bg-green-500 rounded-full items-center justify-center mr-2">
              <react_native_1.Text className="text-white text-xs font-JakartaBold">1</react_native_1.Text>
            </react_native_1.View>
            <react_native_1.Text className="text-lg font-JakartaSemiBold">Pickup Location</react_native_1.Text>
          </react_native_1.View>
          {isLoading && (<react_native_1.ActivityIndicator size="small" color="#FF9800"/>)}
        </react_native_1.View>
        
        <GoogleTextInput_1.default icon={constants_1.icons.target} initialLocation={userAddress !== null && userAddress !== void 0 ? userAddress : undefined} containerStyle="bg-neutral-100" textInputBackgroundColor="#f5f5f5" handlePress={(location) => setUserLocation(location)}/>
        
        <react_native_1.View className="flex-row items-center justify-between mt-2 px-2">
          <react_native_1.TouchableOpacity onPress={handleUseCurrentLocation} className="flex-row items-center py-2" disabled={isLoading}>
            <vector_icons_1.Feather name="navigation" size={16} color="#FF9800"/>
            <react_native_1.Text className="ml-2 text-sm font-JakartaMedium text-blue-500">
              Use current location
            </react_native_1.Text>
          </react_native_1.TouchableOpacity>
          
          <react_native_1.TouchableOpacity onPress={() => handleSelectOnMap('from')} className={`flex-row items-center py-2 px-3 rounded-lg ${selectingOnMap === 'from' ? 'bg-blue-500' : 'bg-gray-100'}`}>
            <vector_icons_1.Feather name="map-pin" size={16} color={selectingOnMap === 'from' ? '#fff' : '#777'}/>
            <react_native_1.Text className={`ml-2 text-sm font-JakartaMedium ${selectingOnMap === 'from' ? 'text-white' : 'text-gray-600'}`}>
              {selectingOnMap === 'from' ? 'Selecting...' : 'Select on map'}
            </react_native_1.Text>
          </react_native_1.TouchableOpacity>
        </react_native_1.View>
      </react_native_1.View>

      {/* To Field */}
      <react_native_1.View className="my-3">
        <react_native_1.View className="flex-row items-center mb-3">
          <react_native_1.View className="w-6 h-6 bg-red-500 rounded-full items-center justify-center mr-2">
            <react_native_1.Text className="text-white text-xs font-JakartaBold">2</react_native_1.Text>
          </react_native_1.View>
          <react_native_1.Text className="text-lg font-JakartaSemiBold">Drop Location</react_native_1.Text>
        </react_native_1.View>
        
        <GoogleTextInput_1.default icon={constants_1.icons.target} initialLocation={destinationAddress !== null && destinationAddress !== void 0 ? destinationAddress : undefined} containerStyle="bg-neutral-100" textInputBackgroundColor="transparent" handlePress={(location) => setDestinationLocation(location)}/>
        
        <react_native_1.View className="flex-row items-center justify-end mt-2 px-2">
          <react_native_1.TouchableOpacity onPress={() => handleSelectOnMap('to')} className={`flex-row items-center py-2 px-3 rounded-lg ${selectingOnMap === 'to' ? 'bg-blue-500' : 'bg-gray-100'}`}>
            <vector_icons_1.Feather name="map-pin" size={16} color={selectingOnMap === 'to' ? '#fff' : '#777'}/>
            <react_native_1.Text className={`ml-2 text-sm font-JakartaMedium ${selectingOnMap === 'to' ? 'text-white' : 'text-gray-600'}`}>
              {selectingOnMap === 'to' ? 'Selecting...' : 'Select on map'}
            </react_native_1.Text>
          </react_native_1.TouchableOpacity>
        </react_native_1.View>
      </react_native_1.View>

      {/* Info message when selecting on map */}
      {selectingOnMap && (<react_native_1.View className="bg-blue-100 p-4 rounded-xl mb-4 flex-row items-center">
          <vector_icons_1.Feather name="info" size={18} color="#FF9800"/>
          <react_native_1.Text className="ml-3 text-sm font-JakartaMedium text-blue-700 flex-1">
            Drag the sheet down and tap on the map to select your {selectingOnMap === 'from' ? 'pickup' : 'drop'} location
          </react_native_1.Text>
          <react_native_1.TouchableOpacity onPress={handleCancelSelection} className="bg-blue-500 rounded-full p-1">
            <vector_icons_1.Feather name="x" size={16} color="#fff"/>
          </react_native_1.TouchableOpacity>
        </react_native_1.View>)}



      <CustomButton_1.default title={canProceed ? "Next: Receiver Details →" : "Enter both locations"} onPress={handleNext} className="mt-4" bgVariant={canProceed ? "primary" : "secondary"} disabled={!canProceed}/>
    </RideLayout_1.default>);
};
exports.default = FindRide;
