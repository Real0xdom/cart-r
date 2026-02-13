'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import { MessageSquare, AlertCircle, CheckCircle, Clock, Filter, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Ticket {
  id: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  created_at: string;
  user: {
    name: string;
    email: string;
    role: string;
  };
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');

  useEffect(() => {
    fetchTickets();
    
    const subscription = supabase
      .channel('support_tickets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, fetchTickets)
      .subscribe();

    return () => { subscription.unsubscribe(); };
  }, [filter]);

  async function fetchTickets() {
    setLoading(true);
    try {
      let query = supabase
        .from('support_tickets')
        .select(`
          *,
          user:users!support_tickets_user_id_fkey(name, email, role)
        `)
        .order('created_at', { ascending: false });

      if (filter === 'open') {
        query = query.in('status', ['open', 'in_progress']);
      } else if (filter === 'resolved') {
        query = query.in('status', ['resolved', 'closed']);
      }

      const { data, error } = await query;
      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, newStatus: string) {
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Ticket marked as ${newStatus}`);
      fetchTickets();
    } catch (error) {
      toast.error('Failed to update status');
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'normal': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
     switch (status) {
      case 'open': return 'bg-green-100 text-green-700';
      case 'in_progress': return 'bg-blue-100 text-blue-700';
      case 'resolved': return 'bg-gray-100 text-gray-700';
      case 'closed': return 'bg-gray-200 text-gray-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-brand-cream)] font-sans">
      <Sidebar />
      <div className="ml-72 p-8 max-w-[1600px]">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Support Tickets</h1>
            <p className="text-gray-500 text-sm">Manage user inquiries and issues</p>
          </div>
          <div className="flex gap-2">
            {(['all', 'open', 'resolved'] as const).map((f) => (
                <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all ${
                        filter === f 
                        ? 'bg-gray-900 text-white shadow-lg' 
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                >
                    {f}
                </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
             {loading ? (
                <div className="p-12 text-center">
                    <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full mx-auto" />
                </div>
            ) : tickets.length === 0 ? (
                <div className="p-16 text-center text-gray-500">
                    <MessageSquare size={48} className="mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium">No tickets found</p>
                    <p className="text-sm">Great job! There are no pending issues.</p>
                </div>
            ) : (
                <div className="divide-y divide-gray-100">
                    {tickets.map((ticket) => (
                        <div key={ticket.id} className="p-6 hover:bg-gray-50/50 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-start gap-4">
                                     <div className={`mt-1 p-2 rounded-lg ${ticket.status === 'resolved' ? 'bg-gray-100 text-gray-400' : 'bg-orange-50 text-orange-500'}`}>
                                        <AlertCircle size={20} />
                                     </div>
                                     <div>
                                         <h3 className="text-lg font-bold text-gray-900 mb-1">{ticket.subject}</h3>
                                         <p className="text-gray-600 mb-3 text-sm leading-relaxed max-w-2xl">{ticket.description}</p>
                                         <div className="flex items-center gap-4 text-xs text-gray-500">
                                            <span className="flex items-center gap-1 font-medium text-gray-700 bg-gray-100 px-2 py-1 rounded-md">
                                                {ticket.user?.name || 'Unknown User'} ({ticket.user?.role})
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock size={12} />
                                                {new Date(ticket.created_at).toLocaleString()}
                                            </span>
                                         </div>
                                     </div>
                                </div>
                                <div className="flex flex-col items-end gap-3">
                                    <div className="flex gap-2">
                                        <span className={`px-2 py-1 rounded-md text-xs font-bold border uppercase tracking-wider ${getPriorityColor(ticket.priority)}`}>
                                            {ticket.priority}
                                        </span>
                                        <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${getStatusColor(ticket.status)}`}>
                                            {ticket.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                    
                                    {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
                                        <button
                                            onClick={() => updateStatus(ticket.id, 'resolved')}
                                            className="text-sm font-semibold text-green-600 hover:text-green-700 flex items-center gap-1"
                                        >
                                            <CheckCircle size={16} /> Mark Resolved
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
