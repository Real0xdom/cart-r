'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import { Bell, Search, User, Send, Users, Truck, History, TrendingUp, CheckCircle, XCircle, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface UserProfile {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    role: string;
    expo_push_token?: string;
    has_customer_access?: boolean;
    has_driver_access?: boolean;
    customer_push_active?: boolean;
    driver_push_active?: boolean;
    driver_verification_status?: string | null;
}

interface NotificationHistory {
    id: string;
    user_id: string;
    title: string;
    body: string;
    is_read: boolean;
    created_at: string;
    users?: {
        name: string;
        role: string;
    };
}

interface NotificationStats {
    total_sent: number;
    sent_today: number;
    read_rate: number;
}

interface AudienceCounts {
    all_customers: number;
    all_drivers: number;
    all_users: number;
}

type AudienceType = 'single' | 'all_customers' | 'all_drivers' | 'all_users';
type SingleUserTargetApp = 'customer' | 'driver' | 'both';

export default function NotificationsPage() {
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'send' | 'history'>('send');

    // Audience Selection
    const [audience, setAudience] = useState<AudienceType>('single');

    // Single User Search
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [singleUserTargetApp, setSingleUserTargetApp] = useState<SingleUserTargetApp>('both');

    // Message Content
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);

    // History & Stats
    const [history, setHistory] = useState<NotificationHistory[]>([]);
    const [stats, setStats] = useState<NotificationStats>({ total_sent: 0, sent_today: 0, read_rate: 0 });
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [audienceCounts, setAudienceCounts] = useState<AudienceCounts>({ all_customers: 0, all_drivers: 0, all_users: 0 });

    // Load stats, history, and audience counts
    useEffect(() => {
        loadStats();
        loadAudienceCountsFromServer();
        if (activeTab === 'history') {
            loadHistory();
        }
    }, [activeTab]);

    const loadAudienceCountsFromServer = async () => {
        try {
            console.log('Loading audience counts from Server Action...');
            // Dynamically import to ensure it's treated as a server action call from client
            const { getAudienceCounts } = await import('@/app/actions/notifications');
            const counts = await getAudienceCounts();
            
            if (counts.error) {
                toast.error('Failed to load audience: ' + counts.error);
            } else {
                setAudienceCounts({
                    all_customers: counts.all_customers,
                    all_drivers: counts.all_drivers,
                    all_users: counts.all_users
                });
            }
        } catch (error) {
            console.error('Error calling server action:', error);
        }
    };

    const loadStats = async () => {
        try {
            const { getNotificationStats } = await import('@/app/actions/notifications');
            const stats = await getNotificationStats();
            
            if (stats.error) {
                console.error('Error loading stats:', stats.error);
                return;
            }

            setStats({
                total_sent: stats.total_sent,
                sent_today: stats.sent_today,
                read_rate: stats.read_rate
            });
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    };

    const loadHistory = async () => {
        setLoadingHistory(true);
        try {
            const { getNotificationHistory } = await import('@/app/actions/notifications');
            const { data, error } = await getNotificationHistory();

            if (error) throw new Error(error);
            setHistory(data || []);
        } catch (error) {
            console.error('Error loading history:', error);
            toast.error('Failed to load notification history');
        } finally {
            setLoadingHistory(false);
        }
    };

    // Search users
    useEffect(() => {
        const searchUsers = async () => {
            if (searchQuery.length < 2) {
                setSearchResults([]);
                return;
            }

            setLoading(true);
            try {
                const { searchUsers: serverSearch } = await import('@/app/actions/notifications');
                const results = await serverSearch(searchQuery);
                setSearchResults(results as UserProfile[]);
            } catch (error) {
                console.error('Error searching users:', error);
            } finally {
                setLoading(false);
            }
        };

        const timer = setTimeout(searchUsers, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const [logs, setLogs] = useState<string[]>([]);

    const getAvailableTargets = (user: UserProfile | null): SingleUserTargetApp[] => {
        if (!user) {
            return ['both'];
        }

        const targets: SingleUserTargetApp[] = [];
        if (user.has_customer_access) {
            targets.push('customer');
        }
        if (user.has_driver_access) {
            targets.push('driver');
        }
        if (targets.length > 1) {
            targets.unshift('both');
        }

        return targets.length > 0 ? targets : ['both'];
    };

    const getDefaultTargetForUser = (user: UserProfile): SingleUserTargetApp => {
        const targets = getAvailableTargets(user);
        return targets.includes('both') ? 'both' : targets[0];
    };

    const renderAccessBadges = (user: UserProfile, compact = false) => {
        const baseClass = compact ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';
        const badges = [];

        if (user.has_customer_access) {
            badges.push(
                <span key="customer" className={`${baseClass} rounded-full bg-blue-100 text-blue-700 font-bold uppercase tracking-wider`}>
                    Customer
                </span>
            );
        }

        if (user.has_driver_access) {
            badges.push(
                <span key="driver" className={`${baseClass} rounded-full bg-emerald-100 text-emerald-700 font-bold uppercase tracking-wider`}>
                    Driver
                </span>
            );
        }

        if (user.customer_push_active) {
            badges.push(
                <span key="customer-push" className={`${baseClass} rounded-full bg-sky-50 text-sky-700 font-semibold`}>
                    Customer Push
                </span>
            );
        }

        if (user.driver_push_active) {
            badges.push(
                <span key="driver-push" className={`${baseClass} rounded-full bg-orange-50 text-orange-700 font-semibold`}>
                    Driver Push
                </span>
            );
        }

        return badges;
    };

    const addLog = (msg: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs(prev => [`[${timestamp}] ${msg}`, ...prev]);
        console.log(`[AdminNotif] ${msg}`);
    };

    const handleSend = async () => {
        if ((audience === 'single' && !selectedUser) || !title.trim() || !body.trim()) {
            toast.error('Please fill in all fields');
            return;
        }

        setSending(true);
        setLogs([]);
        addLog('Starting notification process (Server Action)...');

        try {
            // Dynamically import Server Action
            const { sendNotificationToAudience } = await import('@/app/actions/notifications');
            
            const result = await sendNotificationToAudience(
                audience,
                title,
                body,
                selectedUser?.id,
                singleUserTargetApp
            );

            if (!result.success) {
                throw new Error(result.error);
            }

            addLog(`Found ${result.count} target users. Sent push to ${result.sent_count || 0} with valid tokens.`);
            addLog(`📊 Push results: ${result.push_ok || 'N/A'} delivered, ${result.push_errors || 0} errors.`);
            if (Array.isArray((result as any).push_error_details)) {
                for (const detail of (result as any).push_error_details) {
                    addLog(`Push error: ${detail.error || 'UNKNOWN'} - ${detail.message} (${detail.token_preview})`);
                }
            }
            if (result.sent_count === 0) {
              addLog(`⚠️ WARNING: No push tokens found! Users may need to re-login in the app.`);
            }
            toast.success(`Pushed to ${result.push_ok || result.sent_count || result.count} users!`);

            // Reset form
            setTitle('');
            setBody('');
            if (audience === 'single') {
                setSelectedUser(null);
                setSearchQuery('');
                setSingleUserTargetApp('both');
            }

            loadStats();
        } catch (error: any) {
            console.error('Notification error:', error);
            addLog(`CRITICAL ERROR: ${error.message}`);
            toast.error('Failed to send: ' + error.message);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#FDFBF7] font-sans text-slate-800">
            <Sidebar />
            <div className="ml-72 p-8 max-w-[1600px] mx-auto transition-all duration-300">

                <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">Notification Center</h1>
                        <p className="text-slate-500 text-lg">Manage and broadcast push notifications to your users.</p>
                    </div>

                    {/* Tab Switcher */}
                    <div className="flex bg-white rounded-full p-1.5 shadow-sm border border-slate-200">
                        <button
                            onClick={() => setActiveTab('send')}
                            className={`px-8 py-3 rounded-full font-bold text-sm transition-all duration-300 ${
                                activeTab === 'send'
                                    ? 'bg-black text-white shadow-lg transform scale-105'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                        >
                            <Send className="inline mr-2.5 mb-0.5" size={18} />
                            Compose
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-8 py-3 rounded-full font-bold text-sm transition-all duration-300 ${
                                activeTab === 'history'
                                    ? 'bg-black text-white shadow-lg transform scale-105'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                        >
                            <History className="inline mr-2.5 mb-0.5" size={18} />
                            History
                        </button>
                    </div>
                </header>

                {/* Stats Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    <div className="bg-white p-6 rounded-3xl shadow-[0_2px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 flex items-center justify-between hover:shadow-lg transition-shadow duration-300">
                        <div>
                            <p className="text-slate-400 font-semibold text-xs uppercase tracking-wider mb-1">Total Sent</p>
                            <p className="text-3xl font-black text-slate-900">{stats.total_sent.toLocaleString()}</p>
                        </div>
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                            <Bell size={24} strokeWidth={2.5} />
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-3xl shadow-[0_2px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 flex items-center justify-between hover:shadow-lg transition-shadow duration-300">
                        <div>
                            <p className="text-slate-400 font-semibold text-xs uppercase tracking-wider mb-1">Sent Today</p>
                            <p className="text-3xl font-black text-slate-900">{stats.sent_today.toLocaleString()}</p>
                        </div>
                        <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center">
                            <TrendingUp size={24} strokeWidth={2.5} />
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-3xl shadow-[0_2px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 flex items-center justify-between hover:shadow-lg transition-shadow duration-300">
                        <div>
                            <p className="text-slate-400 font-semibold text-xs uppercase tracking-wider mb-1">Read Rate</p>
                            <p className="text-3xl font-black text-slate-900">{stats.read_rate}%</p>
                        </div>
                        <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
                            <CheckCircle size={24} strokeWidth={2.5} />
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="relative">
                    {/* SEND TAB */}
                    {activeTab === 'send' && (
                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                            
                            {/* Left Column: Form (7/12) */}
                            <div className="xl:col-span-7 space-y-8">
                                <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                                    <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-3">
                                        <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm">1</span>
                                        Select Audience
                                    </h2>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        {[
                                            { id: 'single', label: 'Specific User', icon: User, count: null },
                                            { id: 'all_customers', label: 'All Customers', icon: Users, count: audienceCounts.all_customers },
                                            { id: 'all_drivers', label: 'All Drivers', icon: Truck, count: audienceCounts.all_drivers },
                                            { id: 'all_users', label: 'Everyone', icon: Bell, count: audienceCounts.all_users },
                                        ].map((type) => {
                                            const Icon = type.icon;
                                            const isSelected = audience === type.id;
                                            const count = type.count;
                                            const isDisabled = count === 0;

                                            return (
                                                <button
                                                    key={type.id}
                                                    onClick={() => !isDisabled && setAudience(type.id as AudienceType)}
                                                    disabled={isDisabled}
                                                    className={`relative p-5 rounded-2xl border-2 text-left transition-all duration-200 group flex flex-col gap-3 ${
                                                        isSelected
                                                            ? 'bg-slate-900 border-slate-900 text-white shadow-xl'
                                                            : isDisabled 
                                                                ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                                                                : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between w-full">
                                                        <Icon size={24} className={isSelected ? 'text-white' : (isDisabled ? 'text-slate-300' : 'text-slate-900')} strokeWidth={2} />
                                                        {isSelected && <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]"></div>}
                                                    </div>
                                                    <div>
                                                        <span className="block font-bold text-sm tracking-wide">{type.label}</span>
                                                        {count !== null && (
                                                            <span className={`text-xs font-semibold ${isSelected ? 'text-slate-400' : 'text-slate-400'}`}>
                                                                {count} users
                                                            </span>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* User Search (Only if Single) */}
                                    {audience === 'single' && (
                                        <div className="mt-6 animate-in fade-in slide-in-from-top-4 duration-300">
                                            {!selectedUser ? (
                                                <div className="relative group">
                                                    <input
                                                        type="text"
                                                        placeholder="Search user by name..."
                                                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:bg-white focus:border-slate-900 transition-all font-medium text-slate-900 placeholder:text-slate-400"
                                                        value={searchQuery}
                                                        onChange={(e) => setSearchQuery(e.target.value)}
                                                    />
                                                    <Search className="absolute left-4 top-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" size={22} />
                                                    
                                                    {/* Results Dropdown */}
                                                    {searchResults.length > 0 && searchQuery.length >= 2 && (
                                                        <div className="absolute z-20 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden ring-1 ring-black/5">
                                                            {searchResults.map(user => (
                                                                <button
                                                                    key={user.id}
                                                                    onClick={() => {
                                                                        setSelectedUser(user);
                                                                        setSingleUserTargetApp(getDefaultTargetForUser(user));
                                                                        setSearchResults([]);
                                                                        setSearchQuery('');
                                                                    }}
                                                                    className="w-full p-4 hover:bg-slate-50 text-left flex items-center gap-4 border-b border-slate-50 last:border-0 transition-colors"
                                                                >
                                                                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold text-sm">
                                                                        {user.name.charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-bold text-slate-900">{user.name}</span>
                                                                        </div>
                                                                        <div className="mt-1 flex flex-wrap gap-1.5">
                                                                            {renderAccessBadges(user, true)}
                                                                        </div>
                                                                        <div className="text-xs text-slate-500 font-medium mt-1">{user.phone || user.email}</div>
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {loading && (
                                                        <div className="absolute right-4 top-4">
                                                            <div className="animate-spin w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full" />
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between p-4 bg-slate-900 text-white rounded-2xl shadow-lg">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-white backdrop-blur-sm">
                                                            <User size={24} />
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-lg">{selectedUser.name}</div>
                                                            <div className="mt-1 flex flex-wrap gap-2">
                                                                {renderAccessBadges(selectedUser)}
                                                            </div>
                                                            <div className="text-sm text-slate-400 mt-2">{selectedUser.phone || selectedUser.email}</div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            setSelectedUser(null);
                                                            setSingleUserTargetApp('both');
                                                        }}
                                                        className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold transition-colors"
                                                    >
                                                        Change
                                                    </button>
                                                </div>
                                            )}

                                            {selectedUser && (
                                                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-3">
                                                        Send To
                                                    </div>
                                                    <div className="flex flex-wrap gap-3">
                                                        {getAvailableTargets(selectedUser).map((target) => {
                                                            const isSelected = singleUserTargetApp === target;
                                                            const label =
                                                                target === 'customer'
                                                                    ? 'Customer App'
                                                                    : target === 'driver'
                                                                        ? 'Driver App'
                                                                        : 'Both Apps';

                                                            return (
                                                                <button
                                                                    key={target}
                                                                    type="button"
                                                                    onClick={() => setSingleUserTargetApp(target)}
                                                                    className={`inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition-all ${
                                                                        isSelected
                                                                            ? 'border-slate-900 bg-slate-900 text-white'
                                                                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                                                                    }`}
                                                                >
                                                                    {isSelected && <CheckCircle size={16} />}
                                                                    <span>{label}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </section>

                                <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                                    <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-3">
                                        <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm">2</span>
                                        Compose Message
                                    </h2>

                                    <div className="space-y-6">
                                        <div>
                                            <div className="flex justify-between mb-2">
                                                <label className="text-sm font-bold text-slate-700">Notification Title</label>
                                                <span className={`text-xs font-semibold ${title.length >= 100 ? 'text-red-500' : 'text-slate-400'}`}>
                                                    {title.length}/100
                                                </span>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="e.g. 50% Off Your Next Ride!"
                                                className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:bg-white focus:border-slate-900 transition-all font-bold text-slate-900 placeholder:text-slate-300"
                                                value={title}
                                                onChange={(e) => setTitle(e.target.value)}
                                                maxLength={100}
                                            />
                                        </div>

                                        <div>
                                            <div className="flex justify-between mb-2">
                                                <label className="text-sm font-bold text-slate-700">Message Body</label>
                                                <span className={`text-xs font-semibold ${body.length >= 500 ? 'text-red-500' : 'text-slate-400'}`}>
                                                    {body.length}/500
                                                </span>
                                            </div>
                                            <textarea
                                                rows={5}
                                                placeholder="Type your message here..."
                                                className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:bg-white focus:border-slate-900 transition-all font-medium text-slate-900 placeholder:text-slate-300 resize-none"
                                                value={body}
                                                onChange={(e) => setBody(e.target.value)}
                                                maxLength={500}
                                            />
                                        </div>

                                        <div className="pt-4">
                                            <button
                                                onClick={handleSend}
                                                disabled={sending || (audience === 'single' && !selectedUser) || !title.trim() || !body.trim()}
                                                className={`w-full py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all duration-300 ${
                                                    sending || (audience === 'single' && !selectedUser) || !title.trim() || !body.trim()
                                                        ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                                        : 'bg-black text-white hover:bg-slate-800 hover:scale-[1.01] hover:shadow-2xl shadow-lg shadow-slate-200'
                                                }`}
                                            >
                                                {sending ? (
                                                    <>
                                                        <div className="animate-spin w-6 h-6 border-2 border-white/30 border-t-white rounded-full" />
                                                        <span>Sending Blast...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Send size={22} strokeWidth={2.5} />
                                                        Send Notification
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            {/* Right Column: Mobile Preview (5/12) */}
                            <div className="xl:col-span-5 relative sticky top-8">
                                <div className="bg-slate-900 rounded-[3rem] p-4 shadow-2xl border-8 border-slate-800 relative max-w-[360px] mx-auto overflow-hidden">
                                     {/* Notch */}
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-slate-800 rounded-b-2xl z-20"></div>
                                    
                                    {/* Screen Content */}
                                    <div className="bg-gray-100 rounded-[2.3rem] h-[700px] overflow-hidden relative">
                                        {/* Status Bar */}
                                        <div className="h-12 bg-white flex items-end justify-between px-6 pb-2 text-[10px] font-bold text-gray-900">
                                            <span>9:41</span>
                                            <div className="flex gap-1">
                                                <div className="w-4 h-2.5 bg-gray-900 rounded-[1px]"></div>
                                                <div className="w-4 h-2.5 bg-gray-900 rounded-[1px]"></div>
                                                <div className="w-5 h-2.5 bg-gray-900 rounded-[2px] opacity-30"></div>
                                            </div>
                                        </div>

                                        {/* Home Screen Wallpaper */}
                                        <div className="absolute inset-0 top-12 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 opacity-80" />

                                        {/* Notification Banner */}
                                        <div className="absolute top-14 left-0 right-0 p-3 z-10">
                                            <div className={`bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-lg transform transition-all duration-500 ${
                                                title || body ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0 scale-95'
                                            }`}>
                                                <div className="flex gap-3">
                                                    <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                                                        <Bell className="text-white" size={20} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-start">
                                                            <h3 className="font-bold text-slate-900 text-sm leading-tight truncate pr-2">Cart-R</h3>
                                                            <span className="text-[10px] text-slate-400 font-medium">now</span>
                                                        </div>
                                                        <p className="font-bold text-slate-800 text-sm mt-0.5 leading-tight break-words">
                                                            {title || 'Notification Title'}
                                                        </p>
                                                        <p className="text-slate-500 text-xs mt-1 leading-snug break-words line-clamp-3">
                                                            {body || 'Your notification message will appear here. Start typing to see a preview.'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* App Icons (Decoration) */}
                                        <div className="absolute bottom-20 px-6 w-full opacity-50">
                                            <div className="grid grid-cols-4 gap-4">
                                                {[1,2,3,4,5,6,7,8].map(i => (
                                                    <div key={i} className="aspect-square bg-white/20 rounded-2xl backdrop-blur-sm"></div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="mt-8 bg-slate-900 rounded-2xl p-6 text-green-400 font-mono text-xs shadow-xl border border-slate-800">
                                    <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-2">
                                        <span className="font-bold flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                            SYSTEM LOGS
                                        </span>
                                        <button onClick={() => setLogs([])} className="text-slate-500 hover:text-white transition-colors">Clear</button>
                                    </div>
                                    <div className="h-40 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-slate-700">
                                        {logs.length === 0 ? (
                                            <div className="text-slate-600 italic">Ready...</div>
                                        ) : (
                                            logs.map((log, i) => (
                                                <div key={i} className="break-all border-l-2 border-slate-800 pl-2">
                                                    <span className="text-slate-500 opacity-50 mr-2">[{log.split(']')[0].replace('[','')}</span>
                                                    <span className="text-slate-300">{log.split(']').slice(1).join(']')}</span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* HISTORY TAB */}
                    {activeTab === 'history' && (
                        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden min-h-[600px]">
                            {loadingHistory ? (
                                <div className="flex items-center justify-center h-[600px]">
                                    <div className="animate-spin w-10 h-10 border-4 border-slate-900 border-t-transparent rounded-full" />
                                </div>
                            ) : history.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-[600px] text-center p-8">
                                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                                        <Bell className="text-slate-300" size={32} />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 mb-2">No notifications yet</h3>
                                    <p className="text-slate-500 max-w-sm">When you send notifications, they will appear here with delivery status and engagement metrics.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-slate-50/50 border-b border-slate-100">
                                            <tr>
                                                <th className="px-8 py-5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Recipient</th>
                                                <th className="px-8 py-5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Content</th>
                                                <th className="px-8 py-5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                                <th className="px-8 py-5 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Time</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {history.map((notif) => (
                                                <tr key={notif.id} className="hover:bg-blue-50/30 transition-colors group">
                                                    <td className="px-8 py-5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center text-slate-600 font-bold text-sm shadow-inner">
                                                                {(notif.users?.name || 'U').charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-slate-900 text-sm">{notif.users?.name || 'Unknown'}</p>
                                                                <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 uppercase">
                                                                    {notif.users?.role || 'user'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5 max-w-sm">
                                                        <p className="font-bold text-slate-900 text-sm mb-0.5">{notif.title}</p>
                                                        <p className="text-sm text-slate-500 line-clamp-1">{notif.body}</p>
                                                    </td>
                                                    <td className="px-8 py-5">
                                                        {notif.is_read ? (
                                                            <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-bold ring-1 ring-green-100/50">
                                                                <CheckCircle size={14} className="fill-green-500 text-white" /> Read
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs font-bold">
                                                                <Clock size={14} /> Unread
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-8 py-5 text-right">
                                                        <p className="text-sm font-medium text-slate-700">
                                                            {new Date(notif.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                        </p>
                                                        <p className="text-xs text-slate-400">
                                                            {new Date(notif.created_at).toLocaleDateString()}
                                                        </p>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
