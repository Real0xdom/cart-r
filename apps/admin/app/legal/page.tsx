'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import { FileText, Save, RefreshCw, Eye, EyeOff, Plus, X, Users, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface LegalDocument {
  id: string;
  type: string;
  title: string;
  content: string;
  version: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  target_audience: 'customer' | 'driver' | 'both';
}

const docTypes = [
  { value: 'terms_conditions', label: 'Terms & Conditions', emoji: '📋' },
  { value: 'privacy_policy', label: 'Privacy Policy', emoji: '🔒' },
  { value: 'refund_policy', label: 'Refund Policy', emoji: '💰' },
  { value: 'driver_agreement', label: 'Driver Agreement', emoji: '🚗' },
  { value: 'community_guidelines', label: 'Community Guidelines', emoji: '👥' },
  { value: 'other', label: 'Other', emoji: '📄' },
];

const audienceOptions = [
  { value: 'both', label: 'Both (Customer & Driver)', emoji: '👥', color: 'bg-purple-100 text-purple-700' },
  { value: 'customer', label: 'Customer Only', emoji: '🧑', color: 'bg-blue-100 text-blue-700' },
  { value: 'driver', label: 'Driver Only', emoji: '🚗', color: 'bg-amber-100 text-amber-700' },
];

export default function LegalPage() {
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [acceptanceCount, setAcceptanceCount] = useState(0);
  const [newDoc, setNewDoc] = useState({ type: 'terms_conditions', title: '', content: '', target_audience: 'both' });
  const [addingNew, setAddingNew] = useState(false);

  useEffect(() => {
    fetchDocuments();
    fetchAcceptanceCount();
  }, []);

  async function fetchDocuments() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('legal_documents')
        .select('*')
        .order('type')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      toast.error('Failed to load documents: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAcceptanceCount() {
    try {
      const { count, error } = await supabase
        .from('user_terms_acceptance')
        .select('*', { count: 'exact', head: true });

      if (!error) setAcceptanceCount(count || 0);
    } catch (e) {
      // ignore
    }
  }

  const handleSave = async (doc: LegalDocument) => {
    setSaving(doc.id);
    try {
      const { error } = await supabase
        .from('legal_documents')
        .update({
          title: doc.title,
          content: doc.content,
          target_audience: doc.target_audience,
          updated_at: new Date().toISOString(),
        })
        .eq('id', doc.id);

      if (error) throw error;
      toast.success(`${doc.title} saved!`);
      setEditing(null);
    } catch (error: any) {
      toast.error('Failed to save: ' + error.message);
    } finally {
      setSaving(null);
    }
  };

  const handlePublish = async (doc: LegalDocument) => {
    const newPublished = !doc.is_published;
    const currentVersion = doc.version;

    // Bump version on publish
    let newVersion = currentVersion;
    if (newPublished && !doc.is_published) {
      const parts = currentVersion.replace('v', '').split('.');
      const minor = parseInt(parts[1] || '0') + 1;
      newVersion = `v${parts[0]}.${minor}`;
    }

    try {
      const { error } = await supabase
        .from('legal_documents')
        .update({
          is_published: newPublished,
          version: newPublished ? newVersion : currentVersion,
          published_at: newPublished ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', doc.id);

      if (error) throw error;
      toast.success(newPublished ? `Published ${doc.title} (${newVersion})` : `${doc.title} unpublished`);
      fetchDocuments();
    } catch (error: any) {
      toast.error('Failed to update: ' + error.message);
    }
  };

  const handleDelete = async (doc: LegalDocument) => {
    setDeleting(doc.id);
    try {
      const { error } = await supabase
        .from('legal_documents')
        .delete()
        .eq('id', doc.id);

      if (error) throw error;
      toast.success(`"${doc.title}" deleted`);
      setShowDeleteConfirm(null);
      fetchDocuments();
    } catch (error: any) {
      toast.error('Failed to delete: ' + error.message);
    } finally {
      setDeleting(null);
    }
  };

  const handleAdd = async () => {
    if (!newDoc.title || !newDoc.content) {
      toast.error('Title and content are required');
      return;
    }

    setAddingNew(true);
    try {
      const { error } = await supabase
        .from('legal_documents')
        .insert({
          type: newDoc.type,
          title: newDoc.title,
          content: newDoc.content,
          target_audience: newDoc.target_audience,
          version: 'v1.0',
          is_published: false,
        });

      if (error) throw error;
      toast.success('Document created!');
      setShowAddModal(false);
      setNewDoc({ type: 'terms_conditions', title: '', content: '', target_audience: 'both' });
      fetchDocuments();
    } catch (error: any) {
      toast.error('Failed to create: ' + error.message);
    } finally {
      setAddingNew(false);
    }
  };

  const handleContentChange = (id: string, field: string, value: string) => {
    setDocuments(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const getDocEmoji = (type: string) => {
    return docTypes.find(d => d.value === type)?.emoji || '📄';
  };

  const getAudienceBadge = (audience: string) => {
    return audienceOptions.find(a => a.value === audience) || audienceOptions[0];
  };

  return (
    <div className="min-h-screen bg-[var(--color-brand-cream)] font-sans">
      <Sidebar />
      <div className="ml-72 p-8 max-w-[1600px]">
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Legal Documents</h1>
            <p className="text-gray-500 text-sm">Manage terms, policies, and legal content</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchDocuments}
              className="px-4 py-2.5 bg-white text-gray-600 rounded-xl font-semibold shadow-sm border border-gray-200 hover:bg-gray-50 transition-all flex items-center gap-2"
            >
              <RefreshCw size={16} /> Refresh
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-5 py-2.5 bg-orange-500 text-white rounded-xl font-semibold shadow-md shadow-orange-500/20 hover:bg-orange-600 transition-all flex items-center gap-2"
            >
              <Plus size={16} /> Add Document
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                <FileText size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{documents.length}</p>
                <p className="text-xs text-gray-500">Total Documents</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                <Eye size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{documents.filter(d => d.is_published).length}</p>
                <p className="text-xs text-gray-500">Published</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
                <Users size={20} className="text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{acceptanceCount}</p>
                <p className="text-xs text-gray-500">Terms Accepted</p>
              </div>
            </div>
          </div>
        </div>

        {/* Documents Grid */}
        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" />
          </div>
        ) : documents.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
            No documents yet. Click &quot;Add Document&quot; to create one.
          </div>
        ) : (
          <div className="space-y-6">
            {documents.map((doc) => (
              <div key={doc.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Document Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getDocEmoji(doc.type)}</span>
                    <div>
                      {editing === doc.id ? (
                        <input
                          type="text"
                          value={doc.title}
                          onChange={(e) => handleContentChange(doc.id, 'title', e.target.value)}
                          className="text-lg font-bold text-gray-900 bg-transparent border-b-2 border-orange-500 focus:outline-none"
                        />
                      ) : (
                        <h3 className="text-lg font-bold text-gray-900">{doc.title}</h3>
                      )}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-mono">{doc.type}</span>
                        <span className="text-xs text-gray-400">Version {doc.version}</span>
                        {/* Target Audience Badge */}
                        {editing === doc.id ? (
                          <select
                            value={doc.target_audience || 'both'}
                            onChange={(e) => handleContentChange(doc.id, 'target_audience', e.target.value)}
                            className="px-2 py-0.5 rounded text-[10px] font-semibold border border-gray-200 focus:outline-none focus:ring-1 focus:ring-orange-500"
                          >
                            {audienceOptions.map(a => (
                              <option key={a.value} value={a.value}>{a.emoji} {a.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${getAudienceBadge(doc.target_audience || 'both').color}`}>
                            {getAudienceBadge(doc.target_audience || 'both').emoji} {getAudienceBadge(doc.target_audience || 'both').label}
                          </span>
                        )}
                        {doc.published_at && (
                          <span className="text-xs text-gray-400">
                            Published {new Date(doc.published_at).toLocaleDateString('en-IN')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePublish(doc)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-colors ${
                        doc.is_published
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {doc.is_published ? <><Eye size={12} /> Published</> : <><EyeOff size={12} /> Draft</>}
                    </button>
                    {editing === doc.id ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSave(doc)}
                          disabled={saving === doc.id}
                          className="px-4 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-bold hover:bg-orange-600 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {saving === doc.id ? (
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Save size={12} />
                          )}
                          Save
                        </button>
                        <button
                          onClick={() => { setEditing(null); fetchDocuments(); }}
                          className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditing(doc.id)}
                          className="px-4 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(doc.id)}
                          className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors flex items-center gap-1.5"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Document Content */}
                {editing === doc.id ? (
                  <div className="p-6">
                    <textarea
                      value={doc.content}
                      onChange={(e) => handleContentChange(doc.id, 'content', e.target.value)}
                      className="w-full h-64 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white resize-y"
                      placeholder="Enter document content (Markdown supported)..."
                    />
                  </div>
                ) : (
                  <div className="p-6 max-h-32 overflow-hidden relative">
                    <pre className="text-sm text-gray-600 whitespace-pre-wrap font-sans leading-relaxed">{doc.content.slice(0, 300)}{doc.content.length > 300 ? '...' : ''}</pre>
                    {doc.content.length > 300 && (
                      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent" />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Document Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl p-8 mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Add Legal Document</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Document Type</label>
                <select
                  value={newDoc.type}
                  onChange={(e) => setNewDoc({ ...newDoc, type: e.target.value })}
                  className="input-field text-sm"
                >
                  {docTypes.map((t) => (
                    <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Visible To</label>
                <div className="grid grid-cols-3 gap-3">
                  {audienceOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setNewDoc({ ...newDoc, target_audience: opt.value })}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                        newDoc.target_audience === opt.value
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <span className="text-2xl">{opt.emoji}</span>
                      <span className={`text-xs font-semibold ${newDoc.target_audience === opt.value ? 'text-orange-600' : 'text-gray-600'}`}>
                        {opt.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Title</label>
                <input
                  type="text"
                  value={newDoc.title}
                  onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
                  placeholder="e.g. Terms and Conditions"
                  className="input-field text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Content (Markdown supported)</label>
                <textarea
                  value={newDoc.content}
                  onChange={(e) => setNewDoc({ ...newDoc, content: e.target.value })}
                  className="input-field text-sm h-48 resize-y font-mono"
                  placeholder="Enter document content..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={addingNew}
                className="flex-1 btn-primary flex items-center justify-center gap-2"
              >
                {addingNew ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Plus size={16} /> Create Document
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (() => {
        const doc = documents.find(d => d.id === showDeleteConfirm);
        if (!doc) return null;
        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100]">
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-8 mx-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Trash2 size={24} className="text-red-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Delete Document</h2>
                  <p className="text-sm text-gray-500 mt-0.5">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-gray-600 mb-6">
                Are you sure you want to permanently delete{' '}
                <span className="font-semibold text-gray-900">&quot;{doc.title}&quot;</span>?{' '}
                {doc.is_published && (
                  <span className="text-red-600 font-medium">This document is currently published and visible to users.</span>
                )}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(doc)}
                  disabled={deleting === doc.id}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {deleting === doc.id ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <><Trash2 size={16} /> Delete</>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
