"use strict";
// Payment Confirmation Modal
// Shown after trip completion to ask customer how they paid
Object.defineProperty(exports, "__esModule", { value: true });
const react_native_1 = require("react-native");
const react_1 = require("react");
const vector_icons_1 = require("@expo/vector-icons");
const supabase_1 = require("@/lib/supabase");
const PaymentConfirmationModal = ({ visible, bookingId, amount, onConfirm, onSkip, }) => {
    const [isSubmitting, setIsSubmitting] = (0, react_1.useState)(false);
    const [selectedMethod, setSelectedMethod] = (0, react_1.useState)(null);
    const handleConfirm = async (method) => {
        setSelectedMethod(method);
        setIsSubmitting(true);
        try {
            const { error } = await supabase_1.supabase.rpc('confirm_customer_payment', {
                p_booking_id: bookingId,
                p_payment_method: method,
            });
            if (error) {
                console.error('Error confirming payment:', error);
            }
        }
        catch (err) {
            console.error('Failed to confirm payment:', err);
        }
        finally {
            setIsSubmitting(false);
            onConfirm();
        }
    };
    const options = [
        {
            method: 'cartr_app',
            icon: 'credit-card',
            label: 'Paid via Cart-R App',
            sublabel: 'Online payment through the app',
            color: '#22c55e',
            bgColor: 'bg-green-50',
            borderColor: 'border-green-200',
        },
        {
            method: 'cash_to_driver',
            icon: 'dollar-sign',
            label: 'Paid Cash to Driver',
            sublabel: 'Driver collected cash payment',
            color: '#3b82f6',
            bgColor: 'bg-blue-50',
            borderColor: 'border-blue-200',
        },
        {
            method: 'driver_personal_upi',
            icon: 'alert-triangle',
            label: 'Driver asked for personal UPI',
            sublabel: 'Report: Driver avoided Cart-R payment',
            color: '#ef4444',
            bgColor: 'bg-red-50',
            borderColor: 'border-red-200',
        },
    ];
    return (<react_native_1.Modal visible={visible} transparent animationType="slide" onRequestClose={onSkip}>
      <react_native_1.View className="flex-1 bg-black/50 justify-end">
        <react_native_1.View className="bg-white rounded-t-3xl px-6 pt-8 pb-10">
          {/* Header */}
          <react_native_1.View className="items-center mb-6">
            <react_native_1.View className="w-16 h-16 bg-green-100 rounded-full items-center justify-center mb-4">
              <vector_icons_1.Feather name="check-circle" size={32} color="#22c55e"/>
            </react_native_1.View>
            <react_native_1.Text className="text-2xl font-JakartaBold text-gray-800">
              Trip Completed!
            </react_native_1.Text>
            <react_native_1.Text className="text-gray-500 font-JakartaMedium mt-1">
              Total: ₹{amount}
            </react_native_1.Text>
          </react_native_1.View>

          {/* Question */}
          <react_native_1.Text className="text-center text-gray-600 font-JakartaMedium mb-6">
            How did you pay for this trip?
          </react_native_1.Text>

          {/* Options */}
          <react_native_1.View className="gap-3 mb-6">
            {options.map((option) => (<react_native_1.TouchableOpacity key={option.method} onPress={() => handleConfirm(option.method)} disabled={isSubmitting} className={`flex-row items-center p-4 rounded-xl border ${option.bgColor} ${option.borderColor}`}>
                {isSubmitting && selectedMethod === option.method ? (<react_native_1.ActivityIndicator size="small" color={option.color}/>) : (<vector_icons_1.Feather name={option.icon} size={24} color={option.color}/>)}
                <react_native_1.View className="ml-4 flex-1">
                  <react_native_1.Text className="font-JakartaSemiBold text-gray-800">
                    {option.label}
                  </react_native_1.Text>
                  <react_native_1.Text className="text-xs text-gray-500 font-Jakarta">
                    {option.sublabel}
                  </react_native_1.Text>
                </react_native_1.View>
                <vector_icons_1.Feather name="chevron-right" size={20} color="#9ca3af"/>
              </react_native_1.TouchableOpacity>))}
          </react_native_1.View>

          {/* Skip Button */}
          <react_native_1.TouchableOpacity onPress={onSkip} disabled={isSubmitting} className="py-3">
            <react_native_1.Text className="text-center text-gray-400 font-JakartaMedium">
              Skip for now
            </react_native_1.Text>
          </react_native_1.TouchableOpacity>
        </react_native_1.View>
      </react_native_1.View>
    </react_native_1.Modal>);
};
exports.default = PaymentConfirmationModal;
