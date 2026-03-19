"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Documents;
const react_native_1 = require("react-native");
const AuthContext_1 = require("@/contexts/AuthContext");
const ImagePicker = __importStar(require("expo-image-picker"));
const react_1 = require("react");
const supabase_1 = require("@/lib/supabase");
const vector_icons_1 = require("@expo/vector-icons");
const FileSystem = __importStar(require("expo-file-system"));
const base64_arraybuffer_1 = require("base64-arraybuffer");
function Documents() {
    const { driverProfile, refreshProfile } = (0, AuthContext_1.useAuth)();
    const [uploading, setUploading] = (0, react_1.useState)(null);
    const openImage = (url) => {
        if (url) {
            react_native_1.Linking.openURL(url).catch(() => react_native_1.Alert.alert('Error', 'Could not open document'));
        }
        else {
            react_native_1.Alert.alert('No Document', 'No document image uploaded.');
        }
    };
    const uploadDocument = async (field) => {
        // Prevent edit if verified
        if ((driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.verification_status) === 'approved') {
            react_native_1.Alert.alert('Verified', 'Your documents are verified and cannot be changed. Contact support for updates.');
            return;
        }
        try {
            // Pick Image
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.5,
            });
            if (!result.canceled) {
                setUploading(field);
                const img = result.assets[0];
                const base64 = await FileSystem.readAsStringAsync(img.uri, { encoding: 'base64' });
                // Generate Unique ID for filename
                const uniqueId = Math.random().toString(36).substring(2, 15);
                const fileName = `${driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.id}/${field}_${uniqueId}.jpg`;
                const contentType = 'image/jpeg';
                // Upload to Supabase
                const { error: uploadError } = await supabase_1.supabase.storage
                    .from('documents') // Ensure this bucket exists
                    .upload(fileName, (0, base64_arraybuffer_1.decode)(base64), { contentType, upsert: true });
                if (uploadError)
                    throw uploadError;
                // Get Public URL
                const { data: { publicUrl } } = supabase_1.supabase.storage
                    .from('documents')
                    .getPublicUrl(fileName);
                // Update Driver Profile
                const { error: updateError } = await supabase_1.supabase
                    .from('drivers')
                    .update({ [field]: publicUrl })
                    .eq('id', driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.id);
                if (updateError)
                    throw updateError;
                await refreshProfile();
                react_native_1.Alert.alert('Success', 'Document uploaded successfully');
            }
        }
        catch (error) {
            console.error('Upload error:', error);
            react_native_1.Alert.alert('Error', error.message || 'Failed to upload document');
        }
        finally {
            setUploading(null);
        }
    };
    // Generate a mock unique document ID for display based on the URL or field
    const getDocumentId = (url, type) => {
        var _a;
        if (!url)
            return '---';
        // Extract a short hash from the URL or fallback to a generated one based on driver ID
        const shortHash = ((_a = url.split('/').pop()) === null || _a === void 0 ? void 0 : _a.substring(0, 8)) || 'DOC';
        return `${type.toUpperCase()}-${shortHash.toUpperCase()}`;
    };
    const DocumentCard = ({ title, subValue, imageUrl, field }) => (<react_native_1.View className="bg-gray-800 rounded-2xl p-4 mb-4">
      {/* Header Row - Wrapped to prevent overflow */}
      <react_native_1.View className="flex-row justify-between items-start mb-3 flex-wrap">
        <react_native_1.View className="flex-1 mr-2">
          <react_native_1.Text className="text-white font-JakartaSemiBold text-lg">{title}</react_native_1.Text>
          {subValue && <react_native_1.Text className="text-gray-400 text-sm">{subValue}</react_native_1.Text>}
          <react_native_1.Text className="text-gray-500 text-xs mt-1">ID: {getDocumentId(imageUrl, field.split('_')[0])}</react_native_1.Text>
        </react_native_1.View>
        
        {imageUrl ? (<react_native_1.View className="bg-green-500/20 px-2 py-1 rounded self-start">
                <react_native_1.Text className="text-green-400 text-xs font-JakartaBold">Verified</react_native_1.Text>
            </react_native_1.View>) : (<react_native_1.View className="bg-red-500/20 px-2 py-1 rounded self-start">
                <react_native_1.Text className="text-red-400 text-xs font-JakartaBold">Missing</react_native_1.Text>
            </react_native_1.View>)}
      </react_native_1.View>
      
      {/* Upload/View Area */}
      <react_native_1.TouchableOpacity onPress={() => imageUrl ? openImage(imageUrl) : uploadDocument(field)} onLongPress={() => !imageUrl || (driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.verification_status) !== 'approved' ? uploadDocument(field) : null} disabled={uploading === field} className="h-40 bg-gray-900 rounded-xl items-center justify-center border border-gray-700 border-dashed overflow-hidden relative">
        {uploading === field ? (<react_native_1.ActivityIndicator color="#22c55e" size="large"/>) : imageUrl ? (<>
             <react_native_1.Image source={{ uri: imageUrl }} className="w-full h-full rounded-xl" resizeMode="cover"/>
             {/* Edit Overlay (if allowed) */}
             {(driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.verification_status) !== 'approved' && (<react_native_1.View className="absolute bottom-2 right-2 bg-black/50 p-2 rounded-full">
                    <vector_icons_1.Feather name="edit-2" size={16} color="white"/>
                </react_native_1.View>)}
           </>) : (<react_native_1.View className="items-center">
             <vector_icons_1.Feather name="upload-cloud" size={24} color="#6b7280"/>
             <react_native_1.Text className="text-gray-500 mt-2">Tap to upload</react_native_1.Text>
           </react_native_1.View>)}
      </react_native_1.TouchableOpacity>
      
      {imageUrl && (driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.verification_status) !== 'approved' && (<react_native_1.Text className="text-gray-500 text-xs text-center mt-2">Long press to change document</react_native_1.Text>)}
    </react_native_1.View>);
    return (<react_native_1.ScrollView className="flex-1 bg-gray-900">
      <react_native_1.View className="p-5">
        <DocumentCard title="Driving License" subValue={`Expires: ${(driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.license_expiry) || 'N/A'}`} imageUrl={driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.license_image_url} field="license_image_url"/>
        <DocumentCard title="RC Book" subValue="Registration Certificate" imageUrl={driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.rc_image_url} field="rc_image_url"/>
        <DocumentCard title="Vehicle Insurance" subValue="Policy Document" imageUrl={driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.insurance_image_url} field="insurance_image_url"/>
      </react_native_1.View>
    </react_native_1.ScrollView>);
}
