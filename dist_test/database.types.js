"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Constants = void 0;
exports.Constants = {
    graphql_public: {
        Enums: {},
    },
    public: {
        Enums: {
            booking_status: [
                "pending",
                "accepted",
                "driver_arrived",
                "in_progress",
                "completed",
                "cancelled",
            ],
            payment_method: ["cash", "online"],
            payment_status: ["pending", "paid", "refunded"],
            user_role: ["customer", "driver", "admin"],
            vehicle_type: ["bike", "auto", "mini", "sedan", "suv", "truck", "tempo"],
            verification_status: ["pending", "approved", "rejected"],
        },
    },
};
