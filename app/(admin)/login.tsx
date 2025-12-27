import { View, Text, ScrollView, Image, Alert } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import InputField from '@/components/InputField';
import CustomButton from '@/components/CustomButton';
import { icons, images } from '@/constants';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';

const AdminLogin = () => {
    const { signIn } = useAuth();
    const [form, setForm] = useState({
        email: '',
        password: '',
    });
    const [loading, setLoading] = useState(false);

    const onSignInPress = async () => {
        setLoading(true);
        try {
            const { error } = await signIn(form.email, form.password);
            if (error) {
                Alert.alert('Error', error.message);
            } else {
                // Router redirect handled by _layout.tsx based on rule
                // But we can force check
                // router.replace('/(admin)/dashboard');
            }
        } catch (err: any) {
            Alert.alert('Error', err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
                <View className="flex-1 p-5 justify-center">
                    <View className="items-center mb-10">
                        <Text className="text-3xl font-JakartaBold">Admin Portal</Text>
                        <Text className="text-gray-400 mt-2">Authorized Personnel Only</Text>
                    </View>

                    <InputField
                        label="Email"
                        placeholder="admin@example.com"
                        icon={icons.email}
                        value={form.email}
                        onChangeText={(value) => setForm({ ...form, email: value })}
                    />

                    <InputField
                        label="Password"
                        placeholder="Enter password"
                        icon={icons.lock}
                        secureTextEntry={true}
                        value={form.password}
                        onChangeText={(value) => setForm({ ...form, password: value })}
                    />

                    <CustomButton
                        title={loading ? "Logging in..." : "Login"}
                        onPress={onSignInPress}
                        className="mt-6"
                        disabled={loading}
                    />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

export default AdminLogin;
