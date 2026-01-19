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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const expo_router_1 = require("expo-router");
const react_1 = require("react");
const react_native_1 = require("react-native");
const ImagePicker = __importStar(require("expo-image-picker"));
const CustomButton_1 = __importDefault(require("@/components/CustomButton"));
const supabase_1 = require("@/lib/supabase");
const AuthContext_1 = require("@/contexts/AuthContext");
const Documents = () => {
    const params = (0, expo_router_1.useLocalSearchParams)();
    const { user, driverProfile } = (0, AuthContext_1.useAuth)();
    // ROUTE GUARD: Approved drivers should NOT see onboarding - redirect to home
    if ((driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.verification_status) === 'approved') {
        console.log('[Documents] Driver is already approved - redirecting to home');
        return <expo_router_1.Redirect href="/(tabs)/home"/>;
    }
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [documents, setDocuments] = (0, react_1.useState)([
        {
            id: "license",
            name: "Driving License",
            description: "Front side of your DL",
            required: true,
            uri: (driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.license_image_url) || null,
            uploading: false,
        },
        {
            id: "rc",
            name: "Vehicle RC",
            description: "Registration Certificate",
            required: true,
            uri: (driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.rc_image_url) || null,
            uploading: false,
        },
        {
            id: "insurance",
            name: "Vehicle Insurance",
            description: "Valid insurance document",
            required: true,
            uri: (driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.insurance_image_url) || null,
            uploading: false,
        },
        {
            id: "vehicle",
            name: "Vehicle Photo",
            description: "Clear photo of your vehicle",
            required: false,
            uri: (driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.vehicle_image_url) || null,
            uploading: false,
        },
    ]);
    const pickImage = async (docId) => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.7,
            });
            if (!result.canceled && result.assets[0]) {
                await uploadDocument(docId, result.assets[0].uri);
            }
        }
        catch (error) {
            console.error("Error picking image:", error);
            react_native_1.Alert.alert("Error", "Failed to pick image");
        }
    };
    const takePhoto = async (docId) => {
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== "granted") {
                react_native_1.Alert.alert("Permission Required", "Camera permission is required");
                return;
            }
            const result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.7,
            });
            if (!result.canceled && result.assets[0]) {
                await uploadDocument(docId, result.assets[0].uri);
            }
        }
        catch (error) {
            console.error("Error taking photo:", error);
            react_native_1.Alert.alert("Error", "Failed to take photo");
        }
    };
    const uploadDocument = async (docId, uri) => {
        // Update uploading state
        setDocuments((prev) => prev.map((d) => (d.id === docId ? { ...d, uploading: true } : d)));
        try {
            // For local testing, just save the local URI without uploading
            // TODO: In production, uncomment the Supabase upload code below
            // Just use local URI for now (works for testing the flow)
            setDocuments((prev) => prev.map((d) => d.id === docId ? { ...d, uri: uri, uploading: false } : d));
            react_native_1.Alert.alert("Success", "Document saved successfully!");
            return;
            /*
            // Production Supabase upload code:
            // Read file as base64
            const response = await fetch(uri);
            const blob = await response.blob();
            
            // Convert blob to ArrayBuffer
            const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as ArrayBuffer);
              reader.onerror = reject;
              reader.readAsArrayBuffer(blob);
            });
            
            // Generate unique filename
            const fileExt = uri.split(".").pop() || "jpg";
            const fileName = `${user?.id}/${docId}_${Date.now()}.${fileExt}`;
      
            // Upload to Supabase Storage
            const { data, error } = await supabase.storage
              .from("driver-documents")
              .upload(fileName, arrayBuffer, {
                contentType: `image/${fileExt}`,
                upsert: true,
              });
      
            if (error) {
              throw error;
            }
      
            // Get public URL
            const { data: urlData } = supabase.storage
              .from("driver-documents")
              .getPublicUrl(fileName);
      
            // Update document state with URL
            setDocuments((prev) =>
              prev.map((d) =>
                d.id === docId ? { ...d, uri: urlData.publicUrl, uploading: false } : d
              )
            );
      
            Alert.alert("Success", "Document uploaded successfully!");
            */
        }
        catch (error) {
            console.error("Upload error:", error);
            react_native_1.Alert.alert("Upload Failed", error.message || "Failed to upload document");
            setDocuments((prev) => prev.map((d) => (d.id === docId ? { ...d, uploading: false } : d)));
        }
    };
    const onSubmit = async () => {
        var _a, _b, _c, _d;
        // Check required documents
        const requiredDocs = documents.filter((d) => d.required);
        const missingDocs = requiredDocs.filter((d) => !d.uri);
        if (missingDocs.length > 0) {
            react_native_1.Alert.alert("Missing Documents", `Please upload: ${missingDocs.map((d) => d.name).join(", ")}`);
            return;
        }
        setLoading(true);
        try {
            // Create driver record
            // Create or update driver record
            const { error } = await supabase_1.supabase.from("drivers").upsert({
                user_id: user === null || user === void 0 ? void 0 : user.id,
                vehicle_type: params.vehicleType,
                vehicle_number: params.vehicleNumber,
                vehicle_model: params.vehicleModel,
                vehicle_color: params.vehicleColor || null,
                license_number: params.licenseNumber,
                license_expiry: parseDateString(params.licenseExpiry),
                license_image_url: (_a = documents.find((d) => d.id === "license")) === null || _a === void 0 ? void 0 : _a.uri,
                rc_image_url: (_b = documents.find((d) => d.id === "rc")) === null || _b === void 0 ? void 0 : _b.uri,
                insurance_image_url: (_c = documents.find((d) => d.id === "insurance")) === null || _c === void 0 ? void 0 : _c.uri,
                vehicle_image_url: (_d = documents.find((d) => d.id === "vehicle")) === null || _d === void 0 ? void 0 : _d.uri,
                verification_status: "pending",
                rejection_reason: null, // Clear rejection reason on resubmission
            }, { onConflict: "user_id" } // Match on user_id for rejected drivers resubmitting
            );
            if (error) {
                throw error;
            }
            expo_router_1.router.replace("/onboarding/verification-pending");
        }
        catch (error) {
            console.error("Submit error:", error);
            react_native_1.Alert.alert("Error", error.message || "Failed to submit application");
        }
        finally {
            setLoading(false);
        }
    };
    // Parse date string DD/MM/YYYY to ISO date
    const parseDateString = (dateStr) => {
        const parts = dateStr.split("/");
        if (parts.length === 3) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return new Date().toISOString().split("T")[0];
    };
    const showDocumentOptions = (docId) => {
        react_native_1.Alert.alert("Upload Document", "Choose an option", [
            { text: "Take Photo", onPress: () => takePhoto(docId) },
            { text: "Choose from Gallery", onPress: () => pickImage(docId) },
            { text: "Cancel", style: "cancel" },
        ]);
    };
    return (<react_native_1.ScrollView className="flex-1 bg-white">
      <react_native_1.View className="flex-1 bg-white">
        {/* Header */}
        <react_native_1.View className="w-full h-[180px] bg-green-500 justify-center px-5">
          <react_native_1.Text className="text-white text-sm font-Jakarta mb-2">
            Step 3 of 3
          </react_native_1.Text>
          <react_native_1.Text className="text-white text-2xl font-JakartaBold">
            Upload Documents
          </react_native_1.Text>
          <react_native_1.Text className="text-green-100 mt-2">
            Upload required documents for verification
          </react_native_1.Text>
        </react_native_1.View>

        {/* Progress Bar */}
        <react_native_1.View className="px-5 mt-4">
          <react_native_1.View className="flex-row h-2 bg-gray-200 rounded-full overflow-hidden">
            <react_native_1.View className="w-full bg-green-500 rounded-full"/>
          </react_native_1.View>
        </react_native_1.View>

        {/* Documents List */}
        <react_native_1.View className="p-5">
          {documents.map((doc) => (<react_native_1.TouchableOpacity key={doc.id} onPress={() => showDocumentOptions(doc.id)} disabled={doc.uploading} className={`flex-row items-center p-4 mb-3 rounded-xl border-2 ${doc.uri
                ? "border-green-500 bg-green-50"
                : "border-gray-200 bg-white"}`}>
              {doc.uploading ? (<react_native_1.View className="w-16 h-16 rounded-lg bg-gray-100 items-center justify-center">
                  <react_native_1.ActivityIndicator color="#22c55e"/>
                </react_native_1.View>) : doc.uri ? (<react_native_1.Image source={{ uri: doc.uri }} className="w-16 h-16 rounded-lg"/>) : (<react_native_1.View className="w-16 h-16 rounded-lg bg-gray-100 items-center justify-center">
                  <react_native_1.Text className="text-3xl">📄</react_native_1.Text>
                </react_native_1.View>)}

              <react_native_1.View className="flex-1 ml-4">
                <react_native_1.View className="flex-row items-center">
                  <react_native_1.Text className="font-JakartaSemiBold text-gray-800">
                    {doc.name}
                  </react_native_1.Text>
                  {doc.required && (<react_native_1.Text className="text-red-500 ml-1">*</react_native_1.Text>)}
                </react_native_1.View>
                <react_native_1.Text className="text-gray-500 text-sm">{doc.description}</react_native_1.Text>
                {doc.uri && (<react_native_1.Text className="text-green-600 text-xs mt-1">
                    ✓ Uploaded
                  </react_native_1.Text>)}
              </react_native_1.View>

              <react_native_1.Text className="text-gray-400 text-xl">
                {doc.uri ? "✓" : "+"}
              </react_native_1.Text>
            </react_native_1.TouchableOpacity>))}

          <react_native_1.View className="mt-4 p-4 bg-yellow-50 rounded-xl">
            <react_native_1.Text className="text-yellow-800 text-center text-sm">
              ⚠️ Make sure documents are clear and readable. Blurry images may
              delay verification.
            </react_native_1.Text>
          </react_native_1.View>

          <CustomButton_1.default title={loading ? "Submitting Application..." : "Submit for Verification"} onPress={onSubmit} className="mt-6 bg-green-500" disabled={loading}/>

          <react_native_1.TouchableOpacity onPress={() => expo_router_1.router.back()} className="mt-4 items-center">
            <react_native_1.Text className="text-gray-500">← Back to Vehicle Info</react_native_1.Text>
          </react_native_1.TouchableOpacity>
        </react_native_1.View>
      </react_native_1.View>
    </react_native_1.ScrollView>);
};
exports.default = Documents;
