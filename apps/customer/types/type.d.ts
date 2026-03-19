import { TextInputProps, TouchableOpacityProps } from "react-native";

declare interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  profile_image_url: string;
  car_image_url: string;
  car_seats: number;
  rating: number;
}

declare interface MarkerData {
  latitude: number;
  longitude: number;
  id: string;
  title: string;
  profile_image_url: string;
  car_image_url: string;
  car_seats: number;
  rating: number;
  first_name: string;
  last_name: string;
  time?: number;
  price?: string;
}

declare interface MapProps {
  destinationLatitude?: number;
  destinationLongitude?: number;
  onDriverTimesCalculated?: (driversWithTimes: MarkerData[]) => void;
  selectedDriver?: string | null;
  onMapReady?: () => void;
}

declare interface Ride {
  origin_address: string;
  destination_address: string;
  origin_latitude: number;
  origin_longitude: number;
  destination_latitude: number;
  destination_longitude: number;
  ride_time: number;
  fare_price: number;
  payment_status: string;
  driver_id: string;
  user_id: string;
  created_at: string;
  driver: {
    first_name: string;
    last_name: string;
    car_seats: number;
  };
}

declare interface ButtonProps extends TouchableOpacityProps {
  title: string;
  bgVariant?: "primary" | "secondary" | "danger" | "outline" | "success";
  textVariant?: "primary" | "default" | "secondary" | "danger" | "success";
  IconLeft?: React.ComponentType<any>;
  IconRight?: React.ComponentType<any>;
  className?: string;
}

declare interface GoogleInputProps {
  icon?: string;
  initialLocation?: string;
  containerStyle?: string;
  textInputBackgroundColor?: string;
  handlePress: ({
    latitude,
    longitude,
    address,
  }: {
    latitude: number;
    longitude: number;
    address: string;
  }) => void;
  /** Optional: bias search results toward a specific location (service area center) */
  locationBias?: {
    latitude: number;
    longitude: number;
    radius: number; // meters
  };
}

declare interface InputFieldProps extends TextInputProps {
  label: string;
  icon?: any;
  secureTextEntry?: boolean;
  labelStyle?: string;
  containerStyle?: string;
  inputStyle?: string;
  iconStyle?: string;
  className?: string;
}

declare interface PaymentProps {
  fullName: string;
  email: string;
  amount: string;
  driverId: string;
  rideTime: number;
}

declare interface LocationStore {
  userLatitude: number | null;
  userLongitude: number | null;
  userAddress: string | null;
  destinationLatitude: number | null;
  destinationLongitude: number | null;
  destinationAddress: string | null;
  setUserLocation: ({
    latitude,
    longitude,
    address,
  }: {
    latitude: number;
    longitude: number;
    address: string;
  }) => void;
  setDestinationLocation: ({
    latitude,
    longitude,
    address,
  }: {
    latitude: number;
    longitude: number;
    address: string;
  }) => void;
  clearDestination: () => void;
}

declare interface DriverStore {
  drivers: MarkerData[];
  selectedDriver: string | null;
  setSelectedDriver: (driverId: string) => void;
  setDrivers: (drivers: MarkerData[]) => void;
  clearSelectedDriver: () => void;
}

declare interface DriverCardProps {
  item: MarkerData;
  selected: string | null;
  setSelected: () => void;
}
declare interface SelectedVehicle {
  vehicle_type: string;
  base_fare: number;
  distance_fare: number;
  time_fare: number;
  total_fare: number;
  distance_km: number;
  duration_minutes: number;
  surge_multiplier: number;
}

declare interface RideStore {
  selectedVehicle: SelectedVehicle | null;
  setSelectedVehicle: (vehicle: SelectedVehicle) => void;
  clearSelectedVehicle: () => void;
}

// Receiver details for goods delivery
declare interface ReceiverDetails {
  name: string;
  phone: string;
  saveAs?: string; // 'Home', 'Office', 'Friend', 'Family', 'Other'
}

declare type ReviewBookingPaymentMethod =
  | 'cash'
  | 'wallet'
  | 'wallet_plus_cash';

// Booking data structure matching database
declare interface Booking {
  id: string;
  booking_number: string;
  customer_id: string;
  driver_id: string | null;
  origin_address: string;
  origin_latitude: number;
  origin_longitude: number;
  destination_address: string;
  destination_latitude: number;
  destination_longitude: number;
  vehicle_type: string;
  estimated_distance: number | null;
  estimated_duration: number | null;
  total_fare: number;
  addon_charges?: number;
  tip_amount: number;
  fare_multiplier: number;
  driver_payout: number;
  payment_status: 'pending' | 'paid' | 'refunded' | 'partial_paid' | 'completed';
  payment_method: 'cash' | 'online' | 'wallet' | 'partial_wallet' | 'wallet_plus_online';
  wallet_amount_used?: number;
  payment_session_id?: string | null;
  online_payment_order_id?: string | null;
  status: 'pending' | 'accepted' | 'driver_arrived' | 'in_progress' | 'completed' | 'cancelled';
  pickup_otp: string | null;
  delivery_otp: string | null;
  receiver_name: string | null;
  receiver_phone: string | null;
  goods_description: string | null;
  created_at: string;
  accepted_at: string | null;
  driver_arrived_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  free_waiting_time_minutes: number;
  waiting_charge_per_minute: number;
  driver?: {
    id: string;
    vehicle_number: string;
    vehicle_model: string;
    vehicle_color: string | null;
    rating: number;
    user: {
      name: string;
      phone: string;
      avatar_url: string | null;
    };
  };
  /** When no driver accepts - booking expires; customer can retry with tip */
  expires_at?: string | null;
  /** Addons attached to this booking (from booking_addons + addon_services) */
  booking_addons?: Array<{
    quantity: number;
    unit_price: number;
    total_price?: number;
    addon_services: { name: string; code: string; price: number } | null;
  }>;
}

// Booking store for managing current booking state
declare interface BookingStore {
  // Receiver details (set in receiver-details screen)
  receiverDetails: ReceiverDetails | null;
  setReceiverDetails: (details: ReceiverDetails) => void;
  clearReceiverDetails: () => void;

  // Goods description
  goodsDescription: string | null;
  setGoodsDescription: (desc: string | null) => void;

  // Goods type selection
  goodsType: string | null;
  setGoodsType: (goodsType: string | null) => void;

  // Review booking payment method
  paymentMethod: ReviewBookingPaymentMethod | null;
  setPaymentMethod: (paymentMethod: ReviewBookingPaymentMethod | null) => void;

  // Selected add-ons from vehicle selection
  selectedAddonIds: string[];
  setSelectedAddonIds: (addonIds: string[]) => void;

  // Current active booking
  currentBooking: Booking | null;
  setCurrentBooking: (booking: Booking | null) => void;
  
  // Clear all booking state (after trip completion)
  clearAll: () => void;
}
