'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import { Bell, Search, User, Send } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function NotificationsPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
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
        setUsers(data || []);
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
    if (!selectedUser || !title.trim() || !body.trim()) {
        toast.error('Please fill in all fields');
        return;
    }

    setSending(true);
    try {
        const { error } = await supabase
            .from('notifications')
            .insert({
                user_id: selectedUser.id,
                title: title.trim(),
                body: body.trim(),
                is_read: false
            });

        if (error) throw error;

        toast.success(`Notification sent to ${selectedUser.name}!`);
        setTitle('');
        setBody('');
        setSelectedUser(null);
        setSearchQuery('');
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
            <p className="text-gray-500">Manually push alerts to drivers or customers.</p>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
            
            {/* User Search */}
            <div className="mb-6">
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
                        {users.length > 0 && searchQuery.length >= 2 && (
                            <div className="absolute z-10 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden">
                                {users.map(user => (
                                    <div 
                                        key={user.id}
                                        onClick={() => {
                                            setSelectedUser(user);
                                            setUsers([]);
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
                                <div className="animate-spin w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full"/>
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

            {/* Title & Body */}
            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Title</label>
                    <input
                        type="text"
                        placeholder="e.g. Bonus Added!"
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
                        disabled={sending || !selectedUser}
                        className={`w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-200 ${
                            sending || !selectedUser 
                            ? 'bg-gray-300 cursor-not-allowed shadow-none' 
                            : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 hover:shadow-xl hover:scale-[1.01] active:scale-[0.99]'
                        }`}
                    >
                        {sending ? (
                            <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"/>
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
