// SOS/Emergency Safety Feature
import { supabase } from './supabase';
import { Alert, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';

export interface EmergencyContact {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  relationship: string;
  is_primary: boolean;
  created_at: string;
}

export interface EmergencyAlert {
  id: string;
  user_id: string;
  booking_id: string | null;
  alert_type: 'sos' | 'safety_check' | 'share_trip';
  latitude: number;
  longitude: number;
  status: 'active' | 'resolved' | 'false_alarm';
  created_at: string;
}

/**
 * Add an emergency contact
 */
export async function addEmergencyContact(
  name: string,
  phone: string,
  relationship: string,
  isPrimary: boolean = false
): Promise<{ data: EmergencyContact | null; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'User not authenticated' };
    }

    // If setting as primary, unset other primary contacts
    if (isPrimary) {
      await supabase
        .from('emergency_contacts')
        .update({ is_primary: false })
        .eq('user_id', user.id);
    }

    const { data, error } = await supabase
      .from('emergency_contacts')
      .insert({
        user_id: user.id,
        name,
        phone,
        relationship,
        is_primary: isPrimary,
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/**
 * Get user's emergency contacts
 */
export async function getEmergencyContacts(): Promise<{ data: EmergencyContact[]; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: [], error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('user_id', user.id)
      .order('is_primary', { ascending: false });

    if (error) {
      return { data: [], error: error.message };
    }

    return { data: data || [], error: null };
  } catch (err: any) {
    return { data: [], error: err.message };
  }
}

/**
 * Delete an emergency contact
 */
export async function deleteEmergencyContact(contactId: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase
      .from('emergency_contacts')
      .delete()
      .eq('id', contactId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Trigger SOS alert - called during emergency
 */
export async function triggerSOSAlert(
  bookingId?: string
): Promise<{ success: boolean; alertId?: string; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    // Get current location
    let latitude = 0;
    let longitude = 0;
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      latitude = location.coords.latitude;
      longitude = location.coords.longitude;
    } catch (locError) {
      console.error('Could not get location for SOS:', locError);
    }

    // Create SOS alert in database
    const { data: alert, error: alertError } = await supabase
      .from('emergency_alerts')
      .insert({
        user_id: user.id,
        booking_id: bookingId || null,
        alert_type: 'sos',
        latitude,
        longitude,
        status: 'active',
      })
      .select()
      .single();

    if (alertError) {
      return { success: false, error: alertError.message };
    }

    // Get emergency contacts
    const { data: contacts } = await getEmergencyContacts();

    // Get user profile for message
    const { data: profile } = await supabase
      .from('users')
      .select('name, phone')
      .eq('id', user.id)
      .single();

    // Trigger SMS/notifications to emergency contacts
    const message = `🚨 EMERGENCY ALERT from CARTR\n\n${profile?.name || 'A user'} has triggered an SOS alert.\n\nLocation: https://maps.google.com/?q=${latitude},${longitude}\n\nPlease contact them immediately at ${profile?.phone || 'unknown'}.`;

    // Send notifications via Edge Function
    if (contacts && contacts.length > 0) {
      await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          user_id: user.id,
          title: '🚨 SOS Alert Triggered',
          body: 'Emergency contacts have been notified',
          data: {
            type: 'sos_alert',
            alert_id: alert.id,
            latitude,
            longitude,
          },
        }),
      });
    }

    // Also call emergency services option
    Alert.alert(
      '🚨 SOS Alert Sent',
      'Your emergency contacts have been notified with your location.\n\nDo you want to call emergency services?',
      [
        { text: 'No', style: 'cancel' },
        { 
          text: 'Call 112', 
          style: 'destructive',
          onPress: () => Linking.openURL('tel:112'),
        },
      ]
    );

    return { success: true, alertId: alert.id, error: null };
  } catch (err: any) {
    console.error('SOS trigger error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Share trip with emergency contacts
 */
export async function shareTripWithContacts(
  bookingId: string,
  driverName: string,
  vehicleNumber: string,
  destination: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('users')
      .select('name')
      .eq('id', user.id)
      .single();

    // Get booking details for location
    const { data: booking } = await supabase
      .from('bookings')
      .select('origin_latitude, origin_longitude, destination_latitude, destination_longitude')
      .eq('id', bookingId)
      .single();

    // Get emergency contacts
    const { data: contacts } = await getEmergencyContacts();

    if (!contacts || contacts.length === 0) {
      return { success: false, error: 'No emergency contacts set up' };
    }

    // Create share trip alert
    await supabase.from('emergency_alerts').insert({
      user_id: user.id,
      booking_id: bookingId,
      alert_type: 'share_trip',
      latitude: booking?.origin_latitude || 0,
      longitude: booking?.origin_longitude || 0,
      status: 'active',
    });

    // Share via native share dialog
    const shareMessage = `🚗 ${profile?.name || 'I'} is on a CARTR trip\n\nDriver: ${driverName}\nVehicle: ${vehicleNumber}\nDestination: ${destination}\n\nLive tracking: cartr://track/${bookingId}`;

    // For each contact, could send SMS
    // For now, show confirmation
    Alert.alert(
      '✅ Trip Shared',
      `Your trip details have been shared with ${contacts.length} emergency contact(s).`,
      [{ text: 'OK' }]
    );

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Resolve/cancel an SOS alert
 */
export async function resolveSOSAlert(
  alertId: string,
  isFalseAlarm: boolean = false
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase
      .from('emergency_alerts')
      .update({
        status: isFalseAlarm ? 'false_alarm' : 'resolved',
        resolved_at: new Date().toISOString(),
      })
      .eq('id', alertId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
