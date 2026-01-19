"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const react_1 = require("react");
const expo_router_1 = require("expo-router");
// Mock data - replace with Supabase realtime subscription
const mockRequests = [
    {
        id: '1',
        pickup: 'Koramangala, Bangalore',
        dropoff: 'Whitefield, Bangalore',
        distance: '18.5 km',
        fare: '₹450',
        time: '35 mins',
        customerName: 'Rahul S.',
    },
    {
        id: '2',
        pickup: 'HSR Layout, Bangalore',
        dropoff: 'Electronic City, Bangalore',
        distance: '12.2 km',
        fare: '₹320',
        time: '25 mins',
        customerName: 'Priya M.',
    },
];
const RideRequestCard = ({ request, onAccept, onReject }) => (<react_native_1.View className="bg-gray-800 rounded-2xl p-4 mb-4">
        <react_native_1.View className="flex-row justify-between items-start mb-4">
            <react_native_1.View className="flex-1">
                <react_native_1.Text className="text-gray-400 text-xs mb-1">PICKUP</react_native_1.Text>
                <react_native_1.Text className="text-white font-JakartaSemiBold text-base">{request.pickup}</react_native_1.Text>
            </react_native_1.View>
            <react_native_1.View className="bg-green-500/20 px-3 py-1 rounded-full">
                <react_native_1.Text className="text-green-400 font-JakartaBold">{request.fare}</react_native_1.Text>
            </react_native_1.View>
        </react_native_1.View>

        <react_native_1.View className="mb-4">
            <react_native_1.Text className="text-gray-400 text-xs mb-1">DROP-OFF</react_native_1.Text>
            <react_native_1.Text className="text-white font-JakartaSemiBold text-base">{request.dropoff}</react_native_1.Text>
        </react_native_1.View>

        <react_native_1.View className="flex-row gap-4 mb-4">
            <react_native_1.View className="flex-1 bg-gray-700/50 p-3 rounded-xl">
                <react_native_1.Text className="text-gray-400 text-xs">Distance</react_native_1.Text>
                <react_native_1.Text className="text-white font-JakartaSemiBold">{request.distance}</react_native_1.Text>
            </react_native_1.View>
            <react_native_1.View className="flex-1 bg-gray-700/50 p-3 rounded-xl">
                <react_native_1.Text className="text-gray-400 text-xs">Est. Time</react_native_1.Text>
                <react_native_1.Text className="text-white font-JakartaSemiBold">{request.time}</react_native_1.Text>
            </react_native_1.View>
            <react_native_1.View className="flex-1 bg-gray-700/50 p-3 rounded-xl">
                <react_native_1.Text className="text-gray-400 text-xs">Customer</react_native_1.Text>
                <react_native_1.Text className="text-white font-JakartaSemiBold">{request.customerName}</react_native_1.Text>
            </react_native_1.View>
        </react_native_1.View>

        <react_native_1.View className="flex-row gap-3">
            <react_native_1.TouchableOpacity onPress={() => onReject(request.id)} className="flex-1 bg-red-500/20 p-4 rounded-xl">
                <react_native_1.Text className="text-red-400 text-center font-JakartaBold">Decline</react_native_1.Text>
            </react_native_1.TouchableOpacity>
            <react_native_1.TouchableOpacity onPress={() => onAccept(request.id)} className="flex-1 bg-green-500 p-4 rounded-xl">
                <react_native_1.Text className="text-white text-center font-JakartaBold">Accept</react_native_1.Text>
            </react_native_1.TouchableOpacity>
        </react_native_1.View>
    </react_native_1.View>);
const DriverRequests = () => {
    const [requests, setRequests] = (0, react_1.useState)(mockRequests);
    const [refreshing, setRefreshing] = (0, react_1.useState)(false);
    const onRefresh = (0, react_1.useCallback)(() => {
        setRefreshing(true);
        // TODO: Fetch from Supabase
        setTimeout(() => {
            setRefreshing(false);
        }, 1000);
    }, []);
    const handleAccept = (id) => {
        // TODO: Update booking status in Supabase
        // Navigate to active ride screen
        expo_router_1.router.push(`/(driver)/ride/${id}`);
    };
    const handleReject = (id) => {
        // TODO: Update booking status in Supabase
        setRequests(prev => prev.filter(r => r.id !== id));
    };
    return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-gray-900">
            <react_native_1.View className="p-5">
                <react_native_1.Text className="text-white text-2xl font-JakartaBold mb-2">Ride Requests</react_native_1.Text>
                <react_native_1.Text className="text-gray-400 mb-4">
                    {requests.length} {requests.length === 1 ? 'request' : 'requests'} available
                </react_native_1.Text>
            </react_native_1.View>

            <react_native_1.ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 100 }} refreshControl={<react_native_1.RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff"/>}>
                {requests.length > 0 ? (requests.map(request => (<RideRequestCard key={request.id} request={request} onAccept={handleAccept} onReject={handleReject}/>))) : (<react_native_1.View className="flex-1 items-center justify-center py-20">
                        <react_native_1.Text className="text-6xl mb-4">📭</react_native_1.Text>
                        <react_native_1.Text className="text-white text-xl font-JakartaBold mb-2">No Requests</react_native_1.Text>
                        <react_native_1.Text className="text-gray-400 text-center">
                            New ride requests will appear here.{'\n'}Make sure you're online!
                        </react_native_1.Text>
                    </react_native_1.View>)}
            </react_native_1.ScrollView>
        </react_native_safe_area_context_1.SafeAreaView>);
};
exports.default = DriverRequests;
