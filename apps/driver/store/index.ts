import { create } from "zustand";

import { DriverStore, LocationStore, MarkerData } from "@/types/type";

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
  },
}));

export const useDriverStore = create<DriverStore>((set) => ({
  drivers: [] as MarkerData[],
  selectedDriver: null,
  setSelectedDriver: (driverId: number) =>
    set(() => ({ selectedDriver: driverId })),
  setDrivers: (drivers: MarkerData[]) => set(() => ({ drivers })),
  clearSelectedDriver: () => set(() => ({ selectedDriver: null })),
}));

interface DocumentState {
  license_image_url: string | null;
  rc_image_url: string | null;
  insurance_image_url: string | null;
  vehicle_image_url: string | null;
  setDocumentUrl: (docId: string, url: string | null) => void;
  clearDocuments: () => void;
}

export const useOnboardingStore = create<DocumentState>((set) => ({
  license_image_url: null,
  rc_image_url: null,
  insurance_image_url: null,
  vehicle_image_url: null,
  setDocumentUrl: (docId, url) => set((state) => {
    switch(docId) {
      case 'license': return { license_image_url: url };
      case 'rc': return { rc_image_url: url };
      case 'insurance': return { insurance_image_url: url };
      case 'vehicle': return { vehicle_image_url: url };
      default: return state;
    }
  }),
  clearDocuments: () => set({
    license_image_url: null,
    rc_image_url: null,
    insurance_image_url: null,
    vehicle_image_url: null,
  })
}));
