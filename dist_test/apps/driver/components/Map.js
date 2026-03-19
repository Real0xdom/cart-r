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
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const react_native_maps_1 = __importStar(require("react-native-maps"));
const react_native_maps_directions_1 = __importDefault(require("react-native-maps-directions"));
const constants_1 = require("@/constants");
const fetch_1 = require("@/lib/fetch");
const map_1 = require("@/lib/map");
const store_1 = require("@/store");
const directionsAPI = process.env.EXPO_PUBLIC_DIRECTIONS_API_KEY;
const Map = () => {
    const { userLongitude, userLatitude, destinationLatitude, destinationLongitude, } = (0, store_1.useLocationStore)();
    const { selectedDriver, setDrivers } = (0, store_1.useDriverStore)();
    const { data: drivers, loading, error } = (0, fetch_1.useFetch)("/(api)/driver");
    const [markers, setMarkers] = (0, react_1.useState)([]);
    (0, react_1.useEffect)(() => {
        if (Array.isArray(drivers)) {
            if (!userLatitude || !userLongitude)
                return;
            const newMarkers = (0, map_1.generateMarkersFromData)({
                data: drivers,
                userLatitude,
                userLongitude,
            });
            setMarkers(newMarkers);
        }
    }, [drivers, userLatitude, userLongitude]);
    (0, react_1.useEffect)(() => {
        if (markers.length > 0 &&
            destinationLatitude !== undefined &&
            destinationLongitude !== undefined) {
            (0, map_1.calculateDriverTimes)({
                markers,
                userLatitude,
                userLongitude,
                destinationLatitude,
                destinationLongitude,
            }).then((drivers) => {
                setDrivers(drivers);
            });
        }
    }, [markers, destinationLatitude, destinationLongitude]);
    const region = (0, map_1.calculateRegion)({
        userLatitude,
        userLongitude,
        destinationLatitude,
        destinationLongitude,
    });
    if (loading || (!userLatitude && !userLongitude))
        return (<react_native_1.View className="flex justify-between items-center w-full">
        <react_native_1.ActivityIndicator size="small" color="#000"/>
      </react_native_1.View>);
    if (error)
        return (<react_native_1.View className="flex justify-between items-center w-full">
        <react_native_1.Text>Error: {error}</react_native_1.Text>
      </react_native_1.View>);
    return (<react_native_maps_1.default provider={react_native_maps_1.PROVIDER_DEFAULT} className="w-full h-full rounded-2xl" tintColor="black" mapType="mutedStandard" showsPointsOfInterest={false} initialRegion={region} showsUserLocation={true} userInterfaceStyle="light">
      {markers.map((marker, index) => (<react_native_maps_1.Marker key={marker.id} coordinate={{
                latitude: marker.latitude,
                longitude: marker.longitude,
            }} title={marker.title} image={selectedDriver === +marker.id ? constants_1.icons.selectedMarker : constants_1.icons.marker}/>))}

      {destinationLatitude && destinationLongitude && (<>
          <react_native_maps_1.Marker key="destination" coordinate={{
                latitude: destinationLatitude,
                longitude: destinationLongitude,
            }} title="Destination" image={constants_1.icons.pin}/>
          <react_native_maps_directions_1.default origin={{
                latitude: userLatitude,
                longitude: userLongitude,
            }} destination={{
                latitude: destinationLatitude,
                longitude: destinationLongitude,
            }} apikey={directionsAPI} strokeColor="#0286FF" strokeWidth={2}/>
        </>)}
    </react_native_maps_1.default>);
};
exports.default = Map;
