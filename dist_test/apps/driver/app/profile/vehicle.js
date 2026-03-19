"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = VehicleDetails;
const react_native_1 = require("react-native");
const AuthContext_1 = require("@/contexts/AuthContext");
function VehicleDetails() {
    const { driverProfile } = (0, AuthContext_1.useAuth)();
    if (!driverProfile)
        return null;
    return (<react_native_1.ScrollView className="flex-1 bg-gray-900">
      <react_native_1.View className="p-5">
        
        {/* Vehicle Image */}
        <react_native_1.View className="w-full h-48 bg-gray-800 rounded-xl mb-6 overflow-hidden items-center justify-center">
          {driverProfile.vehicle_image_url ? (<react_native_1.Image source={{ uri: driverProfile.vehicle_image_url }} className="w-full h-full" resizeMode="cover"/>) : (<react_native_1.Text className="text-4xl">🚗</react_native_1.Text>)}
        </react_native_1.View>

        {/* Details Grid */}
        <react_native_1.View className="bg-gray-800 rounded-2xl p-5 gap-4">
          <react_native_1.View>
            <react_native_1.Text className="text-gray-400 text-sm mb-1">Vehicle Type</react_native_1.Text>
            <react_native_1.Text className="text-white text-lg font-JakartaBold capitalize">{driverProfile.vehicle_type}</react_native_1.Text>
          </react_native_1.View>
          
          <react_native_1.View className="h-px bg-gray-700"/>
          
          <react_native_1.View>
            <react_native_1.Text className="text-gray-400 text-sm mb-1">Vehicle Number</react_native_1.Text>
            <react_native_1.Text className="text-white text-lg font-JakartaBold uppercase">{driverProfile.vehicle_number}</react_native_1.Text>
          </react_native_1.View>
          
          <react_native_1.View className="h-px bg-gray-700"/>
          
          <react_native_1.View>
            <react_native_1.Text className="text-gray-400 text-sm mb-1">Make & Model</react_native_1.Text>
            <react_native_1.Text className="text-white text-lg font-JakartaBold">{driverProfile.vehicle_model}</react_native_1.Text>
          </react_native_1.View>
          
          <react_native_1.View className="h-px bg-gray-700"/>
          
          <react_native_1.View>
            <react_native_1.Text className="text-gray-400 text-sm mb-1">Color</react_native_1.Text>
            <react_native_1.Text className="text-white text-lg font-JakartaBold capitalize">{driverProfile.vehicle_color || 'Not Specified'}</react_native_1.Text>
          </react_native_1.View>
        </react_native_1.View>
        
        <react_native_1.View className="mt-4 bg-blue-500/10 p-4 rounded-xl">
          <react_native_1.Text className="text-blue-400 text-xs text-center">
            To update vehicle details, please contact support. Changes require re-verification.
          </react_native_1.Text>
        </react_native_1.View>

      </react_native_1.View>
    </react_native_1.ScrollView>);
}
