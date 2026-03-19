import React from "react";
import { Modal, View, Text, TouchableOpacity, Pressable } from "react-native";
import { useLanguage } from "@/contexts/LanguageContext";
import { Locale } from "@/lib/translations";

const LANGUAGES: { locale: Locale; labelEn: string; labelHi: string }[] = [
  { locale: "en", labelEn: "English", labelHi: "अंग्रेज़ी" },
  { locale: "hi", labelEn: "Hindi", labelHi: "हिंदी" },
];

interface LanguageModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function LanguageModal({ visible, onClose }: LanguageModalProps) {
  const { language, setLanguage, t } = useLanguage();

  const handleSelect = async (locale: Locale) => {
    await setLanguage(locale);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 justify-end bg-black/50" onPress={onClose}>
        <Pressable
          className="bg-white rounded-t-3xl pt-6 pb-10 px-5 border-t border-gray-200"
          onPress={(e) => e.stopPropagation()}
        >
          <Text className="text-lg font-JakartaSemiBold text-gray-900 mb-1">
            {t("selectLanguage")}
          </Text>
          <Text className="text-sm text-gray-500 mb-4">
            {t("currentLanguage")}: {language === "en" ? t("english") : t("hindi")}
          </Text>

          {LANGUAGES.map(({ locale, labelEn, labelHi }) => (
            <TouchableOpacity
              key={locale}
              onPress={() => handleSelect(locale)}
              className={`py-4 px-4 rounded-xl mb-2 ${language === locale ? "bg-green-500/20 border border-green-500/40" : "bg-gray-100"}`}
              activeOpacity={0.7}
            >
              <Text className={`font-JakartaMedium ${language === locale ? "text-green-600" : "text-gray-700"}`}>
                {locale === "en" ? labelEn : labelHi}
              </Text>
              {language === locale && (
                <Text className="text-xs text-green-600 mt-0.5">✓ {t("currentLanguage")}</Text>
              )}
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            onPress={onClose}
            className="mt-4 py-3 rounded-xl bg-gray-100"
            activeOpacity={0.7}
          >
            <Text className="text-center font-JakartaMedium text-gray-700">{t("cancel")}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
