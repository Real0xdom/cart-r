import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';

// Using any type since legal_documents may not be in the generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LegalDocument = any;

export default function TermsAndPolicies() {
  const router = useRouter();
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
        .in('target_audience', ['driver', 'both'])
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
            <Text key={index} className="text-lg font-JakartaBold text-gray-900 mt-5 mb-2">
              {trimmed.replace(/^#+\s*/, '')}
            </Text>
          );
        }
        // Heading level 2: ## Title
        if (trimmed.startsWith('## ')) {
          return (
            <Text key={index} className="text-base font-JakartaBold text-gray-900 mt-4 mb-1">
              {trimmed.replace(/^#+\s*/, '')}
            </Text>
          );
        }
        // Heading level 3: ### Title
        if (trimmed.startsWith('### ')) {
          return (
            <Text key={index} className="text-sm font-JakartaSemiBold text-gray-300 mt-3 mb-1">
              {trimmed.replace(/^#+\s*/, '')}
            </Text>
          );
        }
        // Bullet points
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
          return (
            <Text key={index} className="text-gray-400 leading-6 ml-3">
              {'• '}{trimmed.replace(/^[-•]\s*/, '')}
            </Text>
          );
        }
        // Regular paragraph
        return (
          <Text key={index} className="text-gray-400 leading-6 mb-1">
            {trimmed}
          </Text>
        );
      })
      .filter(Boolean);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Custom Header - Clean and Simple */}
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-gray-100">
        <Text className="text-lg font-JakartaBold text-gray-900 flex-1">{t('termsAndPolicies')}</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="x" size={24} color="#6b7280" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#f97316" />
          <Text className="text-gray-500 mt-3 font-JakartaMedium text-sm">{t('loadingDocuments')}</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Feather name="alert-circle" size={48} color="#ef4444" />
          <Text className="text-gray-900 font-JakartaBold text-base mt-3 text-center">{t('failedToLoad')}</Text>
          <Text className="text-gray-500 font-JakartaMedium text-sm mt-1 text-center">{error}</Text>
          <TouchableOpacity
            onPress={fetchTerms}
            className="mt-5 px-6 py-3 bg-orange-500 rounded-xl"
          >
            <Text className="text-gray-900 font-JakartaBold text-sm">{t('tryAgain')}</Text>
          </TouchableOpacity>
        </View>
      ) : documents.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Feather name="file-text" size={48} color="#6b7280" />
          <Text className="text-gray-900 font-JakartaBold text-base mt-3 text-center">{t('noDocumentsFound')}</Text>
          <Text className="text-gray-500 font-JakartaMedium text-sm mt-1 text-center">
            {t('legalNotPublished')}
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1 p-5">
          {documents.map((doc, docIndex) => (
            <View
              key={doc.id}
              className={`${docIndex < documents.length - 1 ? 'mb-8 pb-8 border-b border-gray-800' : 'mb-4'}`}
            >
              {/* Document title */}
              <Text className="text-xl font-JakartaBold text-gray-900 mb-1">{doc.title}</Text>
              <Text className="text-xs text-gray-500 font-JakartaMedium mb-4">
                Version {doc.version}
                {doc.published_at ? ` · Updated ${new Date(doc.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}
              </Text>

              {/* Document content */}
              <View>{renderContent(doc.content)}</View>
            </View>
          ))}

          <View className="mb-10 pt-4 border-t border-gray-800">
            <Text className="text-gray-500 text-center text-xs">
              {t('lastUpdated')}: {documents[0]?.published_at ? new Date(documents[0].published_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : 'N/A'}
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
