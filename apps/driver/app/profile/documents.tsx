import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as WebBrowser from "expo-web-browser";
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

import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  isPdfDocument,
  isSupportedDocumentReference,
  normalizeImageAsset,
  pickDriverDocumentFromDevice,
  uploadDriverDocument,
} from "@/lib/driverDocuments";
import { supabase } from "@/lib/supabase";

type DriverDocumentField =
  | "insurance_image_url"
  | "license_image_url"
  | "rc_image_url"
  | "vehicle_image_url";

export default function Documents() {
  const { driverProfile, refreshProfile, user } = useAuth();
  const { t } = useLanguage();
  const [uploading, setUploading] = useState<string | null>(null);

  const openDocument = async (reference?: string | null) => {
    if (!reference) {
      Alert.alert(t("noDocument"), t("noDocumentUploaded"));
      return;
    }

    if (!isSupportedDocumentReference(reference)) {
      Alert.alert(t("error"), t("unsafeDocumentBlocked"));
      return;
    }

    try {
      await WebBrowser.openBrowserAsync(reference);
    } catch {
      Alert.alert(t("error"), t("couldNotOpenDocument"));
    }
  };

  const chooseDocument = async (field: DriverDocumentField) => {
    if (driverProfile?.verification_status === "approved") {
      Alert.alert(t("verified"), t("verifiedCannotChange"));
      return;
    }

    Alert.alert(t("uploadDocumentTitle"), t("uploadDocumentMessage"), [
      {
        text: t("takePhoto"),
        onPress: () => takePhoto(field),
      },
      {
        text: t("chooseImageOrPdf"),
        onPress: () => pickFile(field),
      },
      {
        text: t("cancel"),
        style: "cancel",
      },
    ]);
  };

  const takePhoto = async (field: DriverDocumentField) => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(t("error"), t("cameraPermissionRequired"));
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        await saveDocument(field, normalizeImageAsset(result.assets[0]));
      }
    } catch (error: any) {
      console.error("Camera upload error:", error);
      Alert.alert(t("error"), error.message || t("failedToUploadDocument"));
    }
  };

  const pickFile = async (field: DriverDocumentField) => {
    try {
      const file = await pickDriverDocumentFromDevice();
      if (file) {
        await saveDocument(field, file);
      }
    } catch (error: any) {
      console.error("Document picker error:", error);
      Alert.alert(t("error"), error.message || t("failedToUploadDocument"));
    }
  };

  const saveDocument = async (
    field: DriverDocumentField,
    file: NonNullable<Awaited<ReturnType<typeof pickDriverDocumentFromDevice>>> | ReturnType<typeof normalizeImageAsset>
  ) => {
    if (!user?.id || !driverProfile?.id) {
      Alert.alert(t("error"), t("driverProfileNotFound"));
      return;
    }

    try {
      setUploading(field);

      const uploaded = await uploadDriverDocument({
        documentId: mapFieldToDocumentId(field),
        file,
        userId: user.id,
      });

      const { error: updateError } = await supabase
        .from("drivers")
        .update({ [field]: uploaded.publicUrl })
        .eq("id", driverProfile.id);

      if (updateError) {
        throw updateError;
      }

      await refreshProfile();
      Alert.alert(t("success"), t("documentUploadedSuccess"));
    } catch (error: any) {
      console.error("Upload error:", error);
      Alert.alert(t("error"), error.message || t("failedToUploadDocument"));
    } finally {
      setUploading(null);
    }
  };

  const getDocumentId = (url: string | null | undefined, type: string) => {
    if (!url) return "---";
    const shortHash = url.split("/").pop()?.split("?")[0]?.substring(0, 8) || "DOC";
    return `${type.toUpperCase()}-${shortHash.toUpperCase()}`;
  };

  const DocumentCard = ({
    field,
    imageUrl,
    subValue,
    title,
  }: {
    field: DriverDocumentField;
    imageUrl?: string | null;
    subValue?: string;
    title: string;
  }) => {
    const isSafeReference = !imageUrl || isSupportedDocumentReference(imageUrl);
    const isPdf = Boolean(imageUrl) && isPdfDocument(imageUrl);

    return (
      <View className="mb-4 rounded-2xl bg-white p-4">
        <View className="mb-3 flex-row flex-wrap items-start justify-between">
          <View className="mr-2 flex-1">
            <Text className="text-lg font-JakartaSemiBold text-gray-900">{title}</Text>
            {subValue && <Text className="text-sm text-gray-600">{subValue}</Text>}
            <Text className="mt-1 text-xs text-gray-400">
              ID: {getDocumentId(imageUrl, field.split("_")[0])}
            </Text>
          </View>

          {imageUrl ? (
            <View className="self-start rounded bg-green-500/20 px-2 py-1">
              <Text className={`text-xs font-JakartaBold ${isSafeReference ? "text-green-400" : "text-red-400"}`}>
                {isSafeReference ? (isPdf ? t("pdfUploaded") : t("verified")) : t("unsafeDocumentBlocked")}
              </Text>
            </View>
          ) : (
            <View className="self-start rounded bg-red-500/20 px-2 py-1">
              <Text className="text-xs font-JakartaBold text-red-400">{t("missing")}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          className="relative h-40 items-center justify-center overflow-hidden rounded-xl border border-dashed border-gray-200 bg-white"
          disabled={uploading === field}
          onLongPress={() =>
            !imageUrl || driverProfile?.verification_status !== "approved"
              ? chooseDocument(field)
              : null
          }
          onPress={() => (imageUrl ? openDocument(imageUrl) : chooseDocument(field))}
        >
          {uploading === field ? (
            <ActivityIndicator color="#22c55e" size="large" />
          ) : imageUrl && !isSafeReference ? (
            <View className="items-center px-4">
              <Feather name="alert-triangle" size={28} color="#dc2626" />
              <Text className="mt-2 text-center text-gray-600">{t("unsafeDocumentBlocked")}</Text>
            </View>
          ) : imageUrl && !isPdf ? (
            <>
              <Image
                source={{ uri: imageUrl }}
                className="h-full w-full rounded-xl"
                resizeMode="cover"
              />
              {driverProfile?.verification_status !== "approved" && (
                <View className="absolute bottom-2 right-2 rounded-full bg-black/50 p-2">
                  <Feather name="edit-2" size={16} color="white" />
                </View>
              )}
            </>
          ) : imageUrl ? (
            <View className="items-center">
              <Feather name="file-text" size={28} color="#dc2626" />
              <Text className="mt-2 text-gray-600">{t("pdfReadyToView")}</Text>
            </View>
          ) : (
            <View className="items-center">
              <Feather name="upload-cloud" size={24} color="#6b7280" />
              <Text className="mt-2 text-gray-500">{t("tapToUpload")}</Text>
              <Text className="mt-1 text-xs text-gray-400">{t("supportedFileHint")}</Text>
            </View>
          )}
        </TouchableOpacity>

        {imageUrl && driverProfile?.verification_status !== "approved" && (
          <Text className="mt-2 text-center text-xs text-gray-500">
            {t("longPressToChangeDocument")}
          </Text>
        )}
      </View>
    );
  };

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="p-5">
        <DocumentCard
          field="license_image_url"
          imageUrl={driverProfile?.license_image_url}
          subValue={`${t("expires")}: ${driverProfile?.license_expiry || "N/A"}`}
          title={t("drivingLicense")}
        />
        <DocumentCard
          field="rc_image_url"
          imageUrl={driverProfile?.rc_image_url}
          subValue={t("registrationCertificate")}
          title={t("rcBook")}
        />
        <DocumentCard
          field="insurance_image_url"
          imageUrl={driverProfile?.insurance_image_url}
          subValue={t("policyDocument")}
          title={t("vehicleInsurance")}
        />
        <DocumentCard
          field="vehicle_image_url"
          imageUrl={driverProfile?.vehicle_image_url}
          subValue={t("vehiclePhoto")}
          title={t("vehiclePhoto")}
        />
      </View>
    </ScrollView>
  );
}

function mapFieldToDocumentId(field: DriverDocumentField) {
  switch (field) {
    case "license_image_url":
      return "license";
    case "insurance_image_url":
      return "insurance";
    case "rc_image_url":
      return "rc";
    case "vehicle_image_url":
      return "vehicle";
  }
}
