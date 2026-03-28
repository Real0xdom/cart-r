import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import CustomButton from "@/components/CustomButton";
import { useAuth } from "@/contexts/AuthContext";
import {
  isPdfDocument,
  isSupportedDocumentReference,
  normalizeImageAsset,
  pickDriverDocumentFromDevice,
  uploadDriverDocument,
} from "@/lib/driverDocuments";
import { supabase } from "@/lib/supabase";
import { useOnboardingStore } from "@/store";

interface DocumentItem {
  id: string;
  name: string;
  description: string;
  uri: string | null;
  uploading: boolean;
  required: boolean;
}

const Documents = () => {
  const params = useLocalSearchParams();
  const { user, driverProfile } = useAuth();

  if (driverProfile?.verification_status === "approved") {
    console.log("[Documents] Driver is already approved - redirecting to home");
    return <Redirect href="/(tabs)/home" />;
  }

  const [loading, setLoading] = useState(false);

  const {
    license_image_url,
    rc_image_url,
    insurance_image_url,
    vehicle_image_url,
    setDocumentUrl,
    clearDocuments,
  } = useOnboardingStore();

  const [documents, setDocuments] = useState<DocumentItem[]>([
    {
      id: "license",
      name: "Driving License",
      description: "Front side of your DL",
      required: true,
      uri: license_image_url || driverProfile?.license_image_url || null,
      uploading: false,
    },
    {
      id: "rc",
      name: "Vehicle RC",
      description: "Registration Certificate",
      required: true,
      uri: rc_image_url || driverProfile?.rc_image_url || null,
      uploading: false,
    },
    {
      id: "insurance",
      name: "Vehicle Insurance",
      description: "Valid insurance document",
      required: true,
      uri: insurance_image_url || driverProfile?.insurance_image_url || null,
      uploading: false,
    },
    {
      id: "vehicle",
      name: "Vehicle Photo",
      description: "Clear photo of your vehicle",
      required: false,
      uri: vehicle_image_url || driverProfile?.vehicle_image_url || null,
      uploading: false,
    },
  ]);

  const pickFile = async (docId: DocumentItem["id"]) => {
    try {
      const file = await pickDriverDocumentFromDevice();
      if (file) {
        await uploadDocument(docId, file);
      }
    } catch (error) {
      console.error("Error picking file:", error);
      Alert.alert("Error", "Failed to pick file");
    }
  };

  const takePhoto = async (docId: DocumentItem["id"]) => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Camera permission is required");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadDocument(docId, normalizeImageAsset(result.assets[0]));
      }
    } catch (error) {
      console.error("Error taking photo:", error);
      Alert.alert("Error", "Failed to take photo");
    }
  };

  const uploadDocument = async (
    docId: DocumentItem["id"],
    file: Awaited<ReturnType<typeof pickDriverDocumentFromDevice>> | ReturnType<typeof normalizeImageAsset>
  ) => {
    if (!user?.id || !file) {
      Alert.alert("Error", "Please sign in again before uploading documents.");
      return;
    }

    setDocuments((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, uploading: true } : d))
    );

    try {
      const uploaded = await uploadDriverDocument({
        documentId: docId,
        file,
        userId: user.id,
      });

      setDocuments((prev) =>
        prev.map((d) =>
          d.id === docId
            ? { ...d, uri: uploaded.publicUrl, uploading: false }
            : d
        )
      );

      setDocumentUrl(docId, uploaded.publicUrl);
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
    const requiredDocs = documents.filter((d) => d.required);
    const missingDocs = requiredDocs.filter(
      (d) => !d.uri || !isSupportedDocumentReference(d.uri)
    );

    if (missingDocs.length > 0) {
      Alert.alert(
        "Missing Documents",
        `Please upload: ${missingDocs.map((d) => d.name).join(", ")}`
      );
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("drivers").upsert(
        {
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
          verification_status: "pending",
          rejection_reason: null,
        } as any,
        { onConflict: "user_id" }
      );

      if (error) {
        throw error;
      }

      clearDocuments();
      router.replace("/onboarding/verification-pending");
    } catch (error: any) {
      console.error("Submit error:", error);
      Alert.alert("Error", error.message || "Failed to submit application");
    } finally {
      setLoading(false);
    }
  };

  const parseDateString = (dateStr: string): string => {
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return new Date().toISOString().split("T")[0];
  };

  const showDocumentOptions = (docId: DocumentItem["id"]) => {
    Alert.alert("Upload Document", "Choose an option", [
      { text: "Take Photo", onPress: () => takePhoto(docId) },
      { text: "Choose Image or PDF", onPress: () => pickFile(docId) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="flex-1 bg-white">
        <View className="h-[180px] w-full justify-center bg-green-500 px-5">
          <Text className="mb-2 text-sm font-Jakarta text-white">
            Step 3 of 3
          </Text>
          <Text className="text-2xl font-JakartaBold text-white">
            Upload Documents
          </Text>
          <Text className="mt-2 text-green-100">
            Upload required documents for verification
          </Text>
        </View>

        <View className="mt-4 px-5">
          <View className="h-2 flex-row overflow-hidden rounded-full bg-gray-200">
            <View className="w-full rounded-full bg-green-500" />
          </View>
        </View>

        <View className="p-5">
          {documents.map((doc) => (
            (() => {
              const isSafeReference = !doc.uri || isSupportedDocumentReference(doc.uri);
              const isPdf = Boolean(doc.uri) && isPdfDocument(doc.uri);
              return (
            <TouchableOpacity
              key={doc.id}
              onPress={() => showDocumentOptions(doc.id)}
              disabled={doc.uploading}
              className={`mb-3 flex-row items-center rounded-xl border-2 p-4 ${
                doc.uri
                  ? "border-green-500 bg-green-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              {doc.uploading ? (
                <View className="h-16 w-16 items-center justify-center rounded-lg bg-gray-100">
                  <ActivityIndicator color="#22c55e" />
                </View>
              ) : doc.uri && !isSafeReference ? (
                <View className="h-16 w-16 items-center justify-center rounded-lg bg-red-50">
                  <Ionicons name="warning-outline" size={28} color="#dc2626" />
                </View>
              ) : doc.uri && !isPdf ? (
                <Image
                  source={{ uri: doc.uri }}
                  className="h-16 w-16 rounded-lg"
                />
              ) : doc.uri ? (
                <View className="h-16 w-16 items-center justify-center rounded-lg bg-red-50">
                  <Ionicons name="document-attach" size={28} color="#dc2626" />
                </View>
              ) : (
                <View className="h-16 w-16 items-center justify-center rounded-lg bg-gray-100">
                  <Ionicons
                    name="document-text-outline"
                    size={28}
                    color="#6b7280"
                  />
                </View>
              )}

              <View className="ml-4 flex-1">
                <View className="flex-row items-center">
                  <Text className="font-JakartaSemiBold text-gray-800">
                    {doc.name}
                  </Text>
                  {doc.required && (
                    <Text className="ml-1 text-red-500">*</Text>
                  )}
                </View>
                <Text className="text-sm text-gray-500">{doc.description}</Text>
                {doc.uri && (
                  <View className="mt-1 flex-row items-center">
                    <Ionicons
                      name={isSafeReference ? "checkmark-circle" : "warning"}
                      size={14}
                      color={isSafeReference ? "#16a34a" : "#dc2626"}
                    />
                    <Text className={`ml-1 text-xs ${isSafeReference ? "text-green-600" : "text-red-600"}`}>
                      {!isSafeReference
                        ? "Re-upload required"
                        : isPdf
                          ? "PDF uploaded"
                          : "Uploaded"}
                    </Text>
                  </View>
                )}
              </View>

              {doc.uri ? (
                <Ionicons
                  name={isSafeReference ? "checkmark-circle" : "warning"}
                  size={22}
                  color={isSafeReference ? "#16a34a" : "#dc2626"}
                />
              ) : (
                <Ionicons
                  name="add-circle-outline"
                  size={22}
                  color="#9ca3af"
                />
              )}
            </TouchableOpacity>
              );
            })()
          ))}

          <View className="mt-4 flex-row items-start rounded-xl bg-yellow-50 p-4">
            <Ionicons name="alert-circle-outline" size={18} color="#a16207" />
            <Text className="ml-2 flex-1 text-center text-sm text-yellow-800">
              Upload a clear image or PDF. Files are checked before upload and
              anything outside the supported document types will be blocked.
            </Text>
          </View>

          <CustomButton
            title={
              loading ? "Submitting Application..." : "Submit for Verification"
            }
            onPress={onSubmit}
            className="mt-6 bg-green-500"
            disabled={loading}
          />

          <TouchableOpacity
            onPress={() => router.back()}
            className="mt-4 items-center"
          >
            <Text className="text-gray-500">Back to Vehicle Info</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

export default Documents;
