import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getSavedAddresses, deleteAddress, getSavedRoutes, deleteRoute, SavedAddress, SavedRoute, getPlaceIoniconName } from '@/lib/savedPlaces';
import { useLocationStore } from '@/store';

export default function SavedAddresses() {
  const { t } = useLanguage();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'addresses' | 'routes'>('addresses');
  const { setUserLocation, setDestinationLocation } = useLocationStore();

  const fetchData = async () => {
    setLoading(true);
    const [addrRes, routeRes] = await Promise.all([
      getSavedAddresses(),
      getSavedRoutes()
    ]);
    if (addrRes.data) setAddresses(addrRes.data);
    if (routeRes.data) setRoutes(routeRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeleteAddress = (id: string) => {
    Alert.alert(
      t("deleteAddress"),
      t("deleteAddressConfirm"),
      [
        { text: t("cancel"), style: "cancel" },
        { 
          text: t("delete"), 
          style: "destructive",
          onPress: async () => {
            const { success } = await deleteAddress(id);
            if (success) {
              setAddresses(prev => prev.filter(a => a.id !== id));
            }
          }
        }
      ]
    );
  };

  const handleDeleteRoute = (id: string) => {
    Alert.alert(
      t("deleteRoute"),
      t("deleteRouteConfirm"),
      [
        { text: t("cancel"), style: "cancel" },
        { 
          text: t("delete"), 
          style: "destructive",
          onPress: async () => {
            const { success } = await deleteRoute(id);
            if (success) {
              setRoutes(prev => prev.filter(r => r.id !== id));
            }
          }
        }
      ]
    );
  };

  const handleSelectAddress = (address: SavedAddress) => {
    setUserLocation({
      latitude: Number(address.latitude),
      longitude: Number(address.longitude),
      address: address.address
    });
    router.push("/find-ride");
  };

  const handleSelectRoute = (route: SavedRoute) => {
    setUserLocation({
      latitude: Number(route.origin_latitude),
      longitude: Number(route.origin_longitude),
      address: route.origin_address
    });
    setDestinationLocation({
      latitude: Number(route.destination_latitude),
      longitude: Number(route.destination_longitude),
      address: route.destination_address
    });
    router.push("/find-ride");
  };

  const renderAddressItem = ({ item }: { item: SavedAddress }) => (
    <TouchableOpacity 
      onPress={() => handleSelectAddress(item)}
      className="flex-row items-center bg-white p-4 mb-3 rounded-2xl border border-gray-100 shadow-sm"
    >
      <View className="w-12 h-12 bg-brand-50 rounded-full items-center justify-center mr-4">
        <Ionicons name={getPlaceIoniconName(item.icon_type) as any} size={24} color="#FF9800" />
      </View>
      <View className="flex-1">
        <Text className="text-base font-JakartaBold text-gray-800">{item.label}</Text>
        <Text className="text-xs font-JakartaMedium text-gray-400 mt-1" numberOfLines={1}>{item.address}</Text>
      </View>
      <TouchableOpacity 
        onPress={() => handleDeleteAddress(item.id)}
        className="p-2"
      >
        <Feather name="trash-2" size={18} color="#FF4444" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderRouteItem = ({ item }: { item: SavedRoute }) => (
    <TouchableOpacity 
      onPress={() => handleSelectRoute(item)}
      className="bg-white p-4 mb-3 rounded-2xl border border-gray-100 shadow-sm"
    >
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <View className="w-8 h-8 bg-brand-50 rounded-full items-center justify-center mr-3">
            <Ionicons name="repeat" size={16} color="#FF9800" />
          </View>
          <Text className="text-base font-JakartaBold text-gray-800">{item.name}</Text>
        </View>
        <TouchableOpacity 
          onPress={() => handleDeleteRoute(item.id)}
          className="p-1"
        >
          <Feather name="trash-2" size={16} color="#FF4444" />
        </TouchableOpacity>
      </View>
      
      <View className="pl-2">
        <View className="flex-row items-center">
          <View className="w-2 h-2 rounded-full bg-brand-500 mr-3" />
          <Text className="text-xs font-JakartaMedium text-gray-500 flex-1" numberOfLines={1}>
            {item.origin_address}
          </Text>
        </View>
        <View className="w-0.5 h-3 bg-gray-200 ml-0.75 my-0.5" />
        <View className="flex-row items-center">
          <View className="w-2 h-2 rounded-full bg-green-500 mr-3" />
          <Text className="text-xs font-JakartaMedium text-gray-500 flex-1" numberOfLines={1}>
            {item.destination_address}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50 px-5">
      {/* Header */}
      <View className="flex flex-row items-center py-4">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text className="text-xl font-JakartaBold">{t("favorites")}</Text>
      </View>

      {/* Tabs */}
      <View className="flex-row bg-gray-100 p-1.5 rounded-2xl mb-5">
        <TouchableOpacity 
          onPress={() => setActiveTab('addresses')}
          className={`flex-1 py-3 rounded-xl items-center ${activeTab === 'addresses' ? 'bg-white shadow-sm' : ''}`}
        >
          <Text className={`font-JakartaBold ${activeTab === 'addresses' ? 'text-black' : 'text-gray-500'}`}>{t("addresses")}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setActiveTab('routes')}
          className={`flex-1 py-3 rounded-xl items-center ${activeTab === 'routes' ? 'bg-white shadow-sm' : ''}`}
        >
          <Text className={`font-JakartaBold ${activeTab === 'routes' ? 'text-black' : 'text-gray-500'}`}>{t("routes")}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FF9800" />
        </View>
      ) : activeTab === 'addresses' ? (
        addresses.length === 0 ? (
          <View className="flex-1 items-center justify-center px-10">
            <Ionicons name="location-outline" size={60} color="#CCC" />
            <Text className="text-lg font-JakartaBold text-gray-800 mt-4">{t("noSavedAddresses")}</Text>
            <Text className="text-sm font-JakartaMedium text-gray-400 text-center mt-2">
              {t("saveAddressesHint")}
            </Text>
          </View>
        ) : (
          <FlatList
            data={addresses}
            renderItem={renderAddressItem}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
          />
        )
      ) : (
        routes.length === 0 ? (
          <View className="flex-1 items-center justify-center px-10">
            <Ionicons name="map-outline" size={60} color="#CCC" />
            <Text className="text-lg font-JakartaBold text-gray-800 mt-4">{t("noSavedRoutes")}</Text>
            <Text className="text-sm font-JakartaMedium text-gray-400 text-center mt-2">
              {t("saveRoutesHint")}
            </Text>
          </View>
        ) : (
          <FlatList
            data={routes}
            renderItem={renderRouteItem}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
          />
        )
      )}
    </SafeAreaView>
  );
}
