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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const clerk_expo_1 = require("@clerk/clerk-expo");
const stripe_react_native_1 = require("@stripe/stripe-react-native");
const expo_router_1 = require("expo-router");
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const react_native_modal_1 = require("react-native-modal");
const CustomButton_1 = __importDefault(require("@/components/CustomButton"));
const constants_1 = require("@/constants");
const fetch_1 = require("@/lib/fetch");
const store_1 = require("@/store");
const Payment = ({ fullName, email, amount, driverId, rideTime, }) => {
    const { initPaymentSheet, presentPaymentSheet } = (0, stripe_react_native_1.useStripe)();
    const { userAddress, userLongitude, userLatitude, destinationLatitude, destinationAddress, destinationLongitude, } = (0, store_1.useLocationStore)();
    const { userId } = (0, clerk_expo_1.useAuth)();
    const [success, setSuccess] = (0, react_1.useState)(false);
    const openPaymentSheet = async () => {
        await initializePaymentSheet();
        const { error } = await presentPaymentSheet();
        if (error) {
            react_native_1.Alert.alert(`Error code: ${error.code}`, error.message);
        }
        else {
            setSuccess(true);
        }
    };
    const initializePaymentSheet = async () => {
        const { error } = await initPaymentSheet({
            merchantDisplayName: "Example, Inc.",
            intentConfiguration: {
                mode: {
                    amount: parseInt(amount) * 100,
                    currencyCode: "usd",
                },
                confirmHandler: async (paymentMethod, shouldSavePaymentMethod, intentCreationCallback) => {
                    const { paymentIntent, customer } = await (0, fetch_1.fetchAPI)("/(api)/(stripe)/create", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            name: fullName || email.split("@")[0],
                            email: email,
                            amount: amount,
                            paymentMethodId: paymentMethod.id,
                        }),
                    });
                    if (paymentIntent.client_secret) {
                        const { result } = await (0, fetch_1.fetchAPI)("/(api)/(stripe)/pay", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                payment_method_id: paymentMethod.id,
                                payment_intent_id: paymentIntent.id,
                                customer_id: customer,
                                client_secret: paymentIntent.client_secret,
                            }),
                        });
                        if (result.client_secret) {
                            await (0, fetch_1.fetchAPI)("/(api)/ride/create", {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify({
                                    origin_address: userAddress,
                                    destination_address: destinationAddress,
                                    origin_latitude: userLatitude,
                                    origin_longitude: userLongitude,
                                    destination_latitude: destinationLatitude,
                                    destination_longitude: destinationLongitude,
                                    ride_time: rideTime.toFixed(0),
                                    fare_price: parseInt(amount) * 100,
                                    payment_status: "paid",
                                    driver_id: driverId,
                                    user_id: userId,
                                }),
                            });
                            intentCreationCallback({
                                clientSecret: result.client_secret,
                            });
                        }
                    }
                },
            },
            returnURL: "myapp://book-ride",
        });
        if (!error) {
            // setLoading(true);
        }
    };
    return (<>
      <CustomButton_1.default title="Confirm Ride" className="my-10" onPress={openPaymentSheet}/>

      <react_native_modal_1.ReactNativeModal isVisible={success} onBackdropPress={() => setSuccess(false)}>
        <react_native_1.View className="flex flex-col items-center justify-center bg-white p-7 rounded-2xl">
          <react_native_1.Image source={constants_1.images.check} className="w-28 h-28 mt-5"/>

          <react_native_1.Text className="text-2xl text-center font-JakartaBold mt-5">
            Booking placed successfully
          </react_native_1.Text>

          <react_native_1.Text className="text-md text-general-200 font-JakartaRegular text-center mt-3">
            Thank you for your booking. Your reservation has been successfully
            placed. Please proceed with your trip.
          </react_native_1.Text>

          <CustomButton_1.default title="Back Home" onPress={() => {
            setSuccess(false);
            expo_router_1.router.push("/(root)/(tabs)/home");
        }} className="mt-5"/>
        </react_native_1.View>
      </react_native_modal_1.ReactNativeModal>
    </>);
};
exports.default = Payment;
