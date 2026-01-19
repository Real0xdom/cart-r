"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const expo_router_1 = require("expo-router");
const react_1 = require("react");
// Mock ride data - replace with Supabase fetch
const mockRideData = {
    id: '1',
    status: 'accepted', // accepted, picked_up, in_progress, completed
    customer: {
        name: 'Rahul Sharma',
        phone: '+91 98765 43210',
        rating: 4.7,
    },
    pickup: {
        address: 'Koramangala 4th Block, Bangalore',
        lat: 12.9352,
        lng: 77.6245,
    },
    dropoff: {
        address: 'Whitefield Main Road, Bangalore',
        lat: 12.9698,
        lng: 77.7500,
    },
    fare: '₹450',
    distance: '18.5 km',
    estimatedTime: '35 mins',
};
const ActiveRide = () => {
    const { id } = (0, expo_router_1.useLocalSearchParams)();
    const [ride, setRide] = (0, react_1.useState)(mockRideData);
    const [status, setStatus] = (0, react_1.useState)('accepted');
    const openNavigation = () => {
        const destination = status === 'picked_up' ? ride.dropoff : ride.pickup;
        const url = react_native_1.Platform.select({
            ios: `maps://app?daddr=${destination.lat},${destination.lng}`,
            android: `google.navigation:q=${destination.lat},${destination.lng}`,
        });
        if (url)
            react_native_1.Linking.openURL(url);
    };
    const callCustomer = () => {
        react_native_1.Linking.openURL(`tel:${ride.customer.phone}`);
    };
    const updateStatus = () => {
        if (status === 'accepted') {
            setStatus('arrived');
        }
        else if (status === 'arrived') {
            setStatus('picked_up');
        }
        else if (status === 'picked_up') {
            setStatus('completed');
            // TODO: Navigate to rating screen or back to home
            expo_router_1.router.replace('/(driver)/home');
        }
    };
    const getButtonText = () => {
        switch (status) {
            case 'accepted': return 'Arrived at Pickup';
            case 'arrived': return 'Start Trip';
            case 'picked_up': return 'Complete Trip';
            default: return 'Continue';
        }
    };
    const getStatusText = () => {
        switch (status) {
            case 'accepted': return 'Head to pickup location';
            case 'arrived': return 'Waiting for customer';
            case 'picked_up': return 'Trip in progress';
            default: return '';
        }
    };
    return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-gray-900">
            {/* Map Placeholder */}
            <react_native_1.View className="flex-1 bg-gray-800 items-center justify-center">
                <react_native_1.Text className="text-4xl mb-2">🗺️</react_native_1.Text>
                <react_native_1.Text className="text-gray-400">Map View</react_native_1.Text>
                <react_native_1.Text className="text-gray-500 text-sm">(Integrate MapView here)</react_native_1.Text>
            </react_native_1.View>

            {/* Bottom Sheet */}
            <react_native_1.View className="bg-gray-900 rounded-t-3xl p-5 -mt-8">
                {/* Status */}
                <react_native_1.View className="items-center mb-4">
                    <react_native_1.View className={`px-4 py-2 rounded-full ${status === 'picked_up' ? 'bg-green-500/20' : 'bg-blue-500/20'}`}>
                        <react_native_1.Text className={`font-JakartaSemiBold ${status === 'picked_up' ? 'text-green-400' : 'text-blue-400'}`}>
                            {getStatusText()}
                        </react_native_1.Text>
                    </react_native_1.View>
                </react_native_1.View>

                {/* Customer Info */}
                <react_native_1.View className="bg-gray-800 rounded-2xl p-4 mb-4">
                    <react_native_1.View className="flex-row justify-between items-center">
                        <react_native_1.View className="flex-row items-center">
                            <react_native_1.View className="w-12 h-12 bg-gray-700 rounded-full items-center justify-center mr-3">
                                <react_native_1.Text className="text-2xl">👤</react_native_1.Text>
                            </react_native_1.View>
                            <react_native_1.View>
                                <react_native_1.Text className="text-white font-JakartaBold">{ride.customer.name}</react_native_1.Text>
                                <react_native_1.Text className="text-gray-400 text-sm">⭐ {ride.customer.rating}</react_native_1.Text>
                            </react_native_1.View>
                        </react_native_1.View>
                        <react_native_1.TouchableOpacity onPress={callCustomer} className="bg-green-500/20 w-12 h-12 rounded-full items-center justify-center">
                            <react_native_1.Text className="text-2xl">📞</react_native_1.Text>
                        </react_native_1.TouchableOpacity>
                    </react_native_1.View>
                </react_native_1.View>

                {/* Ride Details */}
                <react_native_1.View className="bg-gray-800 rounded-2xl p-4 mb-4">
                    <react_native_1.View className="mb-3">
                        <react_native_1.Text className="text-gray-400 text-xs mb-1">
                            {status === 'picked_up' ? 'DROP-OFF' : 'PICKUP'}
                        </react_native_1.Text>
                        <react_native_1.Text className="text-white font-JakartaSemiBold">
                            {status === 'picked_up' ? ride.dropoff.address : ride.pickup.address}
                        </react_native_1.Text>
                    </react_native_1.View>

                    {status !== 'picked_up' && (<react_native_1.View>
                            <react_native_1.Text className="text-gray-400 text-xs mb-1">DROP-OFF</react_native_1.Text>
                            <react_native_1.Text className="text-white font-JakartaSemiBold">{ride.dropoff.address}</react_native_1.Text>
                        </react_native_1.View>)}

                    <react_native_1.View className="flex-row gap-4 mt-4 pt-4 border-t border-gray-700">
                        <react_native_1.View className="flex-1">
                            <react_native_1.Text className="text-gray-400 text-xs">Distance</react_native_1.Text>
                            <react_native_1.Text className="text-white font-JakartaSemiBold">{ride.distance}</react_native_1.Text>
                        </react_native_1.View>
                        <react_native_1.View className="flex-1">
                            <react_native_1.Text className="text-gray-400 text-xs">Est. Time</react_native_1.Text>
                            <react_native_1.Text className="text-white font-JakartaSemiBold">{ride.estimatedTime}</react_native_1.Text>
                        </react_native_1.View>
                        <react_native_1.View className="flex-1">
                            <react_native_1.Text className="text-gray-400 text-xs">Fare</react_native_1.Text>
                            <react_native_1.Text className="text-green-400 font-JakartaBold">{ride.fare}</react_native_1.Text>
                        </react_native_1.View>
                    </react_native_1.View>
                </react_native_1.View>

                {/* Action Buttons */}
                <react_native_1.View className="flex-row gap-3">
                    <react_native_1.TouchableOpacity onPress={openNavigation} className="flex-1 bg-blue-500 p-4 rounded-xl flex-row items-center justify-center">
                        <react_native_1.Text className="text-white mr-2">📍</react_native_1.Text>
                        <react_native_1.Text className="text-white font-JakartaBold">Navigate</react_native_1.Text>
                    </react_native_1.TouchableOpacity>
                    <react_native_1.TouchableOpacity onPress={updateStatus} className="flex-1 bg-green-500 p-4 rounded-xl">
                        <react_native_1.Text className="text-white text-center font-JakartaBold">{getButtonText()}</react_native_1.Text>
                    </react_native_1.TouchableOpacity>
                </react_native_1.View>

                {/* Cancel Option */}
                {status === 'accepted' && (<react_native_1.TouchableOpacity onPress={() => expo_router_1.router.back()} className="mt-4">
                        <react_native_1.Text className="text-red-400 text-center">Cancel Ride</react_native_1.Text>
                    </react_native_1.TouchableOpacity>)}
            </react_native_1.View>
        </react_native_safe_area_context_1.SafeAreaView>);
};
exports.default = ActiveRide;
