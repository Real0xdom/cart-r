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
import { GoogleInputProps } from "@/types/type";

const olaMapsApiKey = process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY;

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
  listPosition = "bottom",
  handlePress,
}: GoogleInputProps) => {
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [showList, setShowList] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (initialLocation) {
      setQuery(initialLocation);
    }
  }, [initialLocation]);

  const searchPlaces = async (text: string) => {
    if (!text || text.trim().length < 3) {
      setPredictions([]);
      setLoading(false);
      return;
    }

    try {
      const url = `https://api.olamaps.io/places/v1/autocomplete?input=${encodeURIComponent(text)}&api_key=${olaMapsApiKey}`;
      
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
    setQuery(item.description);
    setShowList(false);
    Keyboard.dismiss();

    if (item.geometry?.location) {
      handlePress({
        latitude: item.geometry.location.lat,
        longitude: item.geometry.location.lng,
        address: item.description,
      });
    }
  };

  const renderAutocompleteList = () => (
    <View
      className={`mx-5 rounded-xl shadow-md overflow-hidden ${
        listPosition === "top" ? "mb-3" : "absolute top-14 z-[999]"
      }`}
      style={{ backgroundColor: textInputBackgroundColor || "white", maxHeight: 250 }}
    >
      {loading && predictions.length === 0 ? (
        <View className="p-4 items-center justify-center">
          <ActivityIndicator size="small" color="#FF9800" />
        </View>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
          {predictions.map((item) => (
            <TouchableOpacity
              key={item.place_id}
              onPress={() => handleSelect(item)}
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
  );

  return (
    <View className={`relative z-50 ${containerStyle}`}>
      {showList && query.length > 0 && listPosition === "top" && renderAutocompleteList()}

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
          onFocus={() => setShowList(true)}
          className="flex-1 text-base font-JakartaSemiBold text-black h-12"
        />
      </View>

      {/* Autocomplete List */}
      {showList && query.length > 0 && listPosition === "bottom" && renderAutocompleteList()}
    </View>
  );
};

export default GoogleTextInput;
