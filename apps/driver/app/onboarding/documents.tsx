import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  Alert,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";

import CustomButton from "@/components/CustomButton";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface DocumentItem {
  id: string;
  name: string;
  description: string;
  required: boolean;
  uri: string | null;
  uploading: boolean;
}

const Documents = () => {
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const [documents, setDocuments] = useState<DocumentItem[]>([
    {
      id: "license",
      name: "Driving License",
      description: "Front side of your DL",
      required: true,
      uri: null,
      uploading: false,
    },
    {
      id: "rc",
      name: "Vehicle RC",
      description: "Registration Certificate",
      required: true,
      uri: null,
      uploading: false,
    },
    {
      id: "insurance",
      name: "Vehicle Insurance",
      description: "Valid insurance document",
      required: true,
      uri: null,
      uploading: false,
    },
    {
      id: "vehicle",
      name: "Vehicle Photo",
      description: "Clear photo of your vehicle",
      required: false,
      uri: null,
      uploading: false,
    },
  ]);

  const pickImage = async (docId: string) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadDocument(docId, result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const takePhoto = async (docId: string) => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Camera permission is required");
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
    } catch (error) {
      console.error("Error taking photo:", error);
      Alert.alert("Error", "Failed to take photo");
    }
  };

  const uploadDocument = async (docId: string, uri: string) => {
    // Update uploading state
    setDocuments((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, uploading: true } : d))
    );

    try {
      // Read the file
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Generate unique filename
      const fileExt = uri.split(".").pop() || "jpg";
      const fileName = `${user?.id}/${docId}_${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from("driver-documents")
        .upload(fileName, blob, {
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
    } catch (error: any) {
      console.error("Upload error:", error);
      Alert.alert("Upload Failed", error.message || "Failed to upload document");
      setDocuments((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, uploading: false } : d))
      );
    }
  };

  const onSubmit = async () => {
    // Check required documents
    const requiredDocs = documents.filter((d) => d.required);
    const missingDocs = requiredDocs.filter((d) => !d.uri);

    if (missingDocs.length > 0) {
      Alert.alert(
        "Missing Documents",
        `Please upload: ${missingDocs.map((d) => d.name).join(", ")}`
      );
      return;
    }

    setLoading(true);
    try {
      // Create driver record
      const { error } = await supabase.from("drivers").insert({
        user_id: user?.id,
        vehicle_type: params.vehicleType,
        vehicle_number: params.vehicleNumber,
        vehicle_model: params.vehicleModel,
        vehicle_color: params.vehicleColor || null,
        license_number: params.licenseNumber,
        license_expiry: parseDateString(params.licenseExpiry as string),
        license_image_url: documents.find((d) => d.id === "license")?.uri,
        rc_image_url: documents.find((d) => d.id === "rc")?.uri,
        insurance_image_url: documents.find((d) => d.id === "insurance")?.uri,
        vehicle_image_url: documents.find((d) => d.id === "vehicle")?.uri,
        verification_status: "pending",
      });

      if (error) {
        throw error;
      }

      router.replace("/onboarding/verification-pending");
    } catch (error: any) {
      console.error("Submit error:", error);
      Alert.alert("Error", error.message || "Failed to submit application");
    } finally {
      setLoading(false);
    }
  };

  // Parse date string DD/MM/YYYY to ISO date
  const parseDateString = (dateStr: string): string => {
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return new Date().toISOString().split("T")[0];
  };

  const showDocumentOptions = (docId: string) => {
    Alert.alert("Upload Document", "Choose an option", [
      { text: "Take Photo", onPress: () => takePhoto(docId) },
      { text: "Choose from Gallery", onPress: () => pickImage(docId) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="flex-1 bg-white">
        {/* Header */}
        <View className="w-full h-[180px] bg-green-500 justify-center px-5">
          <Text className="text-white text-sm font-Jakarta mb-2">
            Step 3 of 3
          </Text>
          <Text className="text-white text-2xl font-JakartaBold">
            Upload Documents
          </Text>
          <Text className="text-green-100 mt-2">
            Upload required documents for verification
          </Text>
        </View>

        {/* Progress Bar */}
        <View className="px-5 mt-4">
          <View className="flex-row h-2 bg-gray-200 rounded-full overflow-hidden">
            <View className="w-full bg-green-500 rounded-full" />
          </View>
        </View>

        {/* Documents List */}
        <View className="p-5">
          {documents.map((doc) => (
            <TouchableOpacity
              key={doc.id}
              onPress={() => showDocumentOptions(doc.id)}
              disabled={doc.uploading}
              className={`flex-row items-center p-4 mb-3 rounded-xl border-2 ${
                doc.uri
                  ? "border-green-500 bg-green-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              {doc.uploading ? (
                <View className="w-16 h-16 rounded-lg bg-gray-100 items-center justify-center">
                  <ActivityIndicator color="#22c55e" />
                </View>
              ) : doc.uri ? (
                <Image
                  source={{ uri: doc.uri }}
                  className="w-16 h-16 rounded-lg"
                />
              ) : (
                <View className="w-16 h-16 rounded-lg bg-gray-100 items-center justify-center">
                  <Text className="text-3xl">📄</Text>
                </View>
              )}

              <View className="flex-1 ml-4">
                <View className="flex-row items-center">
                  <Text className="font-JakartaSemiBold text-gray-800">
                    {doc.name}
                  </Text>
                  {doc.required && (
                    <Text className="text-red-500 ml-1">*</Text>
                  )}
                </View>
                <Text className="text-gray-500 text-sm">{doc.description}</Text>
                {doc.uri && (
                  <Text className="text-green-600 text-xs mt-1">
                    ✓ Uploaded
                  </Text>
                )}
              </View>

              <Text className="text-gray-400 text-xl">
                {doc.uri ? "✓" : "+"}
              </Text>
            </TouchableOpacity>
          ))}

          <View className="mt-4 p-4 bg-yellow-50 rounded-xl">
            <Text className="text-yellow-800 text-center text-sm">
              ⚠️ Make sure documents are clear and readable. Blurry images may
              delay verification.
            </Text>
          </View>

          <CustomButton
            title={loading ? "Submitting Application..." : "Submit for Verification"}
            onPress={onSubmit}
            className="mt-6 bg-green-500"
            disabled={loading}
          />

          <TouchableOpacity
            onPress={() => router.back()}
            className="mt-4 items-center"
          >
            <Text className="text-gray-500">← Back to Vehicle Info</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

export default Documents;
