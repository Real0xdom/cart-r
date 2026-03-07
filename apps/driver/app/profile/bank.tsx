import { View, Text, ScrollView, TouchableOpacity, Alert, TextInput, ActivityIndicator, FlatList } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';

interface Withdrawal {
  id: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  created_at: string;
  notes?: string;
}

export default function BankDetails() {
  const { driverProfile, user } = useAuth();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [balance, setBalance] = useState(0);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  
  // Bank Details State
  const [isEditing, setIsEditing] = useState(false);
  const [bankDetails, setBankDetails] = useState({
    account_holder_name: '',
    account_number: '',
    ifsc_code: '',
    bank_name: ''
  });

  // Withdrawal State
  const [amount, setAmount] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  useEffect(() => {
    fetchData();
  }, [driverProfile?.id]);

  const fetchData = async () => {
    if (!driverProfile?.id) return;
    
    // 1. Fetch Bank Details
    const details = driverProfile.bank_details as any;
    if (details) {
      setBankDetails(details);
    } else {
      setIsEditing(true); // Auto-edit if no details
    }

    // 2. Fetch Balance
    const { data: balanceData } = await supabase.rpc('get_driver_balance', { 
        p_driver_id: driverProfile.id 
    });
    setBalance(balanceData || 0);

    // 3. Fetch History
    const { data: historyData } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('driver_id', driverProfile.id)
        .order('created_at', { ascending: false });
        
    if (historyData) {
        setWithdrawals(historyData);
    }
  };

  const saveBankDetails = async () => {
    // Validate required fields
    if (!bankDetails.account_number || !bankDetails.ifsc_code || !bankDetails.account_holder_name) {
        Alert.alert(t('error'), t('pleaseFillAllFields'));
        return;
    }

    // Validate IFSC format (11 characters: 4 letters + 0 + 6 alphanumeric)
    const ifscPattern = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscPattern.test(bankDetails.ifsc_code.toUpperCase())) {
        Alert.alert(
            t('error'), 
            'Invalid IFSC code format. IFSC should be 11 characters (e.g., HDFC0001234).\n\nFormat: 4 letters + 0 + 6 characters'
        );
        return;
    }

    // Validate account number (typically 9-18 digits)
    if (bankDetails.account_number.length < 9 || bankDetails.account_number.length > 18) {
        Alert.alert(
            t('error'), 
            'Account number should be between 9 and 18 digits'
        );
        return;
    }

    setIsLoading(true);
    const { error } = await supabase
        .from('drivers')
        .update({ bank_details: bankDetails })
        .eq('id', driverProfile?.id);

    if (error) {
        setIsLoading(false);
        Alert.alert(t('error'), error.message);
        return;
    }

    // Call Cashfree Beneficiary Edge Function
    try {
        const { data, error: funcError } = await supabase.functions.invoke('create-beneficiary', {
            body: { driver_id: driverProfile?.id }
        });

        console.log('Edge function response:', data); // Log full response

        if (funcError) throw funcError;
        
        if (data && (data.error || !data.success)) {
            // Use the human-readable `message` the edge function now returns
            const errorMessage = data.message || data.error || 'Failed to register bank for payouts';
            
            // Show Cashfree response for debugging
            console.error('Cashfree error:', data.cashfree_response);
            
            // Provide user-friendly error messages based on Cashfree error codes
            let userMessage = errorMessage;
            if (data.cashfree_response?.code === 'bank_ifsc_invalid') {
                userMessage = 'The IFSC code you entered is not recognized by the bank. Please verify your IFSC code and try again.\n\nYou can find your IFSC code on your bank passbook or cheque.';
            } else if (data.cashfree_response?.code === 'bank_account_invalid') {
                userMessage = 'The account number appears to be invalid. Please check and try again.';
            } else if (data.cashfree_response?.code === 'beneficiary_already_exists') {
                userMessage = 'This bank account is already registered.';
            }
            
            Alert.alert(t('error') || 'Error', userMessage);
        } else {
            // Show success with Cashfree response
            console.log('Cashfree success:', data.cashfree_response);
            Alert.alert(t('success'), t('bankDetailsSaved'));
            setIsEditing(false);
            fetchData(); // Refresh UI
        }
    } catch (err: any) {
        console.error('Error creating beneficiary:', err);
        // Sometimes the edge function throws an error with a context object
        const errorMessage = err?.context?.message || err.message || 'Failed to register bank for payouts';
        Alert.alert(t('error') || 'Error', errorMessage);
    } finally {
        setIsLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const withdrawalAmount = parseFloat(amount);
    if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
        Alert.alert(t('error'), t('pleaseEnterValidAmount'));
        return;
    }
    
    if (withdrawalAmount > balance) {
        Alert.alert(t('error'), t('insufficientBalance'));
        return;
    }

    // Check if bank details exist
    if (!bankDetails.account_number) {
        Alert.alert(t('error'), t('pleaseAddBankDetailsFirst'));
        return;
    }

    // Generate Idempotency Key
    const idempotencyKey = Crypto.randomUUID();

    setIsWithdrawing(true);
    const { data, error } = await supabase.rpc('request_withdrawal', {
        p_driver_id: driverProfile?.id,
        p_amount: withdrawalAmount,
        p_idempotency_key: idempotencyKey
    });

    setIsWithdrawing(false);

    if (error) {
        Alert.alert(t('error'), error.message);
    } else if (data && !data.success) {
        Alert.alert(t('error'), data.error || t('failedToRequestWithdrawal'));
    } else {
        Alert.alert(t('success'), t('withdrawalRequestSubmitted'));
        setAmount('');
        fetchData(); // Refresh balance and history
    }
  };

  const getPayoutStatusColor = (status: string | null) => {
      if (!status) return 'text-yellow-400';
      switch(status) {
          case 'SUCCESS': return 'text-green-500';
          case 'RECEIVED': return 'text-blue-400';
          case 'PENDING': return 'text-yellow-400';
          case 'FAILED': return 'text-red-400';
          case 'REVERSED': return 'text-orange-400';
          default: return 'text-yellow-400';
      }
  };

  const getPayoutStatusLabel = (item: any) => {
      // Use payout_status as source of truth, fallback to local status
      if (item.payout_status) return item.payout_status;
      return item.status;
  };

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="p-5 pb-10">
        
        {/* Balance Card */}
        <View className="bg-gray-100 rounded-2xl p-6 mb-6 border border-gray-700">
          <Text className="text-gray-400 text-sm mb-1">{t('availableForWithdrawal')}</Text>
          <Text className="text-gray-900 text-3xl font-JakartaBold">₹{balance.toLocaleString()}</Text>
          <View className="flex-row items-center mt-4">
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder={t('amountToWithdraw')}
                placeholderTextColor="#666"
                keyboardType="numeric"
                className="flex-1 bg-gray-50 p-3 rounded-l-xl text-gray-900 font-JakartaMedium border border-gray-200"
              />
              <TouchableOpacity
                onPress={handleWithdraw}
                disabled={isWithdrawing || balance <= 0 || !amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0 || parseFloat(amount) > balance}
                className={`p-3 rounded-r-xl w-24 items-center justify-center ${(balance > 0 && amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 && parseFloat(amount) <= balance) ? 'bg-green-600' : 'bg-gray-400'}`}
              >
                  {isWithdrawing ? (
                      <ActivityIndicator size="small" color="#fff" />
                  ) : (
                      <Text className="text-gray-900 font-JakartaBold">{t('withdraw')}</Text>
                  )}
              </TouchableOpacity>
          </View>
          {amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > balance && (
              <Text className="text-red-500 text-xs mt-2">{t('insufficientBalance')}</Text>
          )}
        </View>

        {/* Sandbox Testing Helper */}
        {__DEV__ && (
          <View className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
            <Text className="text-xs font-JakartaBold text-amber-800 mb-1">🧪 SANDBOX MODE — Test Bank Details</Text>
            <Text className="text-[10px] text-amber-700">Name: <Text className="font-JakartaBold">John Doe</Text></Text>
            <Text className="text-[10px] text-amber-700">Account: <Text className="font-JakartaBold">026291800001191</Text></Text>
            <Text className="text-[10px] text-amber-700">IFSC: <Text className="font-JakartaBold">YESB0000262</Text></Text>
            <Text className="text-[10px] text-amber-700 mt-1">Withdrawals will be simulated, no real transfer occurs</Text>
          </View>
        )}

        {/* Bank Account Section */}
        <View className="flex-row justify-between items-center mb-2">
            <Text className="text-gray-400 font-JakartaMedium">{t('bankDetails')}</Text>
            <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
                <Text className="text-blue-400 font-JakartaBold">{isEditing ? t('cancel') : t('edit')}</Text>
            </TouchableOpacity>
        </View>

        {isEditing ? (
            <View className="bg-gray-100 rounded-2xl p-5 mb-6 space-y-4">
                <View>
                    <Text className="text-gray-400 text-xs mb-1">{t('accountHolderName')}</Text>
                    <TextInput
                        value={bankDetails.account_holder_name}
                        onChangeText={(val) => setBankDetails({...bankDetails, account_holder_name: val})}
                        className="bg-gray-50 p-3 rounded-xl text-gray-900 border border-gray-200"
                        placeholder="e.g. John Doe"
                        placeholderTextColor="#999"
                    />
                </View>
                <View>
                    <Text className="text-gray-400 text-xs mb-1">{t('bankName')}</Text>
                    <TextInput
                        value={bankDetails.bank_name}
                        onChangeText={(val) => setBankDetails({...bankDetails, bank_name: val})}
                        className="bg-gray-50 p-3 rounded-xl text-gray-900 border border-gray-200"
                        placeholder="e.g. HDFC Bank"
                        placeholderTextColor="#999"
                    />
                </View>
                <View>
                    <Text className="text-gray-400 text-xs mb-1">{t('accountNumber')}</Text>
                    <TextInput
                        value={bankDetails.account_number}
                        onChangeText={(val) => setBankDetails({...bankDetails, account_number: val})}
                        className="bg-gray-50 p-3 rounded-xl text-gray-900 border border-gray-200"
                        placeholder="e.g. 1234567890"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                        maxLength={18}
                    />
                    <Text className="text-gray-400 text-xs mt-1">
                        9-18 digits
                    </Text>
                </View>
                <View>
                    <Text className="text-gray-400 text-xs mb-1">{t('ifscCode')}</Text>
                    <TextInput
                        value={bankDetails.ifsc_code}
                        onChangeText={(val) => setBankDetails({...bankDetails, ifsc_code: val.toUpperCase()})}
                        className="bg-gray-50 p-3 rounded-xl text-gray-900 border border-gray-200"
                        placeholder="e.g. HDFC0001234"
                        placeholderTextColor="#999"
                        autoCapitalize="characters"
                        maxLength={11}
                    />
                    <Text className="text-gray-400 text-xs mt-1">
                        11 characters: 4 letters + 0 + 6 alphanumeric
                    </Text>
                </View>
                <TouchableOpacity 
                    onPress={saveBankDetails}
                    disabled={isLoading}
                    className="bg-blue-600 p-4 rounded-xl items-center mt-2"
                >
                    {isLoading ? <ActivityIndicator color="#fff" /> : <Text className="text-gray-900 font-JakartaBold">{t('saveDetails')}</Text>}
                </TouchableOpacity>
            </View>
        ) : (
            <View className="bg-gray-100 rounded-2xl p-5 mb-6">
                {bankDetails.account_number ? (
                    <>
                        <View className="flex-row items-center justify-between">
                            <View>
                                <Text className="text-gray-900 font-JakartaBold text-lg">{bankDetails.bank_name || t('bankAccount')}</Text>
                                <Text className="text-gray-400">{bankDetails.account_holder_name}</Text>
                                <Text className="text-gray-500 mt-1">
                                    {bankDetails.account_number?.replace(/.(?=.{4})/g, '*')}
                                </Text>
                            </View>
                            <View className="bg-green-500/20 px-2 py-1 rounded">
                                <Text className="text-green-400 text-xs">{t('primary')}</Text>
                            </View>
                        </View>
                    </>
                ) : (
                    <TouchableOpacity onPress={() => setIsEditing(true)} className="items-center py-4">
                        <Feather name="plus-circle" size={32} color="#60a5fa" />
                        <Text className="text-blue-400 mt-2 font-JakartaSemiBold">{t('addBankAccount')}</Text>
                    </TouchableOpacity>
                )}
            </View>
        )}

        {/* Withdrawal History */}
        <Text className="text-gray-400 mb-2 font-JakartaMedium">{t('history')}</Text>
        {withdrawals.length > 0 ? (
            withdrawals.map((item) => (
                <View key={item.id} className="bg-gray-100 rounded-xl p-4 mb-3 flex-row justify-between items-center">
                    <View>
                        <Text className="text-gray-900 font-JakartaBold">{t('withdrawal')}</Text>
                        <Text className="text-gray-500 text-xs">
                            {new Date(item.created_at).toLocaleDateString()} at {new Date(item.created_at).toLocaleTimeString()}
                        </Text>
                    </View>
                    <View className="items-end">
                        <Text className="text-gray-900 font-JakartaBold text-base">- ₹{item.amount}</Text>
                        <Text className={`text-xs capitalize ${getPayoutStatusColor(item.payout_status || item.status)}`}>{getPayoutStatusLabel(item)}</Text>
                    </View>
                </View>
            ))
        ) : (
            <View className="bg-gray-100 rounded-2xl p-5 items-center py-8">
                <Text className="text-4xl mb-2">💸</Text>
                <Text className="text-gray-400 text-center">{t('noWithdrawalHistory')}</Text>
            </View>
        )}
        
      </View>
    </ScrollView>
  );
}
