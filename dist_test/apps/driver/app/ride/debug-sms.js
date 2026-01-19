"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DebugSmsScreen;
const react_native_1 = require("react-native");
const expo_router_1 = require("expo-router");
const react_1 = require("react");
const expo_status_bar_1 = require("expo-status-bar");
const supabase_1 = require("@/lib/supabase");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const vector_icons_1 = require("@expo/vector-icons");
function DebugSmsScreen() {
    const [logs, setLogs] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const fetchLogs = async () => {
        setLoading(true);
        const { data, error } = await supabase_1.supabase
            .from('sms_queue')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
        if (error) {
            react_native_1.Alert.alert('Error', error.message);
        }
        else {
            setLogs(data || []);
        }
        setLoading(false);
    };
    (0, react_1.useEffect)(() => {
        fetchLogs();
    }, []);
    const getStatusColor = (status) => {
        switch (status) {
            case 'sent': return 'text-green-600';
            case 'failed': return 'text-red-600';
            case 'pending': return 'text-blue-600';
            default: return 'text-gray-600';
        }
    };
    const renderItem = ({ item }) => (<react_native_1.View className="bg-white p-4 mb-2 rounded-lg border border-gray-200">
            <react_native_1.View className="flex-row justify-between items-center mb-1">
                <react_native_1.Text className="font-bold text-gray-800">To: {item.phone_number}</react_native_1.Text>
                <react_native_1.Text className={`font-bold uppercase text-xs ${getStatusColor(item.status)}`}>
                    {item.status}
                </react_native_1.Text>
            </react_native_1.View>
            <react_native_1.Text className="text-xs text-gray-500 mb-2">{new Date(item.created_at).toLocaleString()}</react_native_1.Text>
            <react_native_1.Text className="text-gray-700 text-sm mb-2" numberOfLines={2}>{item.message}</react_native_1.Text>
            
            {item.error_message && (<react_native_1.View className="bg-red-50 p-2 rounded mt-1">
                    <react_native_1.Text className="text-red-600 text-xs">Error: {item.error_message}</react_native_1.Text>
                </react_native_1.View>)}
            
            <react_native_1.View className="flex-row justify-between mt-2 pt-2 border-t border-gray-100">
                <react_native_1.Text className="text-xs text-gray-400">Attempts: {item.attempts}</react_native_1.Text>
                <react_native_1.Text className="text-xs text-gray-400">ID: {item.id}</react_native_1.Text>
            </react_native_1.View>
        </react_native_1.View>);
    return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-gray-50">
            <expo_router_1.Stack.Screen options={{ headerShown: false }}/>
            <expo_status_bar_1.StatusBar style="dark"/>
            
            <react_native_1.View className="p-4 bg-white border-b border-gray-200 flex-row justify-between items-center">
                <react_native_1.Text className="text-xl font-bold text-gray-800">SMS Monitor</react_native_1.Text>
                <react_native_1.TouchableOpacity onPress={fetchLogs} className="bg-gray-100 p-2 rounded-full">
                    <vector_icons_1.Feather name="refresh-cw" size={20} color="black"/>
                </react_native_1.TouchableOpacity>
            </react_native_1.View>

            {loading ? (<react_native_1.View className="flex-1 justify-center items-center">
                    <react_native_1.ActivityIndicator size="large" color="#000"/>
                </react_native_1.View>) : (<react_native_1.FlatList data={logs} renderItem={renderItem} keyExtractor={(item) => item.id.toString()} contentContainerStyle={{ padding: 16 }} ListEmptyComponent={<react_native_1.Text className="text-center text-gray-500 mt-10">No SMS logs found.</react_native_1.Text>}/>)}
        </react_native_safe_area_context_1.SafeAreaView>);
}
