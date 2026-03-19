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
exports.default = BankDetails;
const react_native_1 = require("react-native");
const AuthContext_1 = require("@/contexts/AuthContext");
const react_1 = require("react");
const supabase_1 = require("@/lib/supabase");
const vector_icons_1 = require("@expo/vector-icons");
const Crypto = __importStar(require("expo-crypto"));
function BankDetails() {
    var _a;
    const { driverProfile, user } = (0, AuthContext_1.useAuth)();
    const [isLoading, setIsLoading] = (0, react_1.useState)(false);
    const [balance, setBalance] = (0, react_1.useState)(0);
    const [withdrawals, setWithdrawals] = (0, react_1.useState)([]);
    // Bank Details State
    const [isEditing, setIsEditing] = (0, react_1.useState)(false);
    const [bankDetails, setBankDetails] = (0, react_1.useState)({
        account_holder_name: '',
        account_number: '',
        ifsc_code: '',
        bank_name: ''
    });
    // Withdrawal State
    const [amount, setAmount] = (0, react_1.useState)('');
    const [isWithdrawing, setIsWithdrawing] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        fetchData();
    }, [driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.id]);
    const fetchData = async () => {
        if (!(driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.id))
            return;
        // 1. Fetch Bank Details
        const details = driverProfile.bank_details;
        if (details) {
            setBankDetails(details);
        }
        else {
            setIsEditing(true); // Auto-edit if no details
        }
        // 2. Fetch Balance
        const { data: balanceData } = await supabase_1.supabase.rpc('get_driver_balance', {
            p_driver_id: driverProfile.id
        });
        setBalance(balanceData || 0);
        // 3. Fetch History
        const { data: historyData } = await supabase_1.supabase
            .from('withdrawals')
            .select('*')
            .eq('driver_id', driverProfile.id)
            .order('created_at', { ascending: false });
        if (historyData) {
            setWithdrawals(historyData);
        }
    };
    const saveBankDetails = async () => {
        if (!bankDetails.account_number || !bankDetails.ifsc_code || !bankDetails.account_holder_name) {
            react_native_1.Alert.alert('Error', 'Please fill all fields');
            return;
        }
        setIsLoading(true);
        const { error } = await supabase_1.supabase
            .from('drivers')
            .update({ bank_details: bankDetails })
            .eq('id', driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.id);
        setIsLoading(false);
        if (error) {
            react_native_1.Alert.alert('Error', error.message);
        }
        else {
            react_native_1.Alert.alert('Success', 'Bank details saved');
            setIsEditing(false);
        }
    };
    const handleWithdraw = async () => {
        const withdrawalAmount = parseFloat(amount);
        if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
            react_native_1.Alert.alert('Error', 'Please enter a valid amount');
            return;
        }
        if (withdrawalAmount > balance) {
            react_native_1.Alert.alert('Error', 'Insufficient balance');
            return;
        }
        // Check if bank details exist
        if (!bankDetails.account_number) {
            react_native_1.Alert.alert('Error', 'Please add bank details first');
            return;
        }
        // Generate Idempotency Key
        const idempotencyKey = Crypto.randomUUID();
        setIsWithdrawing(true);
        const { data, error } = await supabase_1.supabase.rpc('request_withdrawal', {
            p_driver_id: driverProfile === null || driverProfile === void 0 ? void 0 : driverProfile.id,
            p_amount: withdrawalAmount,
            p_idempotency_key: idempotencyKey
        });
        setIsWithdrawing(false);
        if (error) {
            react_native_1.Alert.alert('Error', error.message);
        }
        else if (data && !data.success) {
            react_native_1.Alert.alert('Error', data.error || 'Failed to request withdrawal');
        }
        else {
            react_native_1.Alert.alert('Success', 'Withdrawal request submitted');
            setAmount('');
            fetchData(); // Refresh balance and history
        }
    };
    const getStatusColor = (status) => {
        switch (status) {
            case 'approved': return 'text-green-400';
            case 'paid': return 'text-green-500';
            case 'rejected': return 'text-red-400';
            default: return 'text-yellow-400';
        }
    };
    return (<react_native_1.ScrollView className="flex-1 bg-gray-900">
      <react_native_1.View className="p-5 pb-10">
        
        {/* Balance Card */}
        <react_native_1.View className="bg-gray-800 rounded-2xl p-6 mb-6 border border-gray-700">
          <react_native_1.Text className="text-gray-400 text-sm mb-1">Available for Withdrawal</react_native_1.Text>
          <react_native_1.Text className="text-white text-3xl font-JakartaBold">₹{balance.toLocaleString()}</react_native_1.Text>
          <react_native_1.View className="flex-row items-center mt-4">
              <react_native_1.TextInput value={amount} onChangeText={setAmount} placeholder="Amount to withdraw" placeholderTextColor="#666" keyboardType="numeric" className="flex-1 bg-gray-900 p-3 rounded-l-xl text-white font-JakartaMedium border border-gray-600"/>
              <react_native_1.TouchableOpacity onPress={handleWithdraw} disabled={isWithdrawing || balance <= 0} className={`p-3 rounded-r-xl w-24 items-center justify-center ${balance > 0 ? 'bg-green-600' : 'bg-gray-600'}`}>
                  {isWithdrawing ? (<react_native_1.ActivityIndicator size="small" color="#fff"/>) : (<react_native_1.Text className="text-white font-JakartaBold">Withdraw</react_native_1.Text>)}
              </react_native_1.TouchableOpacity>
          </react_native_1.View>
        </react_native_1.View>

        {/* Bank Account Section */}
        <react_native_1.View className="flex-row justify-between items-center mb-2">
            <react_native_1.Text className="text-gray-400 font-JakartaMedium">BANK DETAILS</react_native_1.Text>
            <react_native_1.TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
                <react_native_1.Text className="text-blue-400 font-JakartaBold">{isEditing ? 'Cancel' : 'Edit'}</react_native_1.Text>
            </react_native_1.TouchableOpacity>
        </react_native_1.View>

        {isEditing ? (<react_native_1.View className="bg-gray-800 rounded-2xl p-5 mb-6 space-y-4">
                <react_native_1.View>
                    <react_native_1.Text className="text-gray-400 text-xs mb-1">Account Holder Name</react_native_1.Text>
                    <react_native_1.TextInput value={bankDetails.account_holder_name} onChangeText={(t) => setBankDetails({ ...bankDetails, account_holder_name: t })} className="bg-gray-900 p-3 rounded-xl text-white border border-gray-700" placeholder="e.g. John Doe" placeholderTextColor="#555"/>
                </react_native_1.View>
                <react_native_1.View>
                    <react_native_1.Text className="text-gray-400 text-xs mb-1">Bank Name</react_native_1.Text>
                    <react_native_1.TextInput value={bankDetails.bank_name} onChangeText={(t) => setBankDetails({ ...bankDetails, bank_name: t })} className="bg-gray-900 p-3 rounded-xl text-white border border-gray-700" placeholder="e.g. HDFC Bank" placeholderTextColor="#555"/>
                </react_native_1.View>
                <react_native_1.View>
                    <react_native_1.Text className="text-gray-400 text-xs mb-1">Account Number</react_native_1.Text>
                    <react_native_1.TextInput value={bankDetails.account_number} onChangeText={(t) => setBankDetails({ ...bankDetails, account_number: t })} className="bg-gray-900 p-3 rounded-xl text-white border border-gray-700" placeholder="e.g. 1234567890" placeholderTextColor="#555" keyboardType="numeric"/>
                </react_native_1.View>
                <react_native_1.View>
                    <react_native_1.Text className="text-gray-400 text-xs mb-1">IFSC Code</react_native_1.Text>
                    <react_native_1.TextInput value={bankDetails.ifsc_code} onChangeText={(t) => setBankDetails({ ...bankDetails, ifsc_code: t })} className="bg-gray-900 p-3 rounded-xl text-white border border-gray-700" placeholder="e.g. HDFC0001234" placeholderTextColor="#555" autoCapitalize="characters"/>
                </react_native_1.View>
                <react_native_1.TouchableOpacity onPress={saveBankDetails} disabled={isLoading} className="bg-blue-600 p-4 rounded-xl items-center mt-2">
                    {isLoading ? <react_native_1.ActivityIndicator color="#fff"/> : <react_native_1.Text className="text-white font-JakartaBold">Save Details</react_native_1.Text>}
                </react_native_1.TouchableOpacity>
            </react_native_1.View>) : (<react_native_1.View className="bg-gray-800 rounded-2xl p-5 mb-6">
                {bankDetails.account_number ? (<>
                        <react_native_1.View className="flex-row items-center justify-between">
                            <react_native_1.View>
                                <react_native_1.Text className="text-white font-JakartaBold text-lg">{bankDetails.bank_name || 'Bank Account'}</react_native_1.Text>
                                <react_native_1.Text className="text-gray-400">{bankDetails.account_holder_name}</react_native_1.Text>
                                <react_native_1.Text className="text-gray-500 mt-1">
                                    {(_a = bankDetails.account_number) === null || _a === void 0 ? void 0 : _a.replace(/.(?=.{4})/g, '*')}
                                </react_native_1.Text>
                            </react_native_1.View>
                            <react_native_1.View className="bg-green-500/20 px-2 py-1 rounded">
                                <react_native_1.Text className="text-green-400 text-xs">Primary</react_native_1.Text>
                            </react_native_1.View>
                        </react_native_1.View>
                    </>) : (<react_native_1.TouchableOpacity onPress={() => setIsEditing(true)} className="items-center py-4">
                        <vector_icons_1.Feather name="plus-circle" size={32} color="#60a5fa"/>
                        <react_native_1.Text className="text-blue-400 mt-2 font-JakartaSemiBold">Add Bank Account</react_native_1.Text>
                    </react_native_1.TouchableOpacity>)}
            </react_native_1.View>)}

        {/* Withdrawal History */}
        <react_native_1.Text className="text-gray-400 mb-2 font-JakartaMedium">HISTORY</react_native_1.Text>
        {withdrawals.length > 0 ? (withdrawals.map((item) => (<react_native_1.View key={item.id} className="bg-gray-800 rounded-xl p-4 mb-3 flex-row justify-between items-center">
                    <react_native_1.View>
                        <react_native_1.Text className="text-white font-JakartaBold">Withdrawal</react_native_1.Text>
                        <react_native_1.Text className="text-gray-500 text-xs">
                            {new Date(item.created_at).toLocaleDateString()} at {new Date(item.created_at).toLocaleTimeString()}
                        </react_native_1.Text>
                    </react_native_1.View>
                    <react_native_1.View className="items-end">
                        <react_native_1.Text className="text-white font-JakartaBold text-base">- ₹{item.amount}</react_native_1.Text>
                        <react_native_1.Text className={`text-xs capitalize ${getStatusColor(item.status)}`}>{item.status}</react_native_1.Text>
                    </react_native_1.View>
                </react_native_1.View>))) : (<react_native_1.View className="bg-gray-800 rounded-2xl p-5 items-center py-8">
                <react_native_1.Text className="text-4xl mb-2">💸</react_native_1.Text>
                <react_native_1.Text className="text-gray-400 text-center">No withdrawal history yet.</react_native_1.Text>
            </react_native_1.View>)}
        
      </react_native_1.View>
    </react_native_1.ScrollView>);
}
