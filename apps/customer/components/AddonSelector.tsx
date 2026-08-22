import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

export interface AddonService {
  id: string;
  code?: string;
  name: string;
  description?: string;
  price: number;
  icon_emoji?: string;
  icon?: string;
  is_active?: boolean;
  applicable_vehicle_types?: string[];
}

interface AddonSelectorProps {
  addons: AddonService[];
  selectedAddonIds: string[];
  onToggleAddon: (addonId: string) => void;
  vehicleType: string;
}

const getIconComponent = (iconName: string) => {
  const iconMap: Record<string, any> = {
    'account-hard-hat': 'hard-hat',
    'package-variant': 'package-variant',
    'dolly': 'dolly',
    'hand-wave': 'hand-wave',
  };
  return iconMap[iconName] || 'help-circle';
};

/**
 * Reusable Addon Selector Component
 * Displays available addons for a vehicle type with checkboxes (tick marks).
 * Addons are typically pre-filtered by get_applicable_addons(vehicleType).
 */
export const AddonSelector: React.FC<AddonSelectorProps> = ({
  addons,
  selectedAddonIds,
  onToggleAddon,
  vehicleType,
}) => {
  // When addons come from get_applicable_addons(vehicleType), they're already filtered.
  // Otherwise filter by vehicle type if applicable_vehicle_types is present.
  const applicableAddons = addons.filter(
    addon =>
      addon.is_active !== false &&
      (!addon.applicable_vehicle_types?.length ||
        addon.applicable_vehicle_types.includes(vehicleType))
  );

  if (applicableAddons.length === 0) {
    return null;
  }

  return (
    <View className="mb-2">
      <Text className="text-base font-JakartaBold text-gray-900 mb-1">
        Add-on Services
      </Text>
      <Text className="text-xs text-gray-500 font-JakartaMedium mb-2">
        Select additional services for your delivery
      </Text>

      <View className="gap-2">
        {applicableAddons.map((addon) => {
          const isSelected = selectedAddonIds.includes(addon.id);

          return (
            <TouchableOpacity
              key={addon.id}
              onPress={() => onToggleAddon(addon.id)}
              className={`flex-row items-center p-2.5 rounded-xl border-2 ${
                isSelected
                  ? 'bg-green-50 border-green-500'
                  : 'bg-gray-50 border-gray-200'
              }`}
              activeOpacity={0.7}
            >
              {/* Tick / Checkbox */}
              <View
                className={`w-5 h-5 rounded-md border-2 items-center justify-center mr-2 ${
                  isSelected ? 'bg-green-500 border-green-500' : 'border-gray-300'
                }`}
              >
                {isSelected && <Feather name="check" size={12} color="#fff" />}
              </View>

              {/* Icon: emoji from admin or fallback to Material icon */}
              <View className="w-9 h-9 bg-white rounded-full items-center justify-center mr-2">
                {addon.icon_emoji ? (
                  <Text className="text-lg">{addon.icon_emoji}</Text>
                ) : (
                  <MaterialCommunityIcons
                    name={getIconComponent(addon.icon || '') as any}
                    size={18}
                    color={isSelected ? '#16a34a' : '#666'}
                  />
                )}
              </View>

              {/* Details */}
              <View className="flex-1">
                <Text className="text-sm font-JakartaBold text-gray-900">
                  {addon.name}
                </Text>
                {addon.description ? (
                  <Text className="text-xs text-gray-500 font-JakartaMedium mt-0.5" numberOfLines={1}>
                    {addon.description}
                  </Text>
                ) : null}
              </View>

              {/* Price */}
              <View className="ml-2">
                <Text className="text-base font-JakartaBold text-green-600">
                  ₹{addon.price}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

export default AddonSelector;
