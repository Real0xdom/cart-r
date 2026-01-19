"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBookingOTP = exports.verifyPhoneOTP = exports.sendPhoneOTP = exports.googleOAuth = exports.tokenCache = void 0;
const Linking = __importStar(require("expo-linking"));
const SecureStore = __importStar(require("expo-secure-store"));
const react_native_1 = require("react-native");
const supabase_1 = require("@/lib/supabase");
// Token cache for secure storage
exports.tokenCache = {
    async getToken(key) {
        try {
            if (react_native_1.Platform.OS === 'web') {
                return localStorage.getItem(key);
            }
            const item = await SecureStore.getItemAsync(key);
            return item;
        }
        catch (error) {
            console.error("SecureStore get item error: ", error);
            return null;
        }
    },
    async saveToken(key, value) {
        try {
            if (react_native_1.Platform.OS === 'web') {
                localStorage.setItem(key, value);
                return;
            }
            return SecureStore.setItemAsync(key, value);
        }
        catch (err) {
            console.error("SecureStore save item error: ", err);
        }
    },
    async removeToken(key) {
        try {
            if (react_native_1.Platform.OS === 'web') {
                localStorage.removeItem(key);
                return;
            }
            return SecureStore.deleteItemAsync(key);
        }
        catch (err) {
            console.error("SecureStore remove item error: ", err);
        }
    },
};
// Google OAuth with Supabase
const googleOAuth = async () => {
    try {
        const redirectUrl = Linking.createURL("/(customer)/(tabs)/home");
        const { data, error } = await supabase_1.supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl,
            },
        });
        if (error)
            throw error;
        return {
            success: true,
            code: "success",
            message: "Redirecting to Google sign in...",
            url: data.url,
        };
    }
    catch (err) {
        console.error("Google OAuth error:", err);
        return {
            success: false,
            code: (err === null || err === void 0 ? void 0 : err.code) || "error",
            message: (err === null || err === void 0 ? void 0 : err.message) || "An error occurred while signing in with Google",
        };
    }
};
exports.googleOAuth = googleOAuth;
// Phone OTP login
const sendPhoneOTP = async (phone) => {
    try {
        const { error } = await supabase_1.supabase.auth.signInWithOtp({
            phone,
        });
        if (error)
            throw error;
        return {
            success: true,
            message: "OTP sent successfully",
        };
    }
    catch (err) {
        console.error("Phone OTP error:", err);
        return {
            success: false,
            message: (err === null || err === void 0 ? void 0 : err.message) || "Failed to send OTP",
        };
    }
};
exports.sendPhoneOTP = sendPhoneOTP;
// Verify phone OTP
const verifyPhoneOTP = async (phone, otp) => {
    try {
        const { data, error } = await supabase_1.supabase.auth.verifyOtp({
            phone,
            token: otp,
            type: 'sms',
        });
        if (error)
            throw error;
        return {
            success: true,
            user: data.user,
            session: data.session,
        };
    }
    catch (err) {
        console.error("Verify OTP error:", err);
        return {
            success: false,
            message: (err === null || err === void 0 ? void 0 : err.message) || "Invalid OTP",
        };
    }
};
exports.verifyPhoneOTP = verifyPhoneOTP;
// Generate booking OTP (for pickup verification)
const generateBookingOTP = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
};
exports.generateBookingOTP = generateBookingOTP;
