import { View, Text, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { Feather } from '@expo/vector-icons';

interface Review {
  id: string;
  rating: number;
  review: string;
  created_at: string;
  customer: {
    name: string;
    avatar_url: string | null;
  };
}

export default function DriverReviews() {
  const { driverProfile, user } = useAuth();
  const { t } = useLanguage();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ average: 0, total: 0 });

  useEffect(() => {
    const fetchReviews = async () => {
      if (!user?.id) return;

      try {
        // Fetch ratings where to_user_id is the driver
        const { data, error } = await supabase
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

        if (error) throw error;

        const reviewsData = (data || []).map(item => ({
             id: item.id,
             rating: item.rating,
             review: item.review,
             created_at: item.created_at,
             customer: item.customer as any
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

      } catch (error) {
        console.error('Error fetching reviews:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, [user?.id]);

  if (loading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="p-5">
        
        {/* Summary Card */}
        <View className="bg-white rounded-2xl p-6 mb-6 items-center border border-gray-200">
           <Text className="text-gray-900 text-4xl font-JakartaBold mb-1">{stats.average}</Text>
           <View className="flex-row mb-2">
             {[1, 2, 3, 4, 5].map((star) => (
                <Feather 
                   key={star} 
                   name="star" 
                   size={20} 
                   color={Math.round(stats.average) >= star ? "#fbbf24" : "#d1d5db"} 
                   fill={Math.round(stats.average) >= star ? "#fbbf24" : "none"}
                />
             ))}
           </View>
           <Text className="text-gray-500 text-sm">{stats.total} {t('reviewsCount')}</Text>
        </View>

        <Text className="text-gray-900 text-lg font-JakartaBold mb-4">{t('recentReviews')}</Text>

        {reviews.length === 0 ? (
           <View className="items-center py-10">
              <Text className="text-4xl mb-4">💬</Text>
              <Text className="text-gray-400">{t('noReviewsYet')}</Text>
           </View>
        ) : (
           reviews.map((review) => (
             <View key={review.id} className="bg-white p-4 rounded-xl mb-4 border border-gray-200">
               <View className="flex-row justify-between mb-2">
                  <View className="flex-row items-center">
                     <View className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center mr-2">
                         <Text className="text-xs">👤</Text> 
                     </View>
                     <Text className="text-gray-900 font-JakartaSemiBold">{review.customer?.name || t('customer')}</Text>
                  </View>
                  <Text className="text-gray-400 text-xs">
                     {new Date(review.created_at).toLocaleDateString()}
                  </Text>
               </View>
               
               <View className="flex-row mb-2">
                 {[1, 2, 3, 4, 5].map((star) => (
                    <Feather 
                       key={star} 
                       name="star" 
                       size={14} 
                       color={review.rating >= star ? "#fbbf24" : "#d1d5db"} 
                       fill={review.rating >= star ? "#fbbf24" : "none"}
                    />
                 ))}
               </View>

               {review.review && (
                 <Text className="text-gray-600 text-sm mt-1">"{review.review}"</Text>
               )}
            </View>
          ))
        )}

      </View>
    </ScrollView>
  );
}
