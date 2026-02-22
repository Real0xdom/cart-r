import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';

// Using any type since legal_documents may not be in the generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LegalDocument = any;

export default function Terms() {
  const { t } = useLanguage();
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTerms();
  }, []);

  async function fetchTerms() {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await (supabase as any)
        .from('legal_documents')
        .select('id, type, title, content, version, is_published, published_at, target_audience, updated_at')
        .eq('is_published', true)
        .in('target_audience', ['customer', 'both'])
        .order('type')
        .order('updated_at', { ascending: false });

      if (fetchError) throw fetchError;
      setDocuments(data || []);
    } catch (err: any) {
      console.error('Failed to fetch legal documents:', err);
      setError(t('failedToLoad'));
    } finally {
      setLoading(false);
    }
  }

  const renderContent = (content: string) => {
    // Split content by lines and render, stripping markdown heading markers for readability
    return content
      .split('\n')
      .map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return null;

        // Heading level 1: # Title
        if (trimmed.startsWith('# ')) {
          return (
            <Text key={index} className="text-xl font-JakartaBold text-gray-900 mt-5 mb-2">
              {trimmed.replace(/^#+\s*/, '')}
            </Text>
          );
        }
        // Heading level 2: ## Title
        if (trimmed.startsWith('## ')) {
          return (
            <Text key={index} className="text-base font-JakartaBold text-gray-800 mt-4 mb-1">
              {trimmed.replace(/^#+\s*/, '')}
            </Text>
          );
        }
        // Heading level 3: ### Title
        if (trimmed.startsWith('### ')) {
          return (
            <Text key={index} className="text-sm font-JakartaSemiBold text-gray-700 mt-3 mb-1">
              {trimmed.replace(/^#+\s*/, '')}
            </Text>
          );
        }
        // Bullet points
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
          return (
            <Text key={index} className="text-sm text-gray-600 leading-6 ml-3">
              {'• '}{trimmed.replace(/^[-•]\s*/, '')}
            </Text>
          );
        }
        // Regular paragraph
        return (
          <Text key={index} className="text-sm text-gray-600 leading-6 mb-1">
            {trimmed}
          </Text>
        );
      })
      .filter(Boolean);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex flex-row items-center px-5 py-4 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text className="text-xl font-JakartaBold">{t('termsAndPolicies')}</Text>
      </View>

      {/* Content */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#22c55e" />
          <Text className="text-gray-400 mt-3 font-JakartaMedium text-sm">{t('loadingDocuments')}</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text className="text-gray-700 font-JakartaBold text-base mt-3 text-center">{t('failedToLoad')}</Text>
          <Text className="text-gray-500 font-JakartaMedium text-sm mt-1 text-center">{error}</Text>
          <TouchableOpacity
            onPress={fetchTerms}
            className="mt-5 px-6 py-3 bg-success-500 rounded-xl"
          >
            <Text className="text-white font-JakartaBold text-sm">{t('tryAgain')}</Text>
          </TouchableOpacity>
        </View>
      ) : documents.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="document-text-outline" size={48} color="#9ca3af" />
          <Text className="text-gray-700 font-JakartaBold text-base mt-3 text-center">{t('noDocumentsFound')}</Text>
          <Text className="text-gray-500 font-JakartaMedium text-sm mt-1 text-center">
            {t('noDocumentsPublished')}
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        >
          {documents.map((doc, docIndex) => (
            <View
              key={doc.id}
              className={`${docIndex < documents.length - 1 ? 'mb-8 pb-8 border-b border-gray-100' : 'mb-4'}`}
            >
              {/* Document title */}
              <Text className="text-2xl font-JakartaBold text-gray-900 mb-1">{doc.title}</Text>
              <Text className="text-xs text-gray-400 font-JakartaMedium mb-4">
                {t('version')} {doc.version}
                {doc.published_at ? ` · ${t('updated')} ${new Date(doc.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}
              </Text>

              {/* Document content */}
              <View>{renderContent(doc.content)}</View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
