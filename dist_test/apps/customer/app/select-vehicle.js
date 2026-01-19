"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const CustomButton_1 = __importDefault(require("@/components/CustomButton"));
const RideLayout_1 = __importDefault(require("@/components/RideLayout"));
const store_1 = require("@/store");
const AuthContext_1 = require("@/contexts/AuthContext");
const expo_router_1 = require("expo-router");
const react_1 = require("react");
const react_native_1 = require("react-native");
const vector_icons_1 = require("@expo/vector-icons");
const slider_1 = __importDefault(require("@react-native-community/slider"));
const fare_1 = require("@/lib/fare");
const bookings_1 = require("@/lib/bookings");
const SelectVehiclePage = () => {
    const { profile } = (0, AuthContext_1.useAuth)();
    const { userAddress, userLatitude, userLongitude, destinationAddress, destinationLatitude, destinationLongitude, } = (0, store_1.useLocationStore)();
    const { setSelectedVehicle, selectedVehicle } = (0, store_1.useRideStore)();
    const { receiverDetails, setCurrentBooking } = (0, store_1.useBookingStore)();
    const [fares, setFares] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    const [tipAmount, setTipAmount] = (0, react_1.useState)(0);
    const [isBooking, setIsBooking] = (0, react_1.useState)(false);
    // Redirect if missing required data
    (0, react_1.useEffect)(() => {
        if (!userAddress || !destinationAddress) {
            expo_router_1.router.replace("/find-ride");
            return;
        }
        if (!receiverDetails) {
            expo_router_1.router.replace("/receiver-details");
            return;
        }
    }, [userAddress, destinationAddress, receiverDetails]);
    (0, react_1.useEffect)(() => {
        const fetchFares = async () => {
            if (!userLatitude || !userLongitude || !destinationLatitude || !destinationLongitude) {
                return;
            }
            setLoading(true);
            setError(null);
            try {
                console.log('[SELECT VEHICLE] Calculating fares...');
                const options = await (0, fare_1.calculateFares)(userLatitude, userLongitude, destinationLatitude, destinationLongitude);
                console.log('[SELECT VEHICLE] Fare options received:', options.length);
                console.log('[SELECT VEHICLE] Vehicle types:', options.map(o => o.vehicle_type).join(', '));
                console.log('[SELECT VEHICLE] Full fare data:', JSON.stringify(options, null, 2));
                const hasTruck = options.some(o => o.vehicle_type === 'truck');
                console.log('[SELECT VEHICLE] Has truck?', hasTruck);
                setFares(options);
            }
            catch (err) {
                console.error('[SELECT VEHICLE] Error:', err);
                setError("Failed to load vehicle options. Please try again.");
            }
            finally {
                setLoading(false);
            }
        };
        fetchFares();
    }, [userLatitude, userLongitude, destinationLatitude, destinationLongitude]);
    const handleSelectVehicle = (vehicle) => {
        setSelectedVehicle(vehicle);
    };
    const handleBookNow = async () => {
        console.log('========================================');
        console.log('[BOOK NOW] Button clicked');
        console.log('[BOOK NOW] Selected vehicle:', selectedVehicle);
        console.log('[BOOK NOW] Receiver details:', receiverDetails);
        console.log('========================================');
        if (!selectedVehicle)
            return;
        if (!(profile === null || profile === void 0 ? void 0 : profile.id)) {
            react_native_1.Alert.alert("Error", "Please sign in to continue");
            return;
        }
        if (!userLatitude || !userLongitude || !destinationLatitude || !destinationLongitude) {
            react_native_1.Alert.alert("Error", "Location data is missing. Please try again.");
            return;
        }
        if (!receiverDetails) {
            react_native_1.Alert.alert("Error", "Receiver details are missing. Please go back.");
            return;
        }
        setIsBooking(true);
        try {
            console.log('[BOOK NOW] Calling createBooking...');
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
            };
            console.log('[BOOK NOW] Booking params:', JSON.stringify(bookingParams, null, 2));
            const { data: booking, error } = await (0, bookings_1.createBooking)(bookingParams);
            console.log('[BOOK NOW] Booking result:', { booking, error });
            if (error || !booking) {
                console.error('[BOOK NOW] Error creating booking:', error);
                react_native_1.Alert.alert("Error", error || "Failed to create booking. Please try again.");
                setIsBooking(false);
                return;
            }
            console.log('[BOOK NOW] Booking created successfully:', booking.id);
            // Save booking to store
            setCurrentBooking(booking);
            // Navigate to waiting screen
            expo_router_1.router.replace({
                pathname: "/waiting-for-driver",
                params: { bookingId: booking.id },
            });
        }
        catch (err) {
            console.error("[BOOK NOW] Booking creation failed:", err);
            react_native_1.Alert.alert("Error", err.message || "Something went wrong. Please try again.");
            setIsBooking(false);
        }
    };
    const getVehicleIcon = (type) => {
        switch (type.toLowerCase()) {
            case 'bike': return '🏍️';
            case 'tempo': return '🛺';
            case 'sedan': return '🚗';
            case 'truck': return '🚚';
            default: return '🚗';
        }
    };
    const getVehicleDescription = (type) => {
        switch (type.toLowerCase()) {
            case 'bike': return 'Small packages up to 20kg';
            case 'tempo': return 'Medium loads up to 500kg';
            case 'sedan': return 'Furniture & appliances';
            case 'truck': return 'Heavy goods moving';
            default: return 'Standard delivery';
        }
    };
    const totalFare = selectedVehicle ? selectedVehicle.total_fare + tipAmount : 0;
    const renderVehicleItem = ({ item }) => (<react_native_1.TouchableOpacity onPress={() => handleSelectVehicle(item)} className={`flex-row items-center p-4 mb-3 rounded-2xl border ${(selectedVehicle === null || selectedVehicle === void 0 ? void 0 : selectedVehicle.vehicle_type) === item.vehicle_type
            ? 'bg-brand-100 border-brand-500'
            : 'bg-white border-gray-100'}`}>
      <react_native_1.View className="w-12 h-12 bg-gray-50 rounded-full items-center justify-center mr-3">
        <react_native_1.Text className="text-xl">{getVehicleIcon(item.vehicle_type)}</react_native_1.Text>
      </react_native_1.View>
      
      <react_native_1.View className="flex-1">
        <react_native_1.Text className="text-base font-JakartaBold capitalize text-gray-900">
          {item.vehicle_type}
        </react_native_1.Text>
        <react_native_1.Text className="text-xs text-gray-500 font-JakartaMedium">
          {getVehicleDescription(item.vehicle_type)}
        </react_native_1.Text>
        <react_native_1.Text className="text-xs text-gray-400 mt-0.5">
          {item.duration_minutes} min • {item.distance_km} km
        </react_native_1.Text>
      </react_native_1.View>

      <react_native_1.View className="items-end">
        <react_native_1.Text className="text-lg font-JakartaBold text-gray-900">
          ₹{item.total_fare}
        </react_native_1.Text>
        {(selectedVehicle === null || selectedVehicle === void 0 ? void 0 : selectedVehicle.vehicle_type) === item.vehicle_type && (<react_native_1.View className="bg-brand-500 rounded-full p-1 mt-1">
            <vector_icons_1.Feather name="check" size={10} color="#fff"/>
          </react_native_1.View>)}
      </react_native_1.View>
    </react_native_1.TouchableOpacity>);
    return (<RideLayout_1.default title="Select Vehicle" snapPoints={["50%", "85%"]} useView={true}>
      <react_native_1.ScrollView className="flex-1" showsVerticalScrollIndicator={true} bounces={true}>
        {loading ? (<react_native_1.View className="items-center justify-center py-10">
            <react_native_1.ActivityIndicator size="large" color="#FF9800"/>
            <react_native_1.Text className="text-gray-500 mt-2 font-JakartaMedium">Calculating fares...</react_native_1.Text>
          </react_native_1.View>) : error ? (<react_native_1.View className="items-center justify-center py-10">
            <react_native_1.Text className="text-red-500 font-JakartaMedium text-center mb-4">{error}</react_native_1.Text>
            <CustomButton_1.default title="Retry" onPress={() => setFares([])} bgVariant="outline"/>
          </react_native_1.View>) : (<>
            {/* Vehicle List */}
            <react_native_1.View>
              {fares.map((item) => (<react_native_1.View key={item.vehicle_type}>
                  {renderVehicleItem({ item })}
                </react_native_1.View>))}
            </react_native_1.View>

            {/* Tip Section */}
            {selectedVehicle && (<react_native_1.View className="bg-gray-50 rounded-2xl p-4 mt-2">
                <react_native_1.View className="flex-row justify-between items-center mb-2">
                  <react_native_1.Text className="text-sm font-JakartaSemiBold text-gray-700">
                    Add Driver Tip
                  </react_native_1.Text>
                  <react_native_1.Text className="text-lg font-JakartaBold text-brand-500">
                    +₹{tipAmount}
                  </react_native_1.Text>
                </react_native_1.View>
                <slider_1.default style={{ height: 40 }} minimumValue={0} maximumValue={200} step={10} value={tipAmount} onValueChange={setTipAmount} minimumTrackTintColor="#FF9800" maximumTrackTintColor="#d1d5db" thumbTintColor="#FF9800"/>
                <react_native_1.View className="flex-row justify-between">
                  <react_native_1.Text className="text-xs text-gray-400">₹0</react_native_1.Text>
                  <react_native_1.Text className="text-xs text-gray-400">₹200</react_native_1.Text>
                </react_native_1.View>
              </react_native_1.View>)}

            {/* Total & Book Button */}
            <react_native_1.View className="mt-4">
              {selectedVehicle && (<react_native_1.View className="flex-row justify-between items-center mb-3 px-1">
                  <react_native_1.Text className="text-gray-600 font-JakartaMedium">Total Amount</react_native_1.Text>
                  <react_native_1.Text className="text-2xl font-JakartaBold text-green-600">₹{totalFare}</react_native_1.Text>
                </react_native_1.View>)}
              
              <react_native_1.View className="flex-row gap-3">
                <react_native_1.TouchableOpacity onPress={() => expo_router_1.router.back()} className="flex-1 bg-gray-100 py-4 rounded-xl items-center flex-row justify-center" disabled={isBooking}>
                  <vector_icons_1.Feather name="arrow-left" size={18} color="#333"/>
                  <react_native_1.Text className="ml-2 font-JakartaSemiBold text-gray-700">Back</react_native_1.Text>
                </react_native_1.TouchableOpacity>
                
                <react_native_1.TouchableOpacity onPress={handleBookNow} disabled={!selectedVehicle || isBooking} className={`flex-[2] py-4 rounded-xl items-center justify-center flex-row ${selectedVehicle && !isBooking ? 'bg-brand-500' : 'bg-gray-300'}`}>
                  {isBooking ? (<react_native_1.ActivityIndicator size="small" color="#fff"/>) : (<>
                      <vector_icons_1.Feather name="search" size={18} color="#fff"/>
                      <react_native_1.Text className="ml-2 font-JakartaBold text-white">Book Now</react_native_1.Text>
                    </>)}
                </react_native_1.TouchableOpacity>
              </react_native_1.View>
            </react_native_1.View>
          </>)}
      </react_native_1.ScrollView>
    </RideLayout_1.default>);
};
exports.default = SelectVehiclePage;
