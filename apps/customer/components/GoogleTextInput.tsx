import React, { useState, useRef, useEffect } from "react";
import { 
  View, 
  TouchableOpacity, 
  TextInput, 
  Text,
  ActivityIndicator,
  Keyboard,
  ScrollView
} from "react-native";
import { ScrollView as GestureScrollView } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";

const olaMapsApiKey = process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY;

declare interface GoogleInputProps {
  initialLocation?: string;
  containerStyle?: string;
  textInputBackgroundColor?: string;
  listPosition?: "top" | "bottom";
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
  showMapAction?: boolean;
  onMapActionPress?: () => void;
  onClear?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onListVisibilityChange?: (visible: boolean) => void;
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
  initialLocation,
  containerStyle,
  textInputBackgroundColor,
  listPosition = "bottom",
  handlePress,
  locationBias,
  showMapAction = false,
  onMapActionPress,
  onClear,
  onFocus,
  onBlur,
  onListVisibilityChange,
  testID,
}: GoogleInputProps) => {
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showList, setShowList] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInteractingWithListRef = useRef(false);

  useEffect(() => {
    setQuery(initialLocation ?? "");
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

  const isListVisible = showList && query.trim().length > 0;

  useEffect(() => {
    onListVisibilityChange?.(isListVisible);

    return () => {
      onListVisibilityChange?.(false);
    };
  }, [isListVisible, onListVisibilityChange]);

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
    setShowList(text.trim().length > 0);
    setLoading(text.trim().length >= 3);

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
    isInteractingWithListRef.current = false;
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

  const handleClear = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }

    isInteractingWithListRef.current = false;
    setQuery("");
    setPredictions([]);
    setShowList(false);
    setLoading(false);
    onClear?.();
  };

  const handleMapAction = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }

    isInteractingWithListRef.current = false;
    setIsFocused(false);
    setShowList(false);
    Keyboard.dismiss();
    onBlur?.();
    onMapActionPress?.();
  };

  const renderAutocompleteList = () => (
    <View
      className={`absolute left-0 right-0 rounded-xl border border-gray-200 bg-white overflow-hidden z-[9999] ${
        listPosition === "top" ? "bottom-14" : "top-14"
      }`}
      style={{
        maxHeight: 260,
        elevation: 30,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
      }}
      pointerEvents="auto"
    >
      {loading && predictions.length === 0 ? (
        <View className="p-4 items-center justify-center">
          <ActivityIndicator size="small" color="#FF9800" />
        </View>
      ) : predictions.length === 0 ? (
        <View className="px-4 py-3">
          <Text className="text-sm font-JakartaMedium text-gray-500">
            No locations found
          </Text>
        </View>
      ) : (
        <GestureScrollView
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          nestedScrollEnabled
          showsVerticalScrollIndicator
          onTouchStart={() => {
            isInteractingWithListRef.current = true;
            if (blurTimeoutRef.current) {
              clearTimeout(blurTimeoutRef.current);
              blurTimeoutRef.current = null;
            }
          }}
          onScrollBeginDrag={() => {
            isInteractingWithListRef.current = true;
          }}
          onTouchEnd={() => {
            setTimeout(() => {
              isInteractingWithListRef.current = false;
            }, 150);
          }}
        >
          {predictions.map((item) => (
            <TouchableOpacity
              key={item.place_id}
              onPress={() => handleSelect(item)}
              activeOpacity={0.7}
              className="px-4 py-3 border-b border-gray-100 flex-row items-center"
            >
              <Ionicons name="location-outline" size={20} color="gray" style={{ marginRight: 10 }} />
              <Text className="text-sm font-JakartaMedium text-gray-800 flex-1" numberOfLines={2}>
                {item.description}
              </Text>
            </TouchableOpacity>
          ))}
        </GestureScrollView>
      )}
    </View>
  );

  return (
    <View 
      className={`relative ${containerStyle}`}
      style={{ 
        zIndex: (isFocused || showList) ? 1000 : 1,
        elevation: (isFocused || showList) ? 20 : 0,
        overflow: "visible",
      }}
    >
      <View
        className="flex flex-row items-center justify-center rounded-2xl w-full shadow-sm"
        style={{ backgroundColor: textInputBackgroundColor || "white" }}
      >
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
            setIsFocused(true);
            if (query.trim().length > 0 && predictions.length > 0) {
              setShowList(true);
            }
            if (onFocus) onFocus();
          }}
          onBlur={() => {
            setIsFocused(false);
            blurTimeoutRef.current = setTimeout(() => {
              if (!isInteractingWithListRef.current) {
                setShowList(false);
              }
            }, 250);
            if (onBlur) onBlur();
          }}
          className="flex-1 text-base font-JakartaSemiBold text-black h-12 px-4"
        />

        {query.trim().length > 0 && (
          <TouchableOpacity
            onPress={handleClear}
            className="justify-center items-center w-7 h-7 mr-1 bg-gray-100 rounded-full"
          >
            <Ionicons
              name="close"
              size={13}
              color="#6b7280"
            />
          </TouchableOpacity>
        )}

        {showMapAction && (
          <TouchableOpacity
            onPress={handleMapAction}
            className="justify-center items-center w-7 h-7 mr-2 bg-gray-100 rounded-full"
          >
            <Ionicons
              name="map-outline"
              size={14}
              color="#3b82f6"
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Autocomplete List */}
      {isListVisible && renderAutocompleteList()}
    </View>
  );
};

export default GoogleTextInput;
