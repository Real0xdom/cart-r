import CustomButton from "@/components/CustomButton";
import RideLayout from "@/components/RideLayout";
import { useLocationStore, useBookingStore } from "@/store";
import { useLanguage } from "@/contexts/LanguageContext";
import { router } from "expo-router";
import { useState, useEffect } from "react";
import { 
  Text, 
  View, 
  TouchableOpacity, 
  TextInput,
  ScrollView,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";

const ReceiverDetailsPage = () => {
  const { t } = useLanguage();
  const {
    destinationAddress,
    destinationLatitude,
    destinationLongitude,
  } = useLocationStore();

  const { setReceiverDetails, receiverDetails: savedDetails } = useBookingStore();

  // Redirect back if no destination set
  useEffect(() => {
    if (!destinationAddress || !destinationLatitude || !destinationLongitude) {
      router.replace("/find-ride");
    }
  }, [destinationAddress, destinationLatitude, destinationLongitude]);

  // Receiver details state - initialize from store if available
  const [receiverName, setReceiverName] = useState(savedDetails?.name || '');
  const [receiverPhone, setReceiverPhone] = useState(savedDetails?.phone || '');
  const initialSaveAs =
    savedDetails?.saveAs && ["Home", "Office", "Friend"].includes(savedDetails.saveAs)
      ? savedDetails.saveAs
      : null;
  const [selectedSaveAs, setSelectedSaveAs] = useState<string | null>(initialSaveAs);

  // Save as options
  const saveAsOptions = ['Home', 'Office', 'Friend'];
  const saveAsLabels: Record<string, string> = {
    Home: t('homeLabel'),
    Office: t('office'),
    Friend: t('friend'),
  };

  const handleProceed = () => {
    if (!receiverName.trim()) {
      Alert.alert("Required", "Please enter receiver's name");
      return;
    }
    if (!receiverPhone.trim()) {
      Alert.alert("Required", "Please enter receiver's mobile number");
      return;
    }
    if (receiverPhone.length < 10) {
      Alert.alert("Invalid", "Please enter a valid mobile number");
      return;
    }

    // Save receiver details to store
    setReceiverDetails({
      name: receiverName.trim(),
      phone: receiverPhone.trim(),
      saveAs: selectedSaveAs || undefined,
    });

    // Navigate to select vehicle
    router.push("/select-vehicle");
  };

  const canProceed = receiverName.trim() && receiverPhone.trim();

  return (
    <RideLayout 
      title={t("receiverDetails")} 
      snapPoints={["40%", "70%", "90%"]}
    >
      <View>


        {/* Receiver Details Form */}
        <View className="mb-6">
          <Text className="text-xl font-JakartaBold text-gray-800 mb-4">
            {t("whoWillReceive")}
          </Text>

          {/* Receiver Name */}
          <View className="mb-4">
            <Text className="text-sm font-JakartaSemiBold text-gray-700 mb-2">
              Receiver's Name <Text className="text-red-500">*</Text>
            </Text>
            <View className="flex-row items-center bg-gray-100 rounded-xl px-4">
              <Feather name="user" size={18} color="#777" />
              <TextInput
                className="flex-1 py-4 px-3 font-JakartaMedium text-base text-gray-800"
                placeholder="Enter receiver's full name"
                placeholderTextColor="#999"
                value={receiverName}
                testID="receiver.nameInput"
                accessibilityLabel="receiver.nameInput"
                onChangeText={setReceiverName}
                autoCapitalize="words"
              />
              {receiverName.trim() && (
                <Feather name="check-circle" size={18} color="#22c55e" />
              )}
            </View>
          </View>

          {/* Receiver Phone */}
          <View className="mb-4">
            <Text className="text-sm font-JakartaSemiBold text-gray-700 mb-2">
              Receiver's Mobile Number <Text className="text-red-500">*</Text>
            </Text>
            <View className="flex-row items-center bg-gray-100 rounded-xl px-4">
              <Text className="font-JakartaMedium text-gray-500 mr-2">+91</Text>
              <View className="w-px h-6 bg-gray-300 mr-3" />
              <TextInput
                className="flex-1 py-4 font-JakartaMedium text-base text-gray-800"
                placeholder="Enter 10-digit mobile number"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
                maxLength={10}
                value={receiverPhone}
                testID="receiver.phoneInput"
                accessibilityLabel="receiver.phoneInput"
                onChangeText={(text) => setReceiverPhone(text.replace(/[^0-9]/g, ''))}
              />
              {receiverPhone.length === 10 && (
                <Feather name="check-circle" size={18} color="#22c55e" />
              )}
            </View>
            {receiverPhone.length > 0 && receiverPhone.length < 10 && (
              <Text className="text-xs font-JakartaMedium text-orange-500 mt-1 ml-1">
                {10 - receiverPhone.length} more digits needed
              </Text>
            )}
          </View>

          {/* Save As */}
          <View className="mb-6">
            <Text className="text-sm font-JakartaSemiBold text-gray-700 mb-3">
              Save this contact as <Text className="text-gray-400">(Optional)</Text>
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              directionalLockEnabled
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingRight: 8 }}
            >
              {saveAsOptions.map((option, index) => (
                <TouchableOpacity
                  key={option}
                  onPress={() => setSelectedSaveAs(selectedSaveAs === option ? null : option)}
                  style={{ marginRight: index === saveAsOptions.length - 1 ? 0 : 8 }}
                  className={`px-4 py-2 rounded-full border ${
                    selectedSaveAs === option 
                      ? 'bg-success-200 border-success-400' 
                      : 'bg-white border-gray-300'
                  }`}
                >
                  <View className="flex-row items-center">
                    <Feather 
                      name={
                        option === 'Home' ? 'home' :
                        option === 'Office' ? 'briefcase' : 'users'
                      } 
                      size={14} 
                      color={selectedSaveAs === option ? '#22543D' : '#777'} 
                    />
                    <Text className={`ml-2 font-JakartaMedium ${
                      selectedSaveAs === option ? 'text-success-800' : 'text-gray-700'
                    }`}>
                      {saveAsLabels[option] ?? option}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>



        {/* Navigation Buttons */}
        <View className="flex-row gap-3 mb-6">
          <TouchableOpacity 
            onPress={() => router.back()}
            className="flex-1 bg-gray-100 py-4 rounded-xl items-center flex-row justify-center"
          >
            <Feather name="arrow-left" size={18} color="#333" />
            <Text className="ml-2 font-JakartaSemiBold text-gray-700">Back</Text>
          </TouchableOpacity>
          
          <CustomButton
            title="Select Vehicle ->"
            onPress={handleProceed}
            testID="receiver.nextToVehicle"
            accessibilityLabel="receiver.nextToVehicle"
            className="flex-1"
            bgVariant={canProceed ? "primary" : "secondary"}
            disabled={!canProceed}
          />
        </View>
      </View>
    </RideLayout>
  );
};

export default ReceiverDetailsPage;

