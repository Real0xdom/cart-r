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
    role: string;
    expo_push_token?: string;
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

type AudienceType = 'single' | 'all_customers' | 'all_drivers' | 'all_users';

export default function NotificationsPage() {
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'send' | 'history'>('send');

    // Audience Selection
    const [audience, setAudience] = useState<AudienceType>('single');

    // Single User Search
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

    // Message Content
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);

    // History & Stats
    const [history, setHistory] = useState<NotificationHistory[]>([]);
    const [stats, setStats] = useState<NotificationStats>({ total_sent: 0, sent_today: 0, read_rate: 0 });
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Load stats and history
    useEffect(() => {
        loadStats();
        if (activeTab === 'history') {
            loadHistory();
        }
    }, [activeTab]);

    const loadStats = async () => {
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('id, is_read, created_at');

            if (error) throw error;

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const sentToday = data?.filter(n => new Date(n.created_at) >= today).length || 0;
            const readCount = data?.filter(n => n.is_read).length || 0;
            const readRate = data && data.length > 0 ? (readCount / data.length) * 100 : 0;

            setStats({
                total_sent: data?.length || 0,
                sent_today: sentToday,
                read_rate: Math.round(readRate)
            });
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    };

    const loadHistory = async () => {
        setLoadingHistory(true);
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select(`
                    id,
                    user_id,
                    title,
                    body,
                    is_read,
                    created_at,
                    users (name, role)
                `)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
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
                const { data, error } = await supabase
                    .from('users')
                    .select('id, name, email, role, expo_push_token')
                    .ilike('name', `%${searchQuery}%`)
                    .limit(10);

                if (error) throw error;
                setSearchResults(data || []);
            } catch (error) {
                console.error('Error searching users:', error);
            } finally {
                setLoading(false);
            }
        };

        const timer = setTimeout(searchUsers, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleSend = async () => {
        if ((audience === 'single' && !selectedUser) || !title.trim() || !body.trim()) {
            toast.error('Please fill in all fields');
            return;
        }

        setSending(true);
        try {
            let targetUserIds: string[] = [];
            let successMessage = '';

            if (audience === 'single' && selectedUser) {
                targetUserIds = [selectedUser.id];
                successMessage = `Notification sent to ${selectedUser.name}!`;
            } else {
                // Fetch target audience IDs
                let query = supabase.from('users').select('id, expo_push_token');

                if (audience === 'all_customers') {
                    query = query.eq('role', 'customer');
                    successMessage = 'Notification sent to all customers!';
                } else if (audience === 'all_drivers') {
                    query = query.eq('role', 'driver');
                    successMessage = 'Notification sent to all drivers!';
                } else if (audience === 'all_users') {
                    successMessage = 'Notification sent to all users!';
                }

                const { data, error } = await query;
                if (error) throw error;
                targetUserIds = data?.map((u: any) => u.id) || [];
            }

            if (targetUserIds.length === 0) {
                toast.error('No users found in selected audience');
                setSending(false);
                return;
            }

            // Prepare batch notifications for database
            const notifications = targetUserIds.map(userId => ({
                user_id: userId,
                title: title.trim(),
                body: body.trim(),
                is_read: false,
                created_at: new Date().toISOString()
            }));

            // Insert to database (for in-app notifications)
            const { error: dbError } = await supabase
                .from('notifications')
                .insert(notifications);

            if (dbError) throw dbError;

            // Send push notifications via Edge Function (process-notifications trigger will handle it)
            // The database trigger automatically sends push notifications
            // But we can also call the edge function directly for immediate delivery
            
            toast.success(`${successMessage} (${notifications.length} notifications saved)`);
            
            // Reset form
            setTitle('');
            setBody('');
            if (audience === 'single') {
                setSelectedUser(null);
                setSearchQuery('');
            }

            // Reload stats and history if on history tab
            loadStats();
            if (activeTab === 'history') {
                loadHistory();
            }
        } catch (error: any) {
            console.error('Notification error:', error);
            toast.error('Failed to send: ' + error.message);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--color-brand-cream)] font-sans">
            <Sidebar />
            <div className="ml-72 p-8 max-w-[1200px]">

                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">Notifications</h1>
                        <p className="text-gray-500">Send push alerts and manage notification history</p>
                    </div>

                    {/* Tab Switcher */}
                    <div className="flex gap-2 bg-white rounded-xl p-1 shadow-sm border border-gray-100">
                        <button
                            onClick={() => setActiveTab('send')}
                            className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                                activeTab === 'send'
                                    ? 'bg-orange-500 text-white shadow-md'
                                    : 'text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            <Send className="inline mr-2" size={16} />
                            Send
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                                activeTab === 'history'
                                    ? 'bg-orange-500 text-white shadow-md'
                                    : 'text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            <History className="inline mr-2" size={16} />
                            History
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                                <Bell className="text-blue-600" size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Total Sent</p>
                                <p className="text-2xl font-bold text-gray-900">{stats.total_sent}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                                <TrendingUp className="text-green-600" size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Sent Today</p>
                                <p className="text-2xl font-bold text-gray-900">{stats.sent_today}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                                <CheckCircle className="text-purple-600" size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Read Rate</p>
                                <p className="text-2xl font-bold text-gray-900">{stats.read_rate}%</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Send Tab */}
                {activeTab === 'send' && (
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">

                        {/* Audience Selector */}
                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-gray-700 mb-3">Target Audience</label>
                            <div className="grid grid-cols-4 gap-3">
                                {[
                                    { id: 'single', label: 'Specific User', icon: User },
                                    { id: 'all_customers', label: 'All Customers', icon: Users },
                                    { id: 'all_drivers', label: 'All Drivers', icon: Truck },
                                    { id: 'all_users', label: 'Everyone', icon: Bell },
                                ].map((type) => {
                                    const Icon = type.icon;
                                    const isSelected = audience === type.id;
                                    return (
                                        <button
                                            key={type.id}
                                            onClick={() => setAudience(type.id as AudienceType)}
                                            className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${isSelected
                                                    ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-md shadow-orange-100'
                                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                                }`}
                                        >
                                            <Icon size={20} className={isSelected ? 'text-orange-500' : 'text-gray-400'} />
                                            <span className="text-xs font-bold">{type.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* User Search (Only if Single) */}
                        {audience === 'single' && (
                            <div className="mb-6 animate-in slide-in-from-top-2 duration-200">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Recipient</label>

                                {!selectedUser ? (
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Search user by name..."
                                            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                        <Search className="absolute left-4 top-3.5 text-gray-400" size={20} />

                                        {/* Search Results */}
                                        {searchResults.length > 0 && searchQuery.length >= 2 && (
                                            <div className="absolute z-10 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden">
                                                {searchResults.map(user => (
                                                    <div
                                                        key={user.id}
                                                        onClick={() => {
                                                            setSelectedUser(user);
                                                            setSearchResults([]);
                                                            setSearchQuery('');
                                                        }}
                                                        className="p-3 hover:bg-orange-50 cursor-pointer flex items-center gap-3 border-b border-gray-50 last:border-0"
                                                    >
                                                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500">
                                                            <User size={14} />
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                                                                {user.name}
                                                                {user.expo_push_token && (
                                                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Push Enabled</span>
                                                                )}
                                                            </div>
                                                            <div className="text-xs text-gray-400">{user.role} • {user.email}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {loading && (
                                            <div className="absolute right-4 top-3.5">
                                                <div className="animate-spin w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full" />
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between p-4 bg-orange-50 border border-orange-100 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
                                                <User size={20} />
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-900 flex items-center gap-2">
                                                    {selectedUser.name}
                                                    {selectedUser.expo_push_token && (
                                                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Push Enabled</span>
                                                    )}
                                                </div>
                                                <div className="text-sm text-gray-500">{selectedUser.role}</div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setSelectedUser(null)}
                                            className="text-sm font-semibold text-red-500 hover:text-red-700 p-2"
                                        >
                                            Change
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Title & Body */}
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Title</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Special Offer!"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all font-semibold"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    maxLength={100}
                                />
                                <p className="text-xs text-gray-400 mt-1">{title.length}/100 characters</p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Message Body</label>
                                <textarea
                                    rows={4}
                                    placeholder="Type your message here..."
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                                    value={body}
                                    onChange={(e) => setBody(e.target.value)}
                                    maxLength={500}
                                />
                                <p className="text-xs text-gray-400 mt-1">{body.length}/500 characters</p>
                            </div>

                            <div className="pt-4">
                                <button
                                    onClick={handleSend}
                                    disabled={sending || (audience === 'single' && !selectedUser) || !title.trim() || !body.trim()}
                                    className={`w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-200 ${
                                        sending || (audience === 'single' && !selectedUser) || !title.trim() || !body.trim()
                                            ? 'bg-gray-300 cursor-not-allowed shadow-none'
                                            : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 hover:shadow-xl hover:scale-[1.01] active:scale-[0.99]'
                                    }`}
                                >
                                    {sending ? (
                                        <>
                                            <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                                            <span>Sending...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Send size={20} />
                                            Send Notification
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                    </div>
                )}

                {/* History Tab */}
                {activeTab === 'history' && (
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                        {loadingHistory ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="animate-spin w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full" />
                            </div>
                        ) : history.length === 0 ? (
                            <div className="text-center py-20">
                                <Bell className="mx-auto mb-4 text-gray-300" size={48} />
                                <p className="text-gray-500 font-medium">No notifications sent yet</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Recipient</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Title</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Message</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Status</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Sent</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {history.map((notif) => (
                                            <tr key={notif.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4">
                                                    <div>
                                                        <p className="font-semibold text-gray-900 text-sm">{notif.users?.name || 'Unknown'}</p>
                                                        <p className="text-xs text-gray-500">{notif.users?.role}</p>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="font-medium text-gray-900">{notif.title}</p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-sm text-gray-600 line-clamp-2">{notif.body}</p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {notif.is_read ? (
                                                        <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-semibold">
                                                            <CheckCircle size={12} /> Read
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs font-semibold">
                                                            <Clock size={12} /> Unread
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-sm text-gray-500">
                                                        {new Date(notif.created_at).toLocaleDateString()} {new Date(notif.created_at).toLocaleTimeString()}
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
    );
}
