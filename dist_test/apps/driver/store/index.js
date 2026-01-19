"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useDriverStore = exports.useLocationStore = void 0;
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
