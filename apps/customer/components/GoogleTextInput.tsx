import React, { useState, useRef, useEffect } from "react";
import { 
  View, 
  Image, 
  TouchableOpacity, 
  TextInput, 
  Text,
  ActivityIndicator,
  Keyboard,
  ScrollView
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { icons } from "@/constants";

const olaMapsApiKey = process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY;

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
  locationBias?: {
    latitude: number;
    longitude: number;
    radius: number;
  };
  onActionPress?: () => void;
  actionIcon?: any;
  showAction?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  testID?: string;
}

interface Prediction {
  description: string;
  place_id: string;
  geometry?: {
    location: {
      lat: number;
      lng: number;
    }
  };
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
  onFocus,
  onBlur,
  testID,
}: GoogleInputProps) => {
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showList, setShowList] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (initialLocation && initialLocation !== query) {
      setQuery(initialLocation);
    }
  }, [initialLocation]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  const searchPlaces = async (text: string) => {
    if (!text || text.trim().length < 3) {
      setPredictions([]);
      setLoading(false);
      return;
    }

    try {
      let url = `https://api.olamaps.io/places/v1/autocomplete?input=${encodeURIComponent(text)}&api_key=${olaMapsApiKey}`;
      
      if (locationBias) {
        url += `&location=${locationBias.latitude},${locationBias.longitude}&radius=${Math.min(locationBias.radius, 50000)}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'ok' && data.predictions) {
        setPredictions(data.predictions);
      } else {
        setPredictions([]);
      }
    } catch (error) {
      console.error("Ola Maps Autocomplete Error:", error);
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTextChange = (text: string) => {
    setQuery(text);
    setShowList(true);
    setLoading(true);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      searchPlaces(text);
    }, 500);
  };

  const handleSelect = (item: Prediction) => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setQuery(item.description);
    setPredictions([]);
    setShowList(false);
    setIsFocused(false);
    Keyboard.dismiss();
    if (onBlur) onBlur();

    if (item.geometry?.location) {
      handlePress({
        latitude: item.geometry.location.lat,
        longitude: item.geometry.location.lng,
        address: item.description,
      });
    } else {
      // In case geometry is missing, we would call the place details API.
      // But based on Ola API test, geometry is always returned in autocomplete.
      console.warn("No geometry found in selection.");
    }
  };

  return (
    <View 
      className={`relative ${containerStyle}`}
      style={{ 
        zIndex: (isFocused || showList) ? 1000 : 1,
        elevation: (isFocused || showList) ? 20 : 0
      }}
    >
      <View
        className="flex flex-row items-center justify-center rounded-2xl mx-5 shadow-sm"
        style={{ backgroundColor: textInputBackgroundColor || "white" }}
      >
        <View className="justify-center items-center w-10 h-10 ml-2">
          <Image
            source={icon ? icon : icons.search}
            className="w-5 h-5"
            resizeMode="contain"
          />
        </View>

        <TextInput
          value={query}
          onChangeText={handleTextChange}
          placeholder={initialLocation ?? "Where do you want to go?"}
          placeholderTextColor="gray"
          testID={testID}
          accessibilityLabel={testID}
          onFocus={() => {
            if (blurTimeoutRef.current) {
              clearTimeout(blurTimeoutRef.current);
              blurTimeoutRef.current = null;
            }
            setShowList(true);
            setIsFocused(true);
            if (onFocus) onFocus();
          }}
          onBlur={() => {
            setIsFocused(false);
            // Small delay to allow handleSelect to fire before the list disappears
            blurTimeoutRef.current = setTimeout(() => setShowList(false), 250);
            if (onBlur) onBlur();
          }}
          className="flex-1 text-base font-JakartaSemiBold text-black h-12"
        />

        {showAction && (
          <TouchableOpacity 
            onPress={onActionPress}
            className="justify-center items-center w-8 h-8 mr-3 bg-gray-100 rounded-full"
          >
            <Ionicons 
              name={actionIcon || "bookmark-outline"} 
              size={18} 
              color="#FF9800" 
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Autocomplete List */}
      {showList && (query.length > 0) && (
        <View 
          className="absolute top-14 left-5 right-5 rounded-xl shadow-2xl z-[100] overflow-hidden border border-gray-100"
          style={{ backgroundColor: "white", maxHeight: 250 }}
        >
          {loading && predictions.length === 0 ? (
            <View className="p-4 items-center justify-center">
              <ActivityIndicator size="small" color="#FF9800" />
            </View>
          ) : (
            <ScrollView 
              className="w-full"
              keyboardShouldPersistTaps="always"
              nestedScrollEnabled={true}
            >
              {predictions.map((item) => (
                <TouchableOpacity
                  key={item.place_id}
                  onPressIn={() => handleSelect(item)}
                  activeOpacity={0.7}
                  className="px-4 py-3 border-b border-gray-100 flex-row items-center"
                >
                  <Ionicons name="location-outline" size={20} color="gray" style={{ marginRight: 10 }} />
                  <Text className="text-sm font-JakartaMedium text-gray-800 flex-1" numberOfLines={2}>
                    {item.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
};

export default GoogleTextInput;
