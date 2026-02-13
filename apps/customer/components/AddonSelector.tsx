import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

export interface AddonService {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: string;
  is_active: boolean;
  applicable_vehicle_types: string[];
}

interface AddonSelectorProps {
  addons: AddonService[];
  selectedAddonIds: string[];
  onToggleAddon: (addonId: string) => void;
  vehicleType: string;
}

/**
 * Reusable Addon Selector Component
 * Displays available addons for a vehicle type with checkboxes
 */
export const AddonSelector: React.FC<AddonSelectorProps> = ({
  addons,
  selectedAddonIds,
  onToggleAddon,
  vehicleType,
}) => {
  // Filter addons applicable to this vehicle type
  const applicableAddons = addons.filter(
    addon => 
      addon.is_active && 
      addon.applicable_vehicle_types.includes(vehicleType)
  );

  if (applicableAddons.length === 0) {
    return null;
  }

  const getIconComponent = (iconName: string) => {
    // Map icon names to actual icon components
    const iconMap: Record<string, any> = {
      'account-hard-hat': 'hard-hat',
      'package-variant': 'package-variant',
      'dolly': 'dolly',
      'hand-wave': 'hand-wave',
    };

    const mappedIcon = iconMap[iconName] || 'help-circle';
    return mappedIcon;
  };

  return (
    <View className="mb-6">
      <Text className="text-lg font-JakartaBold text-gray-900 mb-3">
        Add-on Services
      </Text>
      <Text className="text-sm text-gray-500 font-JakartaMedium mb-4">
        Select additional services for your delivery
      </Text>

      <View className="space-y-3">
        {applicableAddons.map((addon) => {
          const isSelected = selectedAddonIds.includes(addon.id);

          return (
            <TouchableOpacity
              key={addon.id}
              onPress={() => onToggleAddon(addon.id)}
              className={`flex-row items-center p-4 rounded-2xl border-2 ${
                isSelected
                  ? 'bg-success-50 border-success-500'
                  : 'bg-gray-50 border-gray-200'
              }`}
              activeOpacity={0.7}
            >
              {/* Checkbox */}
              <View
                className={`w-6 h-6 rounded-md border-2 items-center justify-center mr-3 ${
                  isSelected ? 'bg-success-500 border-success-500' : 'border-gray-300'
                }`}
              >
                {isSelected && <Feather name="check" size={14} color="#fff" />}
              </View>

              {/* Icon */}
              <View className="w-12 h-12 bg-white rounded-full items-center justify-center mr-3">
                <MaterialCommunityIcons
                  name={getIconComponent(addon.icon) as any}
                  size={24}
                  color={isSelected ? '#4CAF50' : '#666'}
                />
              </View>

              {/* Details */}
              <View className="flex-1">
                <Text className="text-base font-JakartaBold text-gray-900">
                  {addon.name}
                </Text>
                <Text className="text-xs text-gray-500 font-JakartaMedium mt-0.5">
                  {addon.description}
                </Text>
              </View>

              {/* Price */}
              <View className="ml-2">
                <Text className="text-lg font-JakartaBold text-success-600">
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
