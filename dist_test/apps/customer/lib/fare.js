"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateFares = void 0;
const supabase_1 = require("./supabase");
const calculateFares = async (originLat, originLng, destLat, destLng) => {
    try {
        const { data, error } = await supabase_1.supabase.functions.invoke('calculate-fare', {
            body: {
                origin_lat: originLat,
                origin_lng: originLng,
                dest_lat: destLat,
                dest_lng: destLng,
                get_all_vehicles: true,
            },
        });
        if (error) {
            console.error("Error invoking calculate-fare function:", error);
            throw error;
        }
        return data.options || [];
    }
    catch (error) {
        console.error("Error calculating fares:", error);
        throw error;
    }
};
exports.calculateFares = calculateFares;
