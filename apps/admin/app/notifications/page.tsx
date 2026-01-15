'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import { Bell, Search, User, Send, Users, Truck } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface UserProfile {
    id: string;
    name: string;
    email: string;
    role: string;
}

type AudienceType = 'single' | 'all_customers' | 'all_drivers' | 'all_users';

export default function NotificationsPage() {
    const [loading, setLoading] = useState(false);

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

    // Search users
    useEffect(() => {
        const searchUsers = async () => {
            if (searchQuery.length < 2) return;

            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('id, name, email, role')
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
                let query = supabase.from('users').select('id');

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
                targetUserIds = data?.map(u => u.id) || [];
            }

            if (targetUserIds.length === 0) {
                toast.error('No users found in selected audience');
                setSending(false);
                return;
            }

            // Prepare batch insert
            const notifications = targetUserIds.map(userId => ({
                user_id: userId,
                title: title.trim(),
                body: body.trim(),
                is_read: false,
                created_at: new Date().toISOString()
            }));

            // Batch insert (chunked if large, but assuming < 1000 for now)
            const { error } = await supabase
                .from('notifications')
                .insert(notifications);

            if (error) throw error;

            toast.success(successMessage);
            setTitle('');
            setBody('');
            if (audience === 'single') {
                setSelectedUser(null);
                setSearchQuery('');
            }
        } catch (error: any) {
            toast.error('Failed to send: ' + error.message);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--color-brand-cream)] font-sans">
            <Sidebar />
            <div className="ml-72 p-8 max-w-[1000px]">

                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Send Notifications</h1>
                    <p className="text-gray-500">Push alerts to users manually.</p>
                </div>

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
                                                    <div>
                                                        <div className="font-semibold text-gray-900 text-sm">{user.name}</div>
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
                                            <div className="font-bold text-gray-900">{selectedUser.name}</div>
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
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Message Body</label>
                            <textarea
                                rows={4}
                                placeholder="Type your message here..."
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                                value={body}
                                onChange={(e) => setBody(e.target.value)}
                            />
                        </div>

                        <div className="pt-4">
                            <button
                                onClick={handleSend}
                                disabled={sending || (audience === 'single' && !selectedUser)}
                                className={`w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-200 ${sending || (audience === 'single' && !selectedUser)
                                        ? 'bg-gray-300 cursor-not-allowed shadow-none'
                                        : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 hover:shadow-xl hover:scale-[1.01] active:scale-[0.99]'
                                    }`}
                            >
                                {sending ? (
                                    <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
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
            </div>
        </div>
    );
}
