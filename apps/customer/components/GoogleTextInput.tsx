import { View, Image, TouchableOpacity } from "react-native";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import { useRef } from "react";
import { Ionicons } from "@expo/vector-icons";

import { icons } from "@/constants";

const googlePlacesApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

declare interface GoogleInputProps {
  icon?: any;
  initialLocation?: string;
  containerStyle?: string;
  textInputBackgroundColor?: string;
  handlePress: ({
    latitude,
    longitude,
    address,
  }: {
    latitude: number;
    longitude: number;
    address: string;
  }) => void;
  /** Optional: bias search results toward a specific location (service area center) */
  locationBias?: {
    latitude: number;
    longitude: number;
    radius: number; // meters
  };
  onActionPress?: () => void;
  actionIcon?: any;
  showAction?: boolean;
}

const GoogleTextInput = ({
  icon,
  initialLocation,
  containerStyle,
  textInputBackgroundColor,
  handlePress,
  locationBias,
  onActionPress,
  actionIcon,
  showAction = false,
}: GoogleInputProps) => {
  const ref = useRef<any>(null);

  // Build location bias query params for Google Places API
  // locationbias=circle:radius@lat,lng biases results toward the service area
  const queryParams: Record<string, any> = {
    key: googlePlacesApiKey,
    language: "en",
  };

  if (locationBias) {
    // Use location + radius to bias results toward service areas
    queryParams.location = `${locationBias.latitude},${locationBias.longitude}`;
    queryParams.radius = Math.min(locationBias.radius, 50000); // cap at 50km
  }

  return (
    <View
      className={`flex flex-row items-center justify-center relative z-50 rounded-xl ${containerStyle}`}
    >
      <GooglePlacesAutocomplete
        ref={ref}
        fetchDetails={true}
        placeholder="Search"
        debounce={200}
        enablePoweredByContainer={false}
        styles={{
          textInputContainer: {
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 20,
            marginHorizontal: 20,
            position: "relative",
            shadowColor: "#d4d4d4",
          },
          textInput: {
            backgroundColor: textInputBackgroundColor
              ? textInputBackgroundColor
              : "white",
            fontSize: 16,
            fontWeight: "600",
            marginTop: 5,
            width: "100%",
            borderRadius: 200,
          },
          listView: {
            backgroundColor: textInputBackgroundColor
              ? textInputBackgroundColor
              : "white",
            position: "relative",
            top: 0,
            width: "100%",
            borderRadius: 10,
            shadowColor: "#d4d4d4",
            zIndex: 99,
          },
        }}
        onPress={(data, details = null) => {
          handlePress({
            latitude: details?.geometry.location.lat!,
            longitude: details?.geometry.location.lng!,
            address: data.description,
          });
          // Clear the input to close the list
          ref.current?.setAddressText(data.description);
          ref.current?.blur();
        }}
        renderRightButton={() => 
          showAction ? (
            <TouchableOpacity 
              onPress={onActionPress}
              className="justify-center items-center w-8 h-8 mr-2 bg-gray-100 rounded-full"
            >
              <Ionicons 
                name={actionIcon || "bookmark-outline"} 
                size={18} 
                color="#FF9800" 
              />
            </TouchableOpacity>
          ) : (
            <></>
          )
        }
        query={queryParams}
        renderLeftButton={() => (
          <View className="justify-center items-center w-6 h-6">
            <Image
              source={icon ? icon : icons.search}
              className="w-6 h-6"
              resizeMode="contain"
            />
          </View>
        )}
        textInputProps={{
          placeholderTextColor: "gray",
          placeholder: initialLocation ?? "Where do you want to go?",
        }}
      />
    </View>
  );
};

export default GoogleTextInput;
