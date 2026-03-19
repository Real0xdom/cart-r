"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = NotificationsScreen;
const react_native_1 = require("react-native");
const react_1 = require("react");
const AuthContext_1 = require("@/contexts/AuthContext");
const supabase_1 = require("@/lib/supabase");
const vector_icons_1 = require("@expo/vector-icons");
function NotificationsScreen() {
    const { user } = (0, AuthContext_1.useAuth)();
    const [notifications, setNotifications] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const fetchNotifications = async () => {
        if (!(user === null || user === void 0 ? void 0 : user.id))
            return;
        try {
            setLoading(true);
            const { data, error } = await supabase_1.supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id);
            if (error)
                throw error;
            const formattedData = (data || []).map(n => ({
                ...n,
                is_read: n.is_read || false,
                created_at: n.created_at || new Date().toISOString()
            }));
            setNotifications(formattedData);
        }
        catch (error) {
            console.error('Error fetching notifications:', error);
        }
        finally {
            setLoading(false);
        }
    };
    (0, react_1.useEffect)(() => {
        fetchNotifications();
        // Subscribe to new notifications
        const subscription = supabase_1.supabase
            .channel('notifications')
            .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user === null || user === void 0 ? void 0 : user.id}`,
        }, (payload) => {
            const newNotif = payload.new;
            setNotifications((prev) => [newNotif, ...prev]);
        })
            .subscribe();
        return () => {
            subscription.unsubscribe();
        };
    }, [user === null || user === void 0 ? void 0 : user.id]);
    const markAsRead = async (id) => {
        try {
            await supabase_1.supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', id);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        }
        catch (error) {
            console.error('Error marking as read:', error);
        }
    };
    const getIcon = (title) => {
        if (title.toLowerCase().includes('payment'))
            return 'dollar-sign';
        if (title.toLowerCase().includes('trip'))
            return 'map-pin';
        if (title.toLowerCase().includes('welcome'))
            return 'smile';
        return 'bell';
    };
    return (<react_native_1.View className="flex-1 bg-gray-900">
      <react_native_1.ScrollView className="flex-1 p-5">
        
        {/* Test button removed as per requirements */}

        {loading ? (<react_native_1.ActivityIndicator size="large" color="#22c55e" className="mt-10"/>) : notifications.length === 0 ? (<react_native_1.View className="items-center mt-10">
                <react_native_1.View className="w-16 h-16 bg-gray-800 rounded-full items-center justify-center mb-4">
                    <vector_icons_1.Feather name="bell-off" size={32} color="#6b7280"/>
                </react_native_1.View>
                <react_native_1.Text className="text-gray-400 text-lg">No notifications yet</react_native_1.Text>
            </react_native_1.View>) : (notifications.map((item) => (<react_native_1.TouchableOpacity key={item.id} onPress={() => markAsRead(item.id)} className={`p-4 rounded-xl mb-3 border ${item.is_read ? 'bg-gray-800 border-gray-800' : 'bg-gray-800 border-primary-500'}`}>
                    <react_native_1.View className="flex-row">
                        <react_native_1.View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${item.is_read ? 'bg-gray-700' : 'bg-primary-500/20'}`}>
                            <vector_icons_1.Feather name={getIcon(item.title)} size={20} color={item.is_read ? '#9ca3af' : '#22c55e'}/>
                        </react_native_1.View>
                        <react_native_1.View className="flex-1">
                            <react_native_1.View className="flex-row justify-between items-start">
                                <react_native_1.Text className={`font-JakartaSemiBold mb-1 ${item.is_read ? 'text-gray-400' : 'text-white'}`}>
                                    {item.title}
                                </react_native_1.Text>
                                <react_native_1.Text className="text-gray-600 text-xs">
                                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </react_native_1.Text>
                            </react_native_1.View>
                            <react_native_1.Text className="text-gray-500 text-sm leading-5">
                                {item.body}
                            </react_native_1.Text>
                        </react_native_1.View>
                    </react_native_1.View>
                </react_native_1.TouchableOpacity>)))}
        
        <react_native_1.View className="h-10"/> 
      </react_native_1.ScrollView>
    </react_native_1.View>);
}
