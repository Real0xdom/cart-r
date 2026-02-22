import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import * as SecureStore from "expo-secure-store";
import { Locale, translations, LANGUAGE_STORAGE_KEY } from "@/lib/translations";

type LanguageContextType = {
  language: Locale;
  setLanguage: (locale: Locale) => Promise<void>;
  t: (key: string) => string;
  isLoading: boolean;
};

const defaultContext: LanguageContextType = {
  language: "en",
  setLanguage: async () => {},
  t: (key: string) => key,
  isLoading: true,
};

const LanguageContext = createContext<LanguageContextType>(defaultContext);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Locale>("en");
  const [isLoading, setIsLoading] = useState(true);

  const loadStoredLanguage = useCallback(async () => {
    try {
      const stored = await SecureStore.getItemAsync(LANGUAGE_STORAGE_KEY);
      if (stored === "en" || stored === "hi") {
        setLanguageState(stored);
      }
    } catch (e) {
      console.warn("Failed to load language preference", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStoredLanguage();
  }, [loadStoredLanguage]);

  const setLanguage = useCallback(async (locale: Locale) => {
    try {
      await SecureStore.setItemAsync(LANGUAGE_STORAGE_KEY, locale);
      setLanguageState(locale);
    } catch (e) {
      console.warn("Failed to save language preference", e);
    }
  }, []);

  const t = useCallback(
    (key: string) => {
      const dict = translations[language];
      return dict[key] ?? translations.en[key] ?? key;
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isLoading }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
