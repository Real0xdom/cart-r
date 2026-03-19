"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useBookingStore = exports.useRideStore = exports.useDriverStore = exports.useLocationStore = void 0;
const zustand_1 = require("zustand");
exports.useLocationStore = (0, zustand_1.create)((set) => ({
    userLatitude: null,
    userLongitude: null,
    userAddress: null,
    destinationLatitude: null,
    destinationLongitude: null,
    destinationAddress: null,
    setUserLocation: ({ latitude, longitude, address, }) => {
        set(() => ({
            userLatitude: latitude,
            userLongitude: longitude,
            userAddress: address,
        }));
        // if driver is selected and now new location is set, clear the selected driver
        const { selectedDriver, clearSelectedDriver } = exports.useDriverStore.getState();
        if (selectedDriver)
            clearSelectedDriver();
    },
    setDestinationLocation: ({ latitude, longitude, address, }) => {
        set(() => ({
            destinationLatitude: latitude,
            destinationLongitude: longitude,
            destinationAddress: address,
        }));
        // if driver is selected and now new location is set, clear the selected driver
        const { selectedDriver, clearSelectedDriver } = exports.useDriverStore.getState();
        if (selectedDriver)
            clearSelectedDriver();
    },
}));
exports.useDriverStore = (0, zustand_1.create)((set) => ({
    drivers: [],
    selectedDriver: null,
    setSelectedDriver: (driverId) => set(() => ({ selectedDriver: driverId })),
    setDrivers: (drivers) => set(() => ({ drivers })),
    clearSelectedDriver: () => set(() => ({ selectedDriver: null })),
}));
exports.useRideStore = (0, zustand_1.create)((set) => ({
    selectedVehicle: null,
    setSelectedVehicle: (vehicle) => set(() => ({ selectedVehicle: vehicle })),
    clearSelectedVehicle: () => set(() => ({ selectedVehicle: null })),
}));
// Booking store - manages receiver details and current active booking
exports.useBookingStore = (0, zustand_1.create)((set) => ({
    // Receiver details
    receiverDetails: null,
    setReceiverDetails: (details) => set(() => ({ receiverDetails: details })),
    clearReceiverDetails: () => set(() => ({ receiverDetails: null })),
    // Goods description
    goodsDescription: null,
    setGoodsDescription: (desc) => set(() => ({ goodsDescription: desc })),
    // Current active booking
    currentBooking: null,
    setCurrentBooking: (booking) => set(() => ({ currentBooking: booking })),
    // Clear all booking state (after trip completion or cancellation)
    clearAll: () => set(() => ({
        receiverDetails: null,
        goodsDescription: null,
        currentBooking: null,
    })),
}));
