import { useMemo, useState } from "react";
import {
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Modal from "react-native-modal";

import { DropdownFieldProps } from "@/types/type";

const DropdownField = ({
  label,
  options,
  value,
  onSelect,
  placeholder = "Select an option",
  searchPlaceholder = "Search",
  icon,
  labelStyle,
  containerStyle,
  inputStyle,
  iconStyle,
  error = false,
  searchable = false,
}: DropdownFieldProps) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedOption = options.find((opt) => opt.value === value);
  const displayValue = selectedOption?.label || value;

  const filteredOptions = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) =>
      option.label.toLowerCase().includes(normalizedQuery)
    );
  }, [options, searchQuery]);

  const closeModal = () => {
    setSearchQuery("");
    setModalVisible(false);
  };

  return (
    <View className={`my-2 w-full ${containerStyle || ""}`}>
      <Text className={`mb-3 text-lg font-JakartaSemiBold ${labelStyle || ""}`}>
        {label}
      </Text>
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        className={`relative flex flex-row items-center justify-between rounded-full border bg-neutral-100 p-4 ${
          error ? "border-red-500" : "border-neutral-100"
        }`}
      >
        <View className="flex-1 flex-row items-center">
          {icon ? (
            <Image source={icon} className={`mr-4 h-6 w-6 ${iconStyle || ""}`} />
          ) : null}
          <Text
            className={`flex-1 font-JakartaSemiBold text-[15px] ${
              inputStyle || ""
            } ${displayValue ? "text-black" : "text-gray-400"} ${
              error ? "text-red-600" : ""
            }`}
          >
            {displayValue || placeholder}
          </Text>
        </View>
        <Text className="text-lg text-gray-400">v</Text>
      </TouchableOpacity>

      <Modal
        isVisible={modalVisible}
        onBackdropPress={closeModal}
        onBackButtonPress={closeModal}
        animationIn="fadeIn"
        animationOut="fadeOut"
        backdropOpacity={0.5}
      >
        <View className="max-h-[70%] rounded-2xl bg-white p-5">
          <Text className="mb-4 text-xl font-JakartaBold">{label}</Text>

          {searchable ? (
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={searchPlaceholder}
              placeholderTextColor="#9CA3AF"
              className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-Jakarta text-base text-gray-900"
            />
          ) : null}

          <ScrollView showsVerticalScrollIndicator={false}>
            {filteredOptions.length === 0 ? (
              <View className="py-6">
                <Text className="text-center font-Jakarta text-gray-500">
                  No matching options found
                </Text>
              </View>
            ) : (
              filteredOptions.map((option, index) => (
                <TouchableOpacity
                  key={option.value}
                  className={`border-b border-gray-100 py-4 ${
                    index === filteredOptions.length - 1 ? "border-b-0" : ""
                  }`}
                  onPress={() => {
                    onSelect(option.value);
                    closeModal();
                  }}
                >
                  <Text
                    className={`text-lg ${
                      value === option.value
                        ? "font-JakartaBold text-green-600"
                        : "font-Jakarta text-gray-800"
                    }`}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>

          <TouchableOpacity
            className="mt-4 items-center rounded-xl bg-gray-100 p-4"
            onPress={closeModal}
          >
            <Text className="font-JakartaSemiBold text-gray-800">Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};

export default DropdownField;
