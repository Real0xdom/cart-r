"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const CustomButton_1 = __importDefault(require("@/components/CustomButton"));
const RideLayout_1 = __importDefault(require("@/components/RideLayout"));
const store_1 = require("@/store");
const expo_router_1 = require("expo-router");
const react_1 = require("react");
const react_native_1 = require("react-native");
const vector_icons_1 = require("@expo/vector-icons");
const ReceiverDetailsPage = () => {
    const { destinationAddress, destinationLatitude, destinationLongitude, } = (0, store_1.useLocationStore)();
    const { setReceiverDetails, receiverDetails: savedDetails } = (0, store_1.useBookingStore)();
    // Redirect back if no destination set
    (0, react_1.useEffect)(() => {
        if (!destinationAddress || !destinationLatitude || !destinationLongitude) {
            expo_router_1.router.replace("/find-ride");
        }
    }, [destinationAddress, destinationLatitude, destinationLongitude]);
    // Receiver details state - initialize from store if available
    const [receiverName, setReceiverName] = (0, react_1.useState)((savedDetails === null || savedDetails === void 0 ? void 0 : savedDetails.name) || '');
    const [receiverPhone, setReceiverPhone] = (0, react_1.useState)((savedDetails === null || savedDetails === void 0 ? void 0 : savedDetails.phone) || '');
    const [selectedSaveAs, setSelectedSaveAs] = (0, react_1.useState)((savedDetails === null || savedDetails === void 0 ? void 0 : savedDetails.saveAs) || null);
    // Save as options
    const saveAsOptions = ['Home', 'Office', 'Friend', 'Family', 'Other'];
    const handleProceed = () => {
        if (!receiverName.trim()) {
            react_native_1.Alert.alert("Required", "Please enter receiver's name");
            return;
        }
        if (!receiverPhone.trim()) {
            react_native_1.Alert.alert("Required", "Please enter receiver's mobile number");
            return;
        }
        if (receiverPhone.length < 10) {
            react_native_1.Alert.alert("Invalid", "Please enter a valid mobile number");
            return;
        }
        // Save receiver details to store
        setReceiverDetails({
            name: receiverName.trim(),
            phone: receiverPhone.trim(),
            saveAs: selectedSaveAs || undefined,
        });
        // Navigate to select vehicle
        expo_router_1.router.push("/select-vehicle");
    };
    const canProceed = receiverName.trim() && receiverPhone.trim();
    return (<RideLayout_1.default title="Receiver Details" snapPoints={["40%", "70%", "90%"]}>
      <react_native_1.View>


        {/* Receiver Details Form */}
        <react_native_1.View className="mb-6">
          <react_native_1.Text className="text-xl font-JakartaBold text-gray-800 mb-4">
            Who will receive this?
          </react_native_1.Text>

          {/* Receiver Name */}
          <react_native_1.View className="mb-4">
            <react_native_1.Text className="text-sm font-JakartaSemiBold text-gray-700 mb-2">
              Receiver's Name <react_native_1.Text className="text-red-500">*</react_native_1.Text>
            </react_native_1.Text>
            <react_native_1.View className="flex-row items-center bg-gray-100 rounded-xl px-4">
              <vector_icons_1.Feather name="user" size={18} color="#777"/>
              <react_native_1.TextInput className="flex-1 py-4 px-3 font-JakartaMedium text-base text-gray-800" placeholder="Enter receiver's full name" placeholderTextColor="#999" value={receiverName} onChangeText={setReceiverName} autoCapitalize="words"/>
              {receiverName.trim() && (<vector_icons_1.Feather name="check-circle" size={18} color="#22c55e"/>)}
            </react_native_1.View>
          </react_native_1.View>

          {/* Receiver Phone */}
          <react_native_1.View className="mb-4">
            <react_native_1.Text className="text-sm font-JakartaSemiBold text-gray-700 mb-2">
              Receiver's Mobile Number <react_native_1.Text className="text-red-500">*</react_native_1.Text>
            </react_native_1.Text>
            <react_native_1.View className="flex-row items-center bg-gray-100 rounded-xl px-4">
              <react_native_1.Text className="font-JakartaMedium text-gray-500 mr-2">+91</react_native_1.Text>
              <react_native_1.View className="w-px h-6 bg-gray-300 mr-3"/>
              <react_native_1.TextInput className="flex-1 py-4 font-JakartaMedium text-base text-gray-800" placeholder="Enter 10-digit mobile number" placeholderTextColor="#999" keyboardType="phone-pad" maxLength={10} value={receiverPhone} onChangeText={(text) => setReceiverPhone(text.replace(/[^0-9]/g, ''))}/>
              {receiverPhone.length === 10 && (<vector_icons_1.Feather name="check-circle" size={18} color="#22c55e"/>)}
            </react_native_1.View>
            {receiverPhone.length > 0 && receiverPhone.length < 10 && (<react_native_1.Text className="text-xs font-JakartaMedium text-orange-500 mt-1 ml-1">
                {10 - receiverPhone.length} more digits needed
              </react_native_1.Text>)}
          </react_native_1.View>

          {/* Save As */}
          <react_native_1.View className="mb-6">
            <react_native_1.Text className="text-sm font-JakartaSemiBold text-gray-700 mb-3">
              Save this contact as <react_native_1.Text className="text-gray-400">(Optional)</react_native_1.Text>
            </react_native_1.Text>
            <react_native_1.ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <react_native_1.View className="flex-row gap-2">
                {saveAsOptions.map((option) => (<react_native_1.TouchableOpacity key={option} onPress={() => setSelectedSaveAs(selectedSaveAs === option ? null : option)} className={`px-4 py-2 rounded-full border ${selectedSaveAs === option
                ? 'bg-blue-500 border-blue-500'
                : 'bg-white border-gray-300'}`}>
                    <react_native_1.View className="flex-row items-center">
                      <vector_icons_1.Feather name={option === 'Home' ? 'home' :
                option === 'Office' ? 'briefcase' :
                    option === 'Friend' ? 'users' :
                        option === 'Family' ? 'heart' : 'bookmark'} size={14} color={selectedSaveAs === option ? '#fff' : '#777'}/>
                      <react_native_1.Text className={`ml-2 font-JakartaMedium ${selectedSaveAs === option ? 'text-white' : 'text-gray-700'}`}>
                        {option}
                      </react_native_1.Text>
                    </react_native_1.View>
                  </react_native_1.TouchableOpacity>))}
              </react_native_1.View>
            </react_native_1.ScrollView>
          </react_native_1.View>
        </react_native_1.View>



        {/* Navigation Buttons */}
        <react_native_1.View className="flex-row gap-3 mb-6">
          <react_native_1.TouchableOpacity onPress={() => expo_router_1.router.back()} className="flex-1 bg-gray-100 py-4 rounded-xl items-center flex-row justify-center">
            <vector_icons_1.Feather name="arrow-left" size={18} color="#333"/>
            <react_native_1.Text className="ml-2 font-JakartaSemiBold text-gray-700">Back</react_native_1.Text>
          </react_native_1.TouchableOpacity>
          
          <CustomButton_1.default title="Select Vehicle →" onPress={handleProceed} className="flex-1" bgVariant={canProceed ? "primary" : "secondary"} disabled={!canProceed}/>
        </react_native_1.View>
      </react_native_1.View>
    </RideLayout_1.default>);
};
exports.default = ReceiverDetailsPage;
