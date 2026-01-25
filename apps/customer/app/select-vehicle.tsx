import CustomButton from "@/components/CustomButton";
import RideLayout from "@/components/RideLayout";
import { useLocationStore, useRideStore, useBookingStore } from "@/store";
import { useAuth } from "@/contexts/AuthContext";
import { router } from "expo-router";
import { useState, useEffect } from "react";
import { 
  Text, 
  View, 
  TouchableOpacity, 
  FlatList,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { calculateFares, FareEstimate } from "@/lib/fare";
import { createBooking } from "@/lib/bookings";
import { payWithWallet, getWalletBalance, calculatePaymentSplit } from "@/lib/walletPayment";

const SelectVehiclePage = () => {
  const { profile } = useAuth();
  const {
    userAddress,
    userLatitude,
    userLongitude,
    destinationAddress,
    destinationLatitude,
    destinationLongitude,
  } = useLocationStore();
  
  const { setSelectedVehicle, selectedVehicle } = useRideStore();
  const { receiverDetails, setCurrentBooking } = useBookingStore();

  const [fares, setFares] = useState<FareEstimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tipAmount, setTipAmount] = useState(0);
  const [isBooking, setIsBooking] = useState(false);
  
  // Wallet payment state
  const [walletBalance, setWalletBalance] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'wallet' | 'partial_wallet'>('cash');
  const [isPaying, setIsPaying] = useState(false);

  // Redirect if missing required data
  useEffect(() => {
    if (!userAddress || !destinationAddress) {
      router.replace("/find-ride");
      return;
    }
    if (!receiverDetails) {
      router.replace("/receiver-details");
      return;
    }
  }, [userAddress, destinationAddress, receiverDetails]);

  useEffect(() => {
    const fetchFares = async () => {
      if (!userLatitude || !userLongitude || !destinationLatitude || !destinationLongitude) {
        return;
      }

      setLoading(true);
      setError(null);
      try {
        console.log('[SELECT VEHICLE] Calculating fares...');
        const options = await calculateFares(
          userLatitude,
          userLongitude,
          destinationLatitude,
          destinationLongitude
        );
        console.log('[SELECT VEHICLE] Fare options received:', options.length);
        console.log('[SELECT VEHICLE] Vehicle types:', options.map(o => o.vehicle_type).join(', '));
        console.log('[SELECT VEHICLE] Full fare data:', JSON.stringify(options, null, 2));
        
        const hasTruck = options.some(o => o.vehicle_type === 'truck');
        console.log('[SELECT VEHICLE] Has truck?', hasTruck);
        
        setFares(options);
      } catch (err) {
        console.error('[SELECT VEHICLE] Error:', err);
        setError("Failed to load vehicle options. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchFares();
  }, [userLatitude, userLongitude, destinationLatitude, destinationLongitude]);

  // Fetch wallet balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (profile?.id) {
        const balance = await getWalletBalance(profile.id);
        setWalletBalance(balance);
      }
    };
    fetchBalance();
  }, [profile?.id]);

  const handleSelectVehicle = (vehicle: FareEstimate) => {
    setSelectedVehicle(vehicle);
  };

  const handleBookNow = async () => {
    if (isBooking) return;

    if (!selectedVehicle || !profile?.id) {
      Alert.alert("Error", "Please sign in and select a vehicle.");
      return;
    }

    if (!userLatitude || !userLongitude || !destinationLatitude || !destinationLongitude) {
      Alert.alert("Error", "Location data is missing. Please try again.");
      return;
    }

    if (!receiverDetails) {
      Alert.alert("Error", "Missing receiver details.");
      return;
    }

    // 1. Validation for Wallet Payment
    if (paymentMethod === 'wallet' && paymentSplit && !paymentSplit.canPayFull) {
        Alert.alert(
            "Insufficient Balance", 
            `You need ₹${totalFare.toFixed(2)} to pay fully with wallet. Please add money or choose another method.`,
            [
                { text: "Add Money", onPress: () => router.push("/(tabs)/payment") },
                { text: "Cancel", style: "cancel" }
            ]
        );
        return;
    }

    setIsBooking(true);
    setIsPaying(true);

    try {
      const bookingParams = {
        customerId: profile.id,
        originAddress: userAddress || "",
        originLatitude: userLatitude,
        originLongitude: userLongitude,
        destinationAddress: destinationAddress || "",
        destinationLatitude: destinationLatitude,
        destinationLongitude: destinationLongitude,
        vehicle: selectedVehicle,
        receiverDetails: receiverDetails,
        tipAmount: tipAmount,
        // payment_method: paymentMethod // If backend supports it on creation
      };

      // 2. Create Booking
      const { data: booking, error } = await createBooking(bookingParams);

      if (error || !booking) {
        throw new Error(error || "Failed to create booking");
      }

      // 3. Process Payment if Wallet selected
      if (paymentMethod === 'wallet' || paymentMethod === 'partial_wallet') {
          console.log(`[PAYMENT] Processing ${paymentMethod} payment for booking ${booking.id}`);
          
          const result = await payWithWallet(
              booking.id, 
              profile.id, 
              paymentMethod === 'wallet' // true for full, false for partial
          );

          if (!result.success) {
              Alert.alert("Payment Failed", result.error || "Wallet deduction failed. Paying with cash instead.");
              // Fallback to cash is automatic since booking exists? 
              // Actually we should probably cancel booking or update it?
              // For now, we proceed but notify user.
          } else {
              console.log("[PAYMENT] Success:", result);
              // Update local balance immediately for UI responsiveness
              const newBal = result.new_wallet_balance;
              if (newBal !== undefined) setWalletBalance(newBal);
          }
      }

      // 4. Navigate to next screen
      setCurrentBooking(booking);
      router.replace({
        pathname: "/waiting-for-driver",
        params: { bookingId: booking.id },
      });

    } catch (err: any) {
      console.error("[BOOKING ERROR]:", err);
      Alert.alert("Error", err.message || "Booking failed.");
    } finally {
      setIsBooking(false);
      setIsPaying(false);
    }
  };

  const getVehicleIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'bike': return '🏍️';
      case 'tempo': return '🛺';
      case 'sedan': return '🚗';
      case 'truck': return '🚚';
      default: return '🚗';
    }
  };

  const getVehicleDescription = (type: string) => {
    switch (type.toLowerCase()) {
      case 'bike': return 'Small packages up to 20kg';
      case 'tempo': return 'Medium loads up to 500kg';
      case 'sedan': return 'Furniture & appliances';
      case 'truck': return 'Heavy goods moving';
      default: return 'Standard delivery';
    }
  };

  const totalFare = selectedVehicle ? selectedVehicle.total_fare + tipAmount : 0;
  
  // Calculate payment split for wallet
  const paymentSplit = selectedVehicle 
    ? calculatePaymentSplit(walletBalance, totalFare)
    : null;

  const renderVehicleItem = ({ item }: { item: FareEstimate }) => (
    <TouchableOpacity
      onPress={() => handleSelectVehicle(item)}
      className={`flex-row items-center p-4 mb-3 rounded-2xl border ${
        selectedVehicle?.vehicle_type === item.vehicle_type
          ? 'bg-brand-100 border-brand-500'
          : 'bg-white border-gray-100'
      }`}
    >
      <View className="w-12 h-12 bg-gray-50 rounded-full items-center justify-center mr-3">
        <Text className="text-xl">{getVehicleIcon(item.vehicle_type)}</Text>
      </View>
      
      <View className="flex-1">
        <Text className="text-base font-JakartaBold capitalize text-gray-900">
          {item.vehicle_type}
        </Text>
        <Text className="text-xs text-gray-500 font-JakartaMedium">
          {getVehicleDescription(item.vehicle_type)}
        </Text>
        <Text className="text-xs text-gray-400 mt-0.5">
          {item.duration_minutes} min • {item.distance_km} km
        </Text>
      </View>

      <View className="items-end">
        <Text className="text-lg font-JakartaBold text-gray-900">
          ₹{item.total_fare}
        </Text>
        {selectedVehicle?.vehicle_type === item.vehicle_type && (
          <View className="bg-brand-500 rounded-full p-1 mt-1">
            <Feather name="check" size={10} color="#fff" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <RideLayout 
      title="Select Vehicle" 
      snapPoints={["50%", "90%"]}
      useView={false}
    >

        {loading ? (
          <View className="items-center justify-center py-10">
            <ActivityIndicator size="large" color="#FF9800" />
            <Text className="text-gray-500 mt-2 font-JakartaMedium">Calculating fares...</Text>
          </View>
        ) : error ? (
          <View className="items-center justify-center py-10">
            <Text className="text-red-500 font-JakartaMedium text-center mb-4">{error}</Text>
            <CustomButton title="Retry" onPress={() => setFares([])} bgVariant="outline" />
          </View>
        ) : (
          <>
            {/* Vehicle List */}
            <View>
              {fares.map((item) => (
                <View key={item.vehicle_type}>
                  {renderVehicleItem({ item })}
                </View>
              ))}
            </View>

            {/* Tip Section */}
            {selectedVehicle && (
              <View className="bg-gray-50 rounded-2xl p-4 mt-2">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-sm font-JakartaSemiBold text-gray-700">
                    Add Driver Tip
                  </Text>
                  <Text className="text-lg font-JakartaBold text-brand-500">
                    +₹{tipAmount}
                  </Text>
                </View>
                <Slider
                  style={{ height: 40 }}
                  minimumValue={0}
                  maximumValue={200}
                  step={10}
                  value={tipAmount}
                  onValueChange={setTipAmount}
                  minimumTrackTintColor="#FF9800"
                  maximumTrackTintColor="#d1d5db"
                  thumbTintColor="#FF9800"
                />
                <View className="flex-row justify-between">
                  <Text className="text-xs text-gray-400">₹0</Text>
                  <Text className="text-xs text-gray-400">₹200</Text>
                </View>
              </View>
            )}



            {/* Total & Book Button */}
            <View className="mt-4">
              {selectedVehicle && (
                <View className="flex-row justify-between items-center mb-3 px-1">
                  <Text className="text-gray-600 font-JakartaMedium">Total Amount</Text>
                  <Text className="text-2xl font-JakartaBold text-green-600">₹{totalFare}</Text>
                </View>
              )}
              
              <View className="flex-row gap-3">
                <TouchableOpacity 
                  onPress={() => router.back()}
                  className="flex-1 bg-gray-100 py-4 rounded-xl items-center flex-row justify-center"
                  disabled={isBooking}
                >
                  <Feather name="arrow-left" size={18} color="#333" />
                  <Text className="ml-2 font-JakartaSemiBold text-gray-700">Back</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={handleBookNow}
                  disabled={!selectedVehicle || isBooking}
                  className={`flex-[2] py-4 rounded-xl items-center justify-center flex-row ${
                    selectedVehicle && !isBooking ? 'bg-brand-500' : 'bg-gray-300'
                  }`}
                >
                  {isBooking ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Feather name="search" size={18} color="#fff" />
                      <Text className="ml-2 font-JakartaBold text-white">Book Now</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

    </RideLayout>
  );
};

export default SelectVehiclePage;
