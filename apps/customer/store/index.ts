import { create } from "zustand";

import { 
  DriverStore, 
  LocationStore, 
  MarkerData, 
  RideStore, 
  SelectedVehicle,
  BookingStore,
  ReceiverDetails,
  Booking,
} from "@/types/type";

export const useLocationStore = create<LocationStore>((set) => ({
  userLatitude: null,
  userLongitude: null,
  userAddress: null,
  destinationLatitude: null,
  destinationLongitude: null,
  destinationAddress: null,
  setUserLocation: ({
    latitude,
    longitude,
    address,
  }: {
    latitude: number;
    longitude: number;
    address: string;
  }) => {
    set(() => ({
      userLatitude: latitude,
      userLongitude: longitude,
      userAddress: address,
    }));

    // if driver is selected and now new location is set, clear the selected driver
    const { selectedDriver, clearSelectedDriver } = useDriverStore.getState();
    if (selectedDriver) clearSelectedDriver();
    
    // Clear selected vehicle to force fare recalculation
    const { selectedVehicle, clearSelectedVehicle } = useRideStore.getState();
    if (selectedVehicle) clearSelectedVehicle();
  },

  setDestinationLocation: ({
    latitude,
    longitude,
    address,
  }: {
    latitude: number;
    longitude: number;
    address: string;
  }) => {
    set(() => ({
      destinationLatitude: latitude,
      destinationLongitude: longitude,
      destinationAddress: address,
    }));

    // if driver is selected and now new location is set, clear the selected driver
    const { selectedDriver, clearSelectedDriver } = useDriverStore.getState();
    if (selectedDriver) clearSelectedDriver();
    
    // Clear selected vehicle to force fare recalculation
    const { selectedVehicle, clearSelectedVehicle } = useRideStore.getState();
    if (selectedVehicle) clearSelectedVehicle();
  },

  clearUserLocation: () => {
    set(() => ({
      userLatitude: null,
      userLongitude: null,
      userAddress: null,
    }));

    const { selectedDriver, clearSelectedDriver } = useDriverStore.getState();
    if (selectedDriver) clearSelectedDriver();

    const { selectedVehicle, clearSelectedVehicle } = useRideStore.getState();
    if (selectedVehicle) clearSelectedVehicle();
  },

  clearDestination: () => {
    set(() => ({
      destinationLatitude: null,
      destinationLongitude: null,
      destinationAddress: null,
    }));

    const { selectedDriver, clearSelectedDriver } = useDriverStore.getState();
    if (selectedDriver) clearSelectedDriver();

    const { selectedVehicle, clearSelectedVehicle } = useRideStore.getState();
    if (selectedVehicle) clearSelectedVehicle();
  },
}));

export const useDriverStore = create<DriverStore>((set) => ({
  drivers: [] as MarkerData[],
  selectedDriver: null,
  setSelectedDriver: (driverId: string) =>
    set(() => ({ selectedDriver: driverId })),
  setDrivers: (drivers: MarkerData[]) => set(() => ({ drivers })),
  clearSelectedDriver: () => set(() => ({ selectedDriver: null })),
}));

export const useRideStore = create<RideStore>((set) => ({
  selectedVehicle: null,
  setSelectedVehicle: (vehicle: SelectedVehicle) => set(() => ({ selectedVehicle: vehicle })),
  clearSelectedVehicle: () => set(() => ({ selectedVehicle: null })),
}));

// Booking store - manages receiver details and current active booking
export const useBookingStore = create<BookingStore>((set) => ({
  // Receiver details
  receiverDetails: null,
  setReceiverDetails: (details: ReceiverDetails) => set(() => ({ receiverDetails: details })),
  clearReceiverDetails: () => set(() => ({ receiverDetails: null })),

  // Goods description
  goodsDescription: null,
  setGoodsDescription: (desc: string | null) => set(() => ({ goodsDescription: desc })),

  // Goods type
  goodsType: null,
  setGoodsType: (goodsType: string | null) => set(() => ({ goodsType })),

  // Payment method selected during review
  paymentMethod: null,
  setPaymentMethod: (paymentMethod) => set(() => ({ paymentMethod })),

  // Selected add-ons from vehicle selection
  selectedAddonIds: [],
  setSelectedAddonIds: (selectedAddonIds: string[]) => set(() => ({ selectedAddonIds })),

  // Current active booking
  currentBooking: null,
  setCurrentBooking: (booking: Booking | null) => set(() => ({ currentBooking: booking })),

  // Clear all booking state (after trip completion or cancellation)
  clearAll: () => set(() => ({
    receiverDetails: null,
    goodsDescription: null,
    goodsType: null,
    paymentMethod: null,
    selectedAddonIds: [],
    currentBooking: null,
  })),
}));
