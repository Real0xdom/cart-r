'use client';
import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { MessageSquare, AlertCircle, CheckCircle, Clock, Filter, Search, Plus, Trash2, Edit2, Globe, User, Truck, Mail, Phone } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Ticket {
  id: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'normal' | 'high' | 'urgent';
  created_at: string;
  source_app?: 'customer_app' | 'driver_app' | null;
  user: {
    name: string;
    email: string;
    phone: string | null;
    role: string;
  };
}

interface FAQ {
    id: string;
    question: string;
    answer: string;
    target_audience: 'customer' | 'driver' | 'all';
    is_active: boolean;
    created_at: string;
}

export default function SupportPage() {
  const [activeTab, setActiveTab] = useState<'tickets' | 'faqs'>('tickets');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  
  // FAQ Form State
  const [showFaqForm, setShowFaqForm] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [faqFormData, setFaqFormData] = useState({
      question: '',
      answer: '',
      target_audience: 'all' as 'customer' | 'driver' | 'all',
      is_active: true
  });

  // Ticket conversation (reply) modal
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<{ id: string; message: string; sender_type: string; created_at: string }[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    if (activeTab === 'tickets') {
        fetchTickets();
    } else {
        fetchFaqs();
    }
  }, [activeTab, filter]);

  async function fetchTickets() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/support-tickets?filter=${encodeURIComponent(filter)}`
      );
      if (!res.ok) throw new Error('Failed to load tickets');
      const data = await res.json();
      setTickets(data || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }

  async function fetchFaqs() {
    setLoading(true);
    try {
        const res = await fetch('/api/faqs');
        if (!res.ok) {
            throw new Error('Failed to load FAQs');
        }
        const data = await res.json();
        setFaqs(data || []);
    } catch (error) {
        toast.error('Failed to load FAQs');
    } finally {
        setLoading(false);
    }
  }

  async function handleFaqSubmit(e: React.FormEvent) {
      e.preventDefault();
      try {
          if (editingFaq) {
              const res = await fetch('/api/faqs', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: editingFaq.id, ...faqFormData }),
              });
              if (!res.ok) {
                  const data = await res.json().catch(() => ({}));
                  throw new Error(data.error || 'Failed to update FAQ');
              }
              toast.success('FAQ updated');
          } else {
              const res = await fetch('/api/faqs', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(faqFormData),
              });
              if (!res.ok) {
                  const data = await res.json().catch(() => ({}));
                  throw new Error(data.error || 'Failed to create FAQ');
              }
              toast.success('FAQ created');
          }
          setShowFaqForm(false);
          setEditingFaq(null);
          setFaqFormData({ question: '', answer: '', target_audience: 'all', is_active: true });
          fetchFaqs();
      } catch (error) {
          toast.error('Failed to save FAQ');
      }
  }

  async function deleteFaq(id: string) {
      if (!confirm('Are you sure you want to delete this FAQ?')) return;
      try {
          const res = await fetch(`/api/faqs?id=${encodeURIComponent(id)}`, {
              method: 'DELETE',
          });
          if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data.error || 'Failed to delete FAQ');
          }
          toast.success('FAQ deleted');
          fetchFaqs();
      } catch (error) {
          toast.error('Failed to delete FAQ');
      }
  }

  async function openTicketConversation(ticket: Ticket) {
    setSelectedTicket(ticket);
    setTicketMessages([]);
    setReplyText('');
    try {
      const res = await fetch(`/api/support-tickets/${ticket.id}/messages`);
      if (res.ok) {
        const data = await res.json();
        setTicketMessages(data || []);
      }
    } catch {
      toast.error('Failed to load conversation');
    }
  }

  async function sendReply() {
    if (!selectedTicket || !replyText.trim()) return;
    setSendingReply(true);
    try {
      const res = await fetch(`/api/support-tickets/${selectedTicket.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyText.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to send reply');
      }
      const newMsg = await res.json();
      setTicketMessages((prev) => [...prev, newMsg]);
      setReplyText('');
      toast.success('Reply sent');
    } catch (e: any) {
      toast.error(e.message || 'Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  }

  async function updateStatus(id: string, newStatus: string) {
    try {
      const res = await fetch('/api/support-tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update status');
      }
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
      case 'medium':
      case 'normal': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'low': return 'text-gray-600 bg-gray-50 border-gray-200';
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
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Help Center</h1>
            <p className="text-gray-500 text-sm">Manage support tickets and common questions</p>
          </div>
          
          <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-gray-100">
              <button 
                onClick={() => setActiveTab('tickets')}
                className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'tickets' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                  Tickets
              </button>
              <button 
                onClick={() => setActiveTab('faqs')}
                className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'faqs' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                  FAQs
              </button>
          </div>

          {activeTab === 'tickets' ? (
              <div className="flex gap-2">
                {(['all', 'open', 'resolved'] as const).map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all ${
                            filter === f 
                            ? 'bg-orange-500 text-white shadow-lg' 
                            : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100'
                        }`}
                    >
                        {f}
                    </button>
                ))}
              </div>
          ) : (
              <button 
                onClick={() => {
                    setEditingFaq(null);
                    setFaqFormData({ question: '', answer: '', target_audience: 'all', is_active: true });
                    setShowFaqForm(true);
                }}
                className="bg-orange-500 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-orange-600 shadow-lg transition-all"
              >
                  <Plus size={20} /> Add FAQ
              </button>
          )}
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            {loading ? (
                <div className="p-12 text-center">
                    <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full mx-auto" />
                </div>
            ) : activeTab === 'tickets' ? (
                /* TICKETS VIEW */
                tickets.length === 0 ? (
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
                                             <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                                                <span className="font-medium text-gray-700 bg-gray-100 px-2 py-1 rounded-md">
                                                    {ticket.user?.name || 'Unknown User'}
                                                </span>
                                                <span className={`px-2 py-1 rounded-md font-bold uppercase tracking-wider ${
                                                  ticket.source_app === 'customer_app'
                                                    ? 'bg-blue-100 text-blue-700'
                                                    : ticket.source_app === 'driver_app'
                                                    ? 'bg-amber-100 text-amber-700'
                                                    : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                    {ticket.source_app === 'customer_app'
                                                      ? 'Customer app'
                                                      : ticket.source_app === 'driver_app'
                                                      ? 'Driver app'
                                                      : 'Unknown app'}
                                                </span>
                                                <span className="text-gray-400">Account: {ticket.user?.role}</span>
                                                <span className="flex items-center gap-1">
                                                    <Clock size={12} />
                                                    {new Date(ticket.created_at).toLocaleString()}
                                                </span>
                                             </div>
                                             {/* Contact user */}
                                             <div className="flex flex-wrap gap-3 mt-2">
                                                <a
                                                    href={ticket.user?.email ? `mailto:${ticket.user.email}` : '#'}
                                                    className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                                                >
                                                    <Mail size={14} /> Email user
                                                </a>
                                                {ticket.user?.phone && (
                                                    <a
                                                        href={`tel:${ticket.user.phone}`}
                                                        className="inline-flex items-center gap-1.5 text-sm text-green-600 hover:text-green-700 font-medium"
                                                    >
                                                        <Phone size={14} /> Call user
                                                    </a>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => openTicketConversation(ticket)}
                                                    className="inline-flex items-center gap-1.5 text-sm text-orange-600 hover:text-orange-700 font-medium"
                                                >
                                                    <MessageSquare size={14} /> Reply / View conversation
                                                </button>
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
                )
            ) : (
                /* FAQS VIEW */
                faqs.length === 0 ? (
                    <div className="p-16 text-center text-gray-500">
                        <AlertCircle size={48} className="mx-auto mb-4 text-gray-300" />
                        <p className="text-lg font-medium">No FAQs defined</p>
                        <p className="text-sm">Click "Add FAQ" to create your first question.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {faqs.map((faq) => (
                            <div key={faq.id} className="p-6 hover:bg-gray-50/50 transition-colors">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1 max-w-3xl">
                                        <div className="flex items-center gap-3 mb-2">
                                            {faq.target_audience === 'customer' ? <User size={16} className="text-blue-500" /> : 
                                             faq.target_audience === 'driver' ? <Truck size={16} className="text-green-500" /> : 
                                             <Globe size={16} className="text-purple-500" />}
                                            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
                                                For {faq.target_audience}
                                            </span>
                                            {!faq.is_active && (
                                                <span className="px-2 py-0.5 rounded bg-red-100 text-red-600 text-[10px] font-bold uppercase">Inactive</span>
                                            )}
                                        </div>
                                        <h3 className="text-lg font-bold text-gray-900 mb-2">{faq.question}</h3>
                                        <p className="text-gray-600 text-sm leading-relaxed">{faq.answer}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => {
                                                setEditingFaq(faq);
                                                setFaqFormData({ 
                                                    question: faq.question, 
                                                    answer: faq.answer, 
                                                    target_audience: faq.target_audience,
                                                    is_active: faq.is_active
                                                });
                                                setShowFaqForm(true);
                                            }}
                                            className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                        <button 
                                            onClick={() => deleteFaq(faq.id)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            )}
        </div>

        {/* FAQ FORM MODAL */}
        {showFaqForm && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl">
                    <h2 className="text-2xl font-bold mb-6">{editingFaq ? 'Edit FAQ' : 'Add New FAQ'}</h2>
                    <form onSubmit={handleFaqSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Question</label>
                            <input 
                                required
                                value={faqFormData.question}
                                onChange={(e) => setFaqFormData({...faqFormData, question: e.target.value})}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                placeholder="How do I...?"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Answer</label>
                            <textarea 
                                required
                                rows={4}
                                value={faqFormData.answer}
                                onChange={(e) => setFaqFormData({...faqFormData, answer: e.target.value})}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                placeholder="Explain here..."
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Target Audience</label>
                                <select 
                                    value={faqFormData.target_audience}
                                    onChange={(e) => setFaqFormData({...faqFormData, target_audience: e.target.value as any})}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none"
                                >
                                    <option value="all">Everyone</option>
                                    <option value="customer">Customers</option>
                                    <option value="driver">Drivers</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Status</label>
                                <select 
                                    value={faqFormData.is_active ? 'true' : 'false'}
                                    onChange={(e) => setFaqFormData({...faqFormData, is_active: e.target.value === 'true'})}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none"
                                >
                                    <option value="true">Active</option>
                                    <option value="false">Inactive</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-3 pt-4">
                            <button 
                                type="button"
                                onClick={() => setShowFaqForm(false)}
                                className="flex-1 px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-all"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit"
                                className="flex-1 px-6 py-3 rounded-xl font-bold bg-orange-500 text-white hover:bg-orange-600 shadow-lg transition-all"
                            >
                                {editingFaq ? 'Save Changes' : 'Create FAQ'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* Ticket conversation / reply modal */}
        {selectedTicket && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-start">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">{selectedTicket.subject}</h2>
                            <p className="text-sm text-gray-500 mt-1">
                                With {selectedTicket.user?.name} ({selectedTicket.user?.email})
                            </p>
                            <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-bold uppercase ${
                                selectedTicket.source_app === 'customer_app' ? 'bg-blue-100 text-blue-700' :
                                selectedTicket.source_app === 'driver_app' ? 'bg-amber-100 text-amber-700' :
                                'bg-gray-100 text-gray-600'
                            }`}>
                                {selectedTicket.source_app === 'customer_app' ? 'Customer app' :
                                 selectedTicket.source_app === 'driver_app' ? 'Driver app' : 'Unknown app'}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => { setSelectedTicket(null); setTicketMessages([]); setReplyText(''); }}
                            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
                        >
                            ×
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-[200px]">
                        {ticketMessages.length === 0 ? (
                            <p className="text-gray-500 text-sm">No messages yet. Send a reply below.</p>
                        ) : (
                            ticketMessages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`rounded-xl p-4 max-w-[85%] ${
                                        msg.sender_type === 'support'
                                            ? 'ml-auto bg-orange-50 border border-orange-100'
                                            : 'bg-gray-50 border border-gray-100'
                                    }`}
                                >
                                    <p className="text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">
                                        {msg.sender_type === 'support' ? 'Support' : 'Customer'}
                                    </p>
                                    <p className="text-gray-800 text-sm whitespace-pre-wrap">{msg.message}</p>
                                    <p className="text-xs text-gray-400 mt-2">
                                        {new Date(msg.created_at).toLocaleString()}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="p-4 border-t border-gray-100">
                        <textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Type your reply to the user..."
                            rows={3}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 mb-3"
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => { setSelectedTicket(null); setTicketMessages([]); setReplyText(''); }}
                                className="px-4 py-2 rounded-xl font-bold text-gray-500 hover:bg-gray-100"
                            >
                                Close
                            </button>
                            <button
                                type="button"
                                onClick={sendReply}
                                disabled={!replyText.trim() || sendingReply}
                                className="px-6 py-2 rounded-xl font-bold bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {sendingReply ? 'Sending…' : 'Send reply'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
