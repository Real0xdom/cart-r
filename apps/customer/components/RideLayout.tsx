import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { router } from "expo-router";
import React, { useRef, useEffect, useCallback, useMemo } from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import Map from "@/components/Map";
import { icons } from "@/constants";

interface RideLayoutProps {
  title: string;
  snapPoints?: string[];
  children: React.ReactNode;
  useView?: boolean;
  mapSelectionMode?: 'from' | 'to' | null;
  onMapLocationSelected?: () => void;
  onSelectOnMapPress?: () => void;
}

const RideLayout = ({
  title,
  snapPoints: propSnapPoints,
  children,
  useView = false,
  mapSelectionMode = null,
  onMapLocationSelected,
  onSelectOnMapPress,
}: RideLayoutProps) => {
  const bottomSheetRef = useRef<BottomSheet>(null);

  // Define snap points: collapsed (15%) and expanded (85%)
  const snapPoints = useMemo(() => propSnapPoints || ["15%", "40%", "85%"], [propSnapPoints]);

  // Collapse bottom sheet when entering map selection mode
  useEffect(() => {
    if (mapSelectionMode && bottomSheetRef.current) {
      // Snap to index 0 (15% - collapsed) to show the map
      bottomSheetRef.current.snapToIndex(0);
    }
  }, [mapSelectionMode]);

  // Handle when location is selected on map
  const handleMapLocationSelected = useCallback(() => {
    // Expand the bottom sheet back up to the last snap point
    if (bottomSheetRef.current) {
      bottomSheetRef.current.snapToIndex(snapPoints.length - 1);
    }
    // Call parent callback
    if (onMapLocationSelected) {
      onMapLocationSelected();
    }
  }, [onMapLocationSelected, snapPoints.length]);

  return (
    <GestureHandlerRootView className="flex-1">
      <View className="flex-1 bg-white">
        <View className="flex flex-col h-screen bg-gray-200">
          <View className="flex flex-row absolute z-10 top-16 items-center justify-start px-5 w-full pr-10">
            <TouchableOpacity onPress={() => router.back()}>
              <View className="w-10 h-10 bg-white rounded-full items-center justify-center shadow-md">
                <Image
                  source={icons.backArrow}
                  resizeMode="contain"
                  className="w-6 h-6"
                />
              </View>
            </TouchableOpacity>
            <View className="bg-white/95 px-5 py-2 rounded-full shadow-md ml-4 mr-5 flex-shrink">
              <Text className="text-lg font-JakartaSemiBold text-black" numberOfLines={1}>
                {title || "Go Back"}
              </Text>
            </View>
          </View>

          {/* Map selection mode indicator */}
          {mapSelectionMode && (
            <View className="absolute z-10 top-28 left-5 right-5 bg-blue-600 p-3 rounded-xl shadow-lg">
              <Text className="text-white text-center font-JakartaSemiBold">
                Tap on the map to select your {mapSelectionMode === 'from' ? 'pickup' : 'destination'} location
              </Text>
            </View>
          )}

          <Map 
            selectionMode={mapSelectionMode}
            onLocationSelected={handleMapLocationSelected}
          />
        </View>

        <BottomSheet
          ref={bottomSheetRef}
          snapPoints={snapPoints}
          index={snapPoints.length - 1}
          enablePanDownToClose={false}
          handleIndicatorStyle={{
            backgroundColor: '#ccc',
            width: 40,
          }}
        >
          {useView || title === "Choose a driver" ? (
            <BottomSheetView
              style={{
                flex: 1,
                padding: 20,
              }}
            >
              {children}
            </BottomSheetView>
          ) : (
            <BottomSheetScrollView
              style={{
                flex: 1,
                padding: 20,
              }}
              contentContainerStyle={{
                paddingBottom: 100,
              }}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </BottomSheetScrollView>
          )}
        </BottomSheet>
      </View>
    </GestureHandlerRootView>
  );
};

export default RideLayout;
