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
exports.AuthProvider = AuthProvider;
exports.useAuth = useAuth;
const react_1 = __importStar(require("react"));
const expo_router_1 = require("expo-router");
const supabase_1 = require("@/lib/supabase");
const AuthContext = (0, react_1.createContext)(undefined);
function AuthProvider({ children }) {
    const [user, setUser] = (0, react_1.useState)(null);
    const [session, setSession] = (0, react_1.useState)(null);
    const [profile, setProfile] = (0, react_1.useState)(null);
    const [driverProfile, setDriverProfile] = (0, react_1.useState)(null);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    // Fetch or create user profile from database
    const fetchProfile = async (authUser) => {
        var _a;
        try {
            // Try to fetch existing profile
            const { data, error } = await supabase_1.supabase
                .from('users')
                .select('*')
                .eq('id', authUser.id)
                .maybeSingle(); // Use maybeSingle instead of single to avoid error when no rows
            if (error && error.code !== 'PGRST116') {
                console.error('Error fetching profile:', error);
                return;
            }
            // If profile doesn't exist, create one
            if (!data) {
                console.log('Creating new profile for user:', authUser.id);
                const phone = authUser.phone || null;
                const email = authUser.email || (phone ? `${phone.replace('+', '')}@phone.carter.app` : 'unknown@carter.app');
                const name = ((_a = authUser.user_metadata) === null || _a === void 0 ? void 0 : _a.name) || 'Carter User';
                const { data: newProfile, error: insertError } = await supabase_1.supabase
                    .from('users')
                    .insert({
                    id: authUser.id,
                    email,
                    name,
                    phone,
                    role: 'customer', // Default role for customer app
                })
                    .select()
                    .single();
                if (insertError) {
                    // If duplicate key error, profile was created by another call - fetch it
                    if (insertError.code === '23505') {
                        const { data: existingProfile } = await supabase_1.supabase
                            .from('users')
                            .select('*')
                            .eq('id', authUser.id)
                            .single();
                        if (existingProfile) {
                            setProfile(existingProfile);
                        }
                        return;
                    }
                    console.error('Error creating profile:', insertError);
                    return;
                }
                setProfile(newProfile);
                return;
            }
            setProfile(data);
            // If user is a driver, fetch driver profile
            if ((data === null || data === void 0 ? void 0 : data.role) === 'driver') {
                const { data: driverData, error: driverError } = await supabase_1.supabase
                    .from('drivers')
                    .select('*')
                    .eq('user_id', authUser.id)
                    .maybeSingle();
                if (!driverError && driverData) {
                    setDriverProfile(driverData);
                }
            }
        }
        catch (error) {
            console.error('Error in fetchProfile:', error);
        }
    };
    // Initialize auth state
    (0, react_1.useEffect)(() => {
        // Get initial session
        supabase_1.supabase.auth.getSession().then(({ data: { session } }) => {
            var _a;
            setSession(session);
            setUser((_a = session === null || session === void 0 ? void 0 : session.user) !== null && _a !== void 0 ? _a : null);
            if (session === null || session === void 0 ? void 0 : session.user) {
                fetchProfile(session.user);
            }
            setIsLoading(false);
        });
        // Listen for auth changes
        const { data: { subscription } } = supabase_1.supabase.auth.onAuthStateChange(async (event, session) => {
            var _a;
            setSession(session);
            setUser((_a = session === null || session === void 0 ? void 0 : session.user) !== null && _a !== void 0 ? _a : null);
            if (session === null || session === void 0 ? void 0 : session.user) {
                await fetchProfile(session.user);
            }
            else {
                setProfile(null);
                setDriverProfile(null);
            }
            // Handle navigation based on auth state
            if (event === 'SIGNED_IN') {
                // Will navigate based on role in the calling component
            }
            else if (event === 'SIGNED_OUT') {
                expo_router_1.router.replace('/');
            }
        });
        return () => subscription.unsubscribe();
    }, []);
    // Sign up with email/password
    const signUp = async (email, password, name, phone) => {
        try {
            const { data, error } = await supabase_1.supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { name, phone },
                },
            });
            if (error)
                throw error;
            // Create user profile in database
            if (data.user) {
                const { error: profileError } = await supabase_1.supabase.from('users').insert({
                    id: data.user.id,
                    email,
                    name,
                    phone: phone || null,
                    role: 'customer', // Default role
                });
                if (profileError)
                    throw profileError;
            }
            return { error: null };
        }
        catch (error) {
            return { error: error };
        }
    };
    // Sign in with email/password
    const signIn = async (email, password) => {
        try {
            const { error } = await supabase_1.supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error)
                throw error;
            return { error: null };
        }
        catch (error) {
            return { error: error };
        }
    };
    // Sign in with phone (OTP)
    const signInWithPhone = async (phone) => {
        try {
            const { error } = await supabase_1.supabase.auth.signInWithOtp({
                phone,
            });
            if (error)
                throw error;
            return { error: null };
        }
        catch (error) {
            return { error: error };
        }
    };
    // Verify OTP
    const verifyOtp = async (phone, token) => {
        try {
            const { error } = await supabase_1.supabase.auth.verifyOtp({
                phone,
                token,
                type: 'sms',
            });
            if (error)
                throw error;
            return { error: null };
        }
        catch (error) {
            return { error: error };
        }
    };
    // Sign in with WhatsApp/Phone (alias for signInWithPhone)
    const signInWithWhatsApp = async (phone) => {
        return signInWithPhone(phone);
    };
    // Verify WhatsApp/Phone OTP with role-based navigation
    const verifyWhatsAppOtp = async (phone, token, targetRole) => {
        try {
            const { data, error } = await supabase_1.supabase.auth.verifyOtp({
                phone,
                token,
                type: 'sms',
            });
            if (error)
                throw error;
            // Check if user profile exists
            if (data.user) {
                const { data: existingProfile } = await supabase_1.supabase
                    .from('users')
                    .select('*')
                    .eq('id', data.user.id)
                    .single();
                // Create profile if it doesn't exist
                if (!existingProfile) {
                    await supabase_1.supabase.from('users').insert({
                        id: data.user.id,
                        email: data.user.email || `${phone}@phone.carter.app`,
                        name: 'Carter User',
                        phone,
                        role: targetRole,
                    });
                }
                // Navigate based on role
                if (targetRole === 'driver') {
                    expo_router_1.router.replace('/(driver)/(tabs)/home');
                }
                else {
                    expo_router_1.router.replace('/(customer)/(tabs)/home');
                }
            }
            return { error: null };
        }
        catch (error) {
            return { error: error };
        }
    };
    // Sign out
    const signOut = async () => {
        await supabase_1.supabase.auth.signOut();
        setProfile(null);
        setDriverProfile(null);
    };
    // Refresh profile
    const refreshProfile = async () => {
        if (user) {
            await fetchProfile(user.id);
        }
    };
    // Toggle driver online status
    const toggleDriverOnline = async (isOnline) => {
        if (!driverProfile)
            return;
        try {
            const { error } = await supabase_1.supabase
                .from('drivers')
                .update({ is_online: isOnline })
                .eq('id', driverProfile.id);
            if (error)
                throw error;
            setDriverProfile({ ...driverProfile, is_online: isOnline });
        }
        catch (error) {
            console.error('Error toggling online status:', error);
        }
    };
    // Update driver location
    const updateDriverLocation = async (latitude, longitude) => {
        if (!driverProfile)
            return;
        try {
            const { error } = await supabase_1.supabase
                .from('drivers')
                .update({
                current_latitude: latitude,
                current_longitude: longitude,
                last_location_update: new Date().toISOString(),
            })
                .eq('id', driverProfile.id);
            if (error)
                throw error;
            // Also log to driver_locations table for history
            await supabase_1.supabase.from('driver_locations').insert({
                driver_id: driverProfile.id,
                latitude,
                longitude,
            });
        }
        catch (error) {
            console.error('Error updating location:', error);
        }
    };
    const value = {
        user,
        session,
        profile,
        driverProfile,
        isLoading,
        signUp,
        signIn,
        signInWithPhone,
        signInWithWhatsApp,
        verifyOtp,
        verifyWhatsAppOtp,
        signOut,
        refreshProfile,
        toggleDriverOnline,
        updateDriverLocation,
    };
    return (<AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>);
}
function useAuth() {
    const context = (0, react_1.useContext)(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
exports.default = AuthContext;
