import { router, useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Sharing from "expo-sharing";
import { InvoiceTemplate } from "@/components/InvoiceTemplate";
import { generateInvoice, getInvoice, generatePdfUri, InvoiceData } from "@/lib/invoiceUtils";
import { getBookingById } from "@/lib/bookings";

const InvoiceScreen = () => {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    if (bookingId) {
      fetchInvoice();
    }
  }, [bookingId]);
  const fetchInvoice = async () => {
    if (!bookingId) return;
    const id = String(bookingId);

    setLoading(true);

    // Try to get existing invoice first
    let result = await getInvoice(id);

    // If not found, generate new invoice
    if (!result.data && !result.error) {
      result = await generateInvoice(id);
    }

    if (result.data) {
      let invoiceData = result.data;
      // Fallback: some environments don't populate distance_km in invoices
      const currentKm = Number(invoiceData.distance_km);
      if (Number.isFinite(currentKm) && currentKm > 0) {
        invoiceData = { ...invoiceData, distance_km: currentKm };
      } else {
        const bookingResult = await getBookingById(id);
        const estimatedKm = Number(bookingResult.data?.estimated_distance);
        if (Number.isFinite(estimatedKm) && estimatedKm > 0) {
          invoiceData = { ...invoiceData, distance_km: estimatedKm };
        }
      }

      setInvoice(invoiceData);
    } else {
      Alert.alert("Error", result.error || "Failed to load invoice");
    }

    setLoading(false);
  };

  /**
   * Share invoice as PDF file
   */
  const handleShare = async () => {
    if (!invoice) return;

    setIsSharing(true);

    try {
      const pdfUri = await generatePdfUri(invoice);

      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (isSharingAvailable) {
        await Sharing.shareAsync(pdfUri, {
          mimeType: "application/pdf",
          dialogTitle: `Share Invoice ${invoice.invoice_number}`,
          UTI: "com.adobe.pdf",
        });
      } else {
        // Fallback for platforms where expo-sharing isn't available
        await Share.share({
          url: pdfUri,
          title: `Invoice ${invoice.invoice_number}`,
        });
      }
    } catch (error: any) {
      console.error("Error sharing invoice PDF:", error);
      // Fallback to text share if PDF generation fails
      try {
        const shareText = buildShareText(invoice);
        await Share.share({
          message: shareText,
          title: `Invoice ${invoice.invoice_number}`,
        });
      } catch (fallbackError) {
        Alert.alert("Error", "Failed to share invoice");
      }
    } finally {
      setIsSharing(false);
    }
  };

  /**
   * Download / save invoice as PDF
   */
  const handleDownload = async () => {
    if (!invoice) return;

    setIsGeneratingPdf(true);
    try {
      const pdfUri = await generatePdfUri(invoice);

      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (isSharingAvailable) {
        await Sharing.shareAsync(pdfUri, {
          mimeType: "application/pdf",
          UTI: "com.adobe.pdf",
          dialogTitle: `Save Invoice ${invoice.invoice_number}`,
        });
      } else {
        await Share.share({
          url: pdfUri,
          title: `Invoice ${invoice.invoice_number}`,
        });
      }
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      Alert.alert(
        "PDF Error",
        "Could not generate PDF. Would you like to share the invoice as text instead?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Share as Text", onPress: () => handleTextShare() },
        ]
      );
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  /**
   * Fallback: share invoice as plain text
   */
  const handleTextShare = async () => {
    if (!invoice) return;
    try {
      const shareText = buildShareText(invoice);
      await Share.share({
        message: shareText,
        title: `Invoice ${invoice.invoice_number}`,
      });
    } catch (error) {
      Alert.alert("Error", "Failed to share invoice");
    }
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
            disabled={isGeneratingPdf}
            className="bg-brand-500 p-3 rounded-full"
          >
            {isGeneratingPdf ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Feather name="download" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Invoice Template */}
      <InvoiceTemplate invoice={invoice} />
    </SafeAreaView>
  );
};

/**
 * Build a plain-text version of the invoice for fallback sharing
 */
function buildShareText(invoice: InvoiceData): string {
  return `
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
}

export default InvoiceScreen;
