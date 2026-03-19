import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { InvoiceData, formatCurrency, formatInvoiceDate, formatInvoiceNumber } from '@/lib/invoiceUtils';

interface InvoiceTemplateProps {
  invoice: InvoiceData;
}

/**
 * Professional Invoice Template Component
 * Designed for viewing and PDF generation
 */
export const InvoiceTemplate: React.FC<InvoiceTemplateProps> = ({ invoice }) => {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.invoice}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>Cart-R</Text>
            <Text style={styles.tagline}>Goods Transportation Services</Text>
          </View>
          <View style={styles.invoiceLabel}>
            <Text style={styles.invoiceLabelText}>INVOICE</Text>
          </View>
        </View>

        {/* Invoice Details */}
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.column}>
              <Text style={styles.label}>Invoice Number</Text>
              <Text style={styles.value}>{formatInvoiceNumber(invoice.invoice_number)}</Text>
            </View>
            <View style={styles.column}>
              <Text style={styles.label}>Invoice Date</Text>
              <Text style={styles.value}>{formatInvoiceDate(invoice.invoice_date)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Customer & Driver Details */}
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.column}>
              <Text style={styles.sectionTitle}>Customer Details</Text>
              <Text style={styles.detailText}>{invoice.customer_name}</Text>
              <Text style={styles.detailSubtext}>{invoice.customer_phone}</Text>
            </View>
            <View style={styles.column}>
              <Text style={styles.sectionTitle}>Driver Details</Text>
              <Text style={styles.detailText}>{invoice.driver_name}</Text>
              <Text style={styles.detailSubtext}>{invoice.driver_phone}</Text>
              <Text style={styles.detailSubtext}>{invoice.vehicle_number}</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Shipment Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shipment Details</Text>
          
          <View style={styles.shipmentRow}>
            <Feather name="circle" size={12} color="#4CAF50" />
            <View style={styles.shipmentDetails}>
              <Text style={styles.label}>Pickup Location</Text>
              <Text style={styles.addressText}>{invoice.pickup_address}</Text>
              <Text style={styles.timeText}>{formatInvoiceDate(invoice.pickup_time)}</Text>
            </View>
          </View>

          <View style={styles.routeLine} />

          <View style={styles.shipmentRow}>
            <Feather name="map-pin" size={12} color="#EF4444" />
            <View style={styles.shipmentDetails}>
              <Text style={styles.label}>Drop Location</Text>
              <Text style={styles.addressText}>{invoice.dropoff_address}</Text>
              <Text style={styles.timeText}>{formatInvoiceDate(invoice.dropoff_time)}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Vehicle Type:</Text>
            <Text style={styles.infoValue}>{invoice.vehicle_type}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Distance Traveled:</Text>
            <Text style={styles.infoValue}>{(invoice.distance_km ?? 0).toFixed(2)} km</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Charges Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Charges Breakdown</Text>
          
          <View style={styles.chargeRow}>
            <Text style={styles.chargeLabel}>Base Fare</Text>
            <Text style={styles.chargeValue}>{formatCurrency(invoice.base_fare)}</Text>
          </View>

          {invoice.tip_amount > 0 && (
            <View style={styles.chargeRow}>
              <Text style={styles.chargeLabel}>Tip</Text>
              <Text style={styles.chargeValue}>{formatCurrency(invoice.tip_amount)}</Text>
            </View>
          )}

          {invoice.addon_charges > 0 && (
            <>
              <View style={styles.chargeRow}>
                <Text style={styles.chargeLabel}>Add-on Services</Text>
                <Text style={styles.chargeValue}>{formatCurrency(invoice.addon_charges)}</Text>
              </View>
              {invoice.addons && invoice.addons.length > 0 && (
                <View style={styles.addonsList}>
                  {invoice.addons.map((addon, index) => (
                    <View key={index} style={styles.addonItem}>
                      <Text style={styles.addonName}>• {addon.name}</Text>
                      <Text style={styles.addonPrice}>{formatCurrency(addon.price)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

          {invoice.waiting_charges > 0 && (
            <View style={styles.chargeRow}>
              <Text style={styles.chargeLabel}>Waiting Charges</Text>
              <Text style={styles.chargeValue}>{formatCurrency(invoice.waiting_charges)}</Text>
            </View>
          )}

          <View style={styles.totalDivider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>{formatCurrency(invoice.total_amount)}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Payment Info */}
        <View style={styles.section}>
          <View style={styles.paymentRow}>
            <View style={styles.paymentInfo}>
              <Text style={styles.label}>Payment Method</Text>
              <Text style={styles.paymentMethod}>{invoice.payment_method.toUpperCase()}</Text>
            </View>
            <View style={[styles.statusBadge, invoice.payment_status === 'paid' ? styles.paidBadge : styles.pendingBadge]}>
              <Text style={styles.statusText}>{invoice.payment_status.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Thank you for using Cart-R!</Text>
          <Text style={styles.footerSubtext}>For support, contact: support@cart-r.com</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  invoice: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  companyName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FF9800',
  },
  tagline: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  invoiceLabel: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  invoiceLabelText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  section: {
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  column: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    color: '#666',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  value: {
    fontSize: 14,
    color: '#000',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
  },
  detailText: {
    fontSize: 14,
    color: '#000',
    marginBottom: 2,
  },
  detailSubtext: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 20,
  },
  shipmentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  shipmentDetails: {
    marginLeft: 12,
    flex: 1,
  },
  addressText: {
    fontSize: 13,
    color: '#000',
    marginTop: 4,
    marginBottom: 2,
  },
  timeText: {
    fontSize: 11,
    color: '#666',
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: '#e0e0e0',
    marginLeft: 5,
    marginVertical: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
  },
  infoValue: {
    fontSize: 12,
    color: '#000',
    fontWeight: '600',
  },
  chargeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  chargeLabel: {
    fontSize: 13,
    color: '#333',
  },
  chargeValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  addonsList: {
    marginLeft: 16,
    marginTop: 4,
    marginBottom: 8,
  },
  addonItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  addonName: {
    fontSize: 11,
    color: '#666',
  },
  addonPrice: {
    fontSize: 11,
    color: '#666',
  },
  totalDivider: {
    height: 2,
    backgroundColor: '#000',
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentInfo: {
    flex: 1,
  },
  paymentMethod: {
    fontSize: 14,
    color: '#000',
    fontWeight: '600',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  paidBadge: {
    backgroundColor: '#4CAF50',
  },
  pendingBadge: {
    backgroundColor: '#FF9800',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  footer: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#000',
    fontWeight: '600',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 11,
    color: '#666',
  },
});

export default InvoiceTemplate;
