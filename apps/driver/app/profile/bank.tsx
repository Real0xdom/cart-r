import { View, Text, ScrollView, TouchableOpacity, Alert, TextInput, ActivityIndicator, FlatList } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
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
    if (!bankDetails.account_number || !bankDetails.ifsc_code || !bankDetails.account_holder_name) {
        Alert.alert('Error', 'Please fill all fields');
        return;
    }

    setIsLoading(true);
    const { error } = await supabase
        .from('drivers')
        .update({ bank_details: bankDetails })
        .eq('id', driverProfile?.id);

    setIsLoading(false);
    if (error) {
        Alert.alert('Error', error.message);
    } else {
        Alert.alert('Success', 'Bank details saved');
        setIsEditing(false);
    }
  };

  const handleWithdraw = async () => {
    const withdrawalAmount = parseFloat(amount);
    if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
        Alert.alert('Error', 'Please enter a valid amount');
        return;
    }
    
    if (withdrawalAmount > balance) {
        Alert.alert('Error', 'Insufficient balance');
        return;
    }

    // Check if bank details exist
    if (!bankDetails.account_number) {
        Alert.alert('Error', 'Please add bank details first');
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
        Alert.alert('Error', error.message);
    } else if (data && !data.success) {
        Alert.alert('Error', data.error || 'Failed to request withdrawal');
    } else {
        Alert.alert('Success', 'Withdrawal request submitted');
        setAmount('');
        fetchData(); // Refresh balance and history
    }
  };

  const getStatusColor = (status: string) => {
      switch(status) {
          case 'approved': return 'text-green-400';
          case 'paid': return 'text-green-500';
          case 'rejected': return 'text-red-400';
          default: return 'text-yellow-400';
      }
  };

  return (
    <ScrollView className="flex-1 bg-gray-900">
      <View className="p-5 pb-10">
        
        {/* Balance Card */}
        <View className="bg-gray-800 rounded-2xl p-6 mb-6 border border-gray-700">
          <Text className="text-gray-400 text-sm mb-1">Available for Withdrawal</Text>
          <Text className="text-white text-3xl font-JakartaBold">₹{balance.toLocaleString()}</Text>
          <View className="flex-row items-center mt-4">
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="Amount to withdraw"
                placeholderTextColor="#666"
                keyboardType="numeric"
                className="flex-1 bg-gray-900 p-3 rounded-l-xl text-white font-JakartaMedium border border-gray-600"
              />
              <TouchableOpacity
                onPress={handleWithdraw}
                disabled={isWithdrawing || balance <= 0}
                className={`p-3 rounded-r-xl w-24 items-center justify-center ${balance > 0 ? 'bg-green-600' : 'bg-gray-600'}`}
              >
                  {isWithdrawing ? (
                      <ActivityIndicator size="small" color="#fff" />
                  ) : (
                      <Text className="text-white font-JakartaBold">Withdraw</Text>
                  )}
              </TouchableOpacity>
          </View>
        </View>

        {/* Bank Account Section */}
        <View className="flex-row justify-between items-center mb-2">
            <Text className="text-gray-400 font-JakartaMedium">BANK DETAILS</Text>
            <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
                <Text className="text-blue-400 font-JakartaBold">{isEditing ? 'Cancel' : 'Edit'}</Text>
            </TouchableOpacity>
        </View>

        {isEditing ? (
            <View className="bg-gray-800 rounded-2xl p-5 mb-6 space-y-4">
                <View>
                    <Text className="text-gray-400 text-xs mb-1">Account Holder Name</Text>
                    <TextInput
                        value={bankDetails.account_holder_name}
                        onChangeText={(t) => setBankDetails({...bankDetails, account_holder_name: t})}
                        className="bg-gray-900 p-3 rounded-xl text-white border border-gray-700"
                        placeholder="e.g. John Doe"
                        placeholderTextColor="#555"
                    />
                </View>
                <View>
                    <Text className="text-gray-400 text-xs mb-1">Bank Name</Text>
                    <TextInput
                        value={bankDetails.bank_name}
                        onChangeText={(t) => setBankDetails({...bankDetails, bank_name: t})}
                        className="bg-gray-900 p-3 rounded-xl text-white border border-gray-700"
                        placeholder="e.g. HDFC Bank"
                        placeholderTextColor="#555"
                    />
                </View>
                <View>
                    <Text className="text-gray-400 text-xs mb-1">Account Number</Text>
                    <TextInput
                        value={bankDetails.account_number}
                        onChangeText={(t) => setBankDetails({...bankDetails, account_number: t})}
                        className="bg-gray-900 p-3 rounded-xl text-white border border-gray-700"
                        placeholder="e.g. 1234567890"
                        placeholderTextColor="#555"
                        keyboardType="numeric"
                    />
                </View>
                <View>
                    <Text className="text-gray-400 text-xs mb-1">IFSC Code</Text>
                    <TextInput
                        value={bankDetails.ifsc_code}
                        onChangeText={(t) => setBankDetails({...bankDetails, ifsc_code: t})}
                        className="bg-gray-900 p-3 rounded-xl text-white border border-gray-700"
                        placeholder="e.g. HDFC0001234"
                        placeholderTextColor="#555"
                        autoCapitalize="characters"
                    />
                </View>
                <TouchableOpacity 
                    onPress={saveBankDetails}
                    disabled={isLoading}
                    className="bg-blue-600 p-4 rounded-xl items-center mt-2"
                >
                    {isLoading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-JakartaBold">Save Details</Text>}
                </TouchableOpacity>
            </View>
        ) : (
            <View className="bg-gray-800 rounded-2xl p-5 mb-6">
                {bankDetails.account_number ? (
                    <>
                        <View className="flex-row items-center justify-between">
                            <View>
                                <Text className="text-white font-JakartaBold text-lg">{bankDetails.bank_name || 'Bank Account'}</Text>
                                <Text className="text-gray-400">{bankDetails.account_holder_name}</Text>
                                <Text className="text-gray-500 mt-1">
                                    {bankDetails.account_number?.replace(/.(?=.{4})/g, '*')}
                                </Text>
                            </View>
                            <View className="bg-green-500/20 px-2 py-1 rounded">
                                <Text className="text-green-400 text-xs">Primary</Text>
                            </View>
                        </View>
                    </>
                ) : (
                    <TouchableOpacity onPress={() => setIsEditing(true)} className="items-center py-4">
                        <Feather name="plus-circle" size={32} color="#60a5fa" />
                        <Text className="text-blue-400 mt-2 font-JakartaSemiBold">Add Bank Account</Text>
                    </TouchableOpacity>
                )}
            </View>
        )}

        {/* Withdrawal History */}
        <Text className="text-gray-400 mb-2 font-JakartaMedium">HISTORY</Text>
        {withdrawals.length > 0 ? (
            withdrawals.map((item) => (
                <View key={item.id} className="bg-gray-800 rounded-xl p-4 mb-3 flex-row justify-between items-center">
                    <View>
                        <Text className="text-white font-JakartaBold">Withdrawal</Text>
                        <Text className="text-gray-500 text-xs">
                            {new Date(item.created_at).toLocaleDateString()} at {new Date(item.created_at).toLocaleTimeString()}
                        </Text>
                    </View>
                    <View className="items-end">
                        <Text className="text-white font-JakartaBold text-base">- ₹{item.amount}</Text>
                        <Text className={`text-xs capitalize ${getStatusColor(item.status)}`}>{item.status}</Text>
                    </View>
                </View>
            ))
        ) : (
            <View className="bg-gray-800 rounded-2xl p-5 items-center py-8">
                <Text className="text-4xl mb-2">💸</Text>
                <Text className="text-gray-400 text-center">No withdrawal history yet.</Text>
            </View>
        )}
        
      </View>
    </ScrollView>
  );
}
