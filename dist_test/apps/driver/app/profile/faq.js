"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = FAQ;
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const expo_router_1 = require("expo-router");
const vector_icons_1 = require("@expo/vector-icons");
function FAQ() {
    const router = (0, expo_router_1.useRouter)();
    const faqs = [
        {
            question: "How do I get paid?",
            answer: "Earnings are transferred to your registered bank account every Wednesday for the previous week's trips. Please ensure your bank details are correct in the Profile > Bank Account section."
        },
        {
            question: "How do I accept a ride?",
            answer: "When a new ride request appears, you'll see the pickup and drop-off locations along with the estimated fare. Swipe the 'Accept' button to confirm the ride."
        },
        {
            question: "What if the customer cancels?",
            answer: "If a customer cancels after 5 minutes of your acceptance, you will receive a cancellation fee. This will be added to your weekly earnings."
        },
        {
            question: "How do I verify a pickup?",
            answer: "Upon reaching the pickup location, ask the customer for the 4-digit OTP displayed on their app. Enter this OTP in your driver app to start the trip."
        },
        {
            question: "Can I decline a ride?",
            answer: "Yes, you can decline a ride request if you are unable to take it. However, frequent cancellations after accepting may affect your driver rating."
        },
        {
            question: "How do I change my vehicle details?",
            answer: "To change your vehicle, please contact support with your new vehicle's RC and Insurance documents. You will need to undergo re-verification."
        }
    ];
    return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-gray-900">
      {/* Header */}
      <react_native_1.View className="flex-row items-center p-4 border-b border-gray-800">
        <react_native_1.TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-gray-800 rounded-full items-center justify-center mr-4">
          <vector_icons_1.Feather name="arrow-left" size={24} color="#fff"/>
        </react_native_1.TouchableOpacity>
        <react_native_1.Text className="text-xl font-JakartaBold text-white">Frequently Asked Questions</react_native_1.Text>
      </react_native_1.View>

      <react_native_1.ScrollView className="flex-1 p-5">
        
        {faqs.map((faq, index) => (<react_native_1.View key={index} className="mb-6 bg-gray-800 p-4 rounded-xl">
                <react_native_1.View className="flex-row items-start mb-2">
                    <react_native_1.Text className="text-lg mr-2">❓</react_native_1.Text>
                    <react_native_1.Text className="text-white font-JakartaSemiBold text-base flex-1">{faq.question}</react_native_1.Text>
                </react_native_1.View>
                <react_native_1.Text className="text-gray-400 leading-5 ml-8">
                    {faq.answer}
                </react_native_1.Text>
            </react_native_1.View>))}

        <react_native_1.View className="h-10"/>

      </react_native_1.ScrollView>
    </react_native_safe_area_context_1.SafeAreaView>);
}
