"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DriverReviews;
const react_native_1 = require("react-native");
const react_1 = require("react");
const AuthContext_1 = require("@/contexts/AuthContext");
const supabase_1 = require("@/lib/supabase");
const vector_icons_1 = require("@expo/vector-icons");
function DriverReviews() {
    const { driverProfile, user } = (0, AuthContext_1.useAuth)();
    const [reviews, setReviews] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [stats, setStats] = (0, react_1.useState)({ average: 0, total: 0 });
    (0, react_1.useEffect)(() => {
        const fetchReviews = async () => {
            if (!(user === null || user === void 0 ? void 0 : user.id))
                return;
            try {
                // Fetch ratings where to_user_id is the driver
                const { data, error } = await supabase_1.supabase
                    .from('ratings')
                    .select(`
            id,
            rating,
            review,
            created_at,
            customer:users!ratings_from_user_id_fkey(name, avatar_url)
          `)
                    .eq('to_user_id', user.id)
                    .eq('is_from_customer', true)
                    .order('created_at', { ascending: false });
                if (error)
                    throw error;
                const reviewsData = (data || []).map(item => ({
                    id: item.id,
                    rating: item.rating,
                    review: item.review,
                    created_at: item.created_at,
                    customer: item.customer
                }));
                setReviews(reviewsData);
                // Calculate stats
                const total = reviewsData.length;
                const sum = reviewsData.reduce((acc, curr) => acc + curr.rating, 0);
                const average = total > 0 ? (sum / total).toFixed(1) : 0;
                setStats({
                    total,
                    average: Number(average)
                });
            }
            catch (error) {
                console.error('Error fetching reviews:', error);
            }
            finally {
                setLoading(false);
            }
        };
        fetchReviews();
    }, [user === null || user === void 0 ? void 0 : user.id]);
    if (loading) {
        return (<react_native_1.View className="flex-1 bg-gray-900 items-center justify-center">
        <react_native_1.ActivityIndicator size="large" color="#22c55e"/>
      </react_native_1.View>);
    }
    return (<react_native_1.ScrollView className="flex-1 bg-gray-900">
      <react_native_1.View className="p-5">
        
        {/* Summary Card */}
        <react_native_1.View className="bg-gray-800 rounded-2xl p-6 mb-6 items-center">
          <react_native_1.Text className="text-white text-4xl font-JakartaBold mb-1">{stats.average}</react_native_1.Text>
          <react_native_1.View className="flex-row mb-2">
            {[1, 2, 3, 4, 5].map((star) => (<vector_icons_1.Feather key={star} name="star" size={20} color={Math.round(stats.average) >= star ? "#fbbf24" : "#4b5563"} fill={Math.round(stats.average) >= star ? "#fbbf24" : "none"}/>))}
          </react_native_1.View>
          <react_native_1.Text className="text-gray-400 text-sm">{stats.total} Reviews</react_native_1.Text>
        </react_native_1.View>

        <react_native_1.Text className="text-white text-lg font-JakartaBold mb-4">Recent Reviews</react_native_1.Text>

        {reviews.length === 0 ? (<react_native_1.View className="items-center py-10">
              <react_native_1.Text className="text-4xl mb-4">💬</react_native_1.Text>
              <react_native_1.Text className="text-gray-400">No reviews yet.</react_native_1.Text>
           </react_native_1.View>) : (reviews.map((review) => {
            var _a;
            return (<react_native_1.View key={review.id} className="bg-gray-800 p-4 rounded-xl mb-4">
              <react_native_1.View className="flex-row justify-between mb-2">
                 <react_native_1.View className="flex-row items-center">
                    <react_native_1.View className="w-8 h-8 bg-gray-700 rounded-full items-center justify-center mr-2">
                        <react_native_1.Text className="text-xs">👤</react_native_1.Text> 
                    </react_native_1.View>
                    <react_native_1.Text className="text-white font-JakartaSemiBold">{((_a = review.customer) === null || _a === void 0 ? void 0 : _a.name) || 'Customer'}</react_native_1.Text>
                 </react_native_1.View>
                 <react_native_1.Text className="text-gray-500 text-xs">
                    {new Date(review.created_at).toLocaleDateString()}
                 </react_native_1.Text>
              </react_native_1.View>
              
              <react_native_1.View className="flex-row mb-2">
                {[1, 2, 3, 4, 5].map((star) => (<vector_icons_1.Feather key={star} name="star" size={14} color={review.rating >= star ? "#fbbf24" : "#4b5563"} fill={review.rating >= star ? "#fbbf24" : "none"}/>))}
              </react_native_1.View>

              {review.review && (<react_native_1.Text className="text-gray-300 text-sm mt-1">"{review.review}"</react_native_1.Text>)}
            </react_native_1.View>);
        }))}

      </react_native_1.View>
    </react_native_1.ScrollView>);
}
