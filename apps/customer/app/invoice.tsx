import { router, useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { InvoiceTemplate } from "@/components/InvoiceTemplate";
import { generateInvoice, getInvoice, InvoiceData } from "@/lib/invoiceUtils";
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

const InvoiceScreen = () => {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    if (bookingId) {
      fetchInvoice();
    }
  }, [bookingId]);

  const fetchInvoice = async () => {
    setLoading(true);
    
    // Try to get existing invoice first
    let result = await getInvoice(bookingId);
    
    // If not found, generate new invoice
    if (!result.data && !result.error) {
      result = await generateInvoice(bookingId);
    }

    if (result.data) {
      setInvoice(result.data);
    } else {
      Alert.alert("Error", result.error || "Failed to load invoice");
    }
    
    setLoading(false);
  };

  const handleShare = async () => {
    if (!invoice) return;

    setIsSharing(true);

    try {
      // Create shareable text
      const shareText = `
Cart-R Invoice
${invoice.invoice_number}

Customer: ${invoice.customer_name}
Driver: ${invoice.driver_name}
Vehicle: ${invoice.vehicle_type} - ${invoice.vehicle_number}

From: ${invoice.pickup_address}
To: ${invoice.dropoff_address}

Total Amount: ₹${invoice.total_amount}
Payment: ${invoice.payment_method} (${invoice.payment_status})

Thank you for using Cart-R!
      `.trim();

      await Share.share({
        message: shareText,
        title: `Invoice ${invoice.invoice_number}`,
      });
    } catch (error: any) {
      console.error('Error sharing invoice:', error);
      Alert.alert("Error", "Failed to share invoice");
    } finally {
      setIsSharing(false);
    }
  };

  const handleDownload = async () => {
    // Note: Full PDF generation would require additional libraries like react-native-html-to-pdf
    // For now, we'll use the share functionality
    Alert.alert(
      "Download Invoice",
      "Invoice will be shared. You can save it from the share menu.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Share", onPress: handleShare }
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#FF9800" />
        <Text className="mt-4 text-gray-500 font-JakartaMedium">Loading invoice...</Text>
      </SafeAreaView>
    );
  }

  if (!invoice) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-6">
        <Feather name="file-text" size={64} color="#ccc" />
        <Text className="mt-4 text-xl font-JakartaBold text-gray-800">Invoice Not Found</Text>
        <Text className="mt-2 text-sm text-gray-500 text-center">
          Unable to load invoice for this booking
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-6 bg-brand-500 px-6 py-3 rounded-xl"
        >
          <Text className="text-white font-JakartaBold">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-5 py-4 flex-row items-center justify-between border-b border-gray-200">
        <TouchableOpacity onPress={() => router.back()} className="flex-row items-center">
          <Feather name="chevron-left" size={24} color="#000" />
          <Text className="ml-2 text-lg font-JakartaBold">Invoice</Text>
        </TouchableOpacity>
        
        <View className="flex-row">
          <TouchableOpacity
            onPress={handleShare}
            disabled={isSharing}
            className="bg-gray-100 p-3 rounded-full mr-2"
          >
            {isSharing ? (
              <ActivityIndicator size="small" color="#FF9800" />
            ) : (
              <Feather name="share-2" size={20} color="#FF9800" />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={handleDownload}
            className="bg-brand-500 p-3 rounded-full"
          >
            <Feather name="download" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Invoice Template */}
      <InvoiceTemplate invoice={invoice} />
    </SafeAreaView>
  );
};

export default InvoiceScreen;
