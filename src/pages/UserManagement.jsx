import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Users, Search, Edit2, Save, X, ChevronDown, ChevronUp, Send, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const FIRMS = [
  'S STEYN INCORPORATED',
  'LHL ATTORNEYS',
  'DBVS ATTORNEYS',
  'RH LAWYERS',
  'A WOLMARANS INCORPORATED',
];

const PERMISSION_LEVELS = [
  { value: 'view_only', label: 'View Only', color: 'text-slate-400' },
  { value: 'transaction_entry', label: 'Transaction Entry', color: 'text-blue-400' },
  { value: 'reporting', label: 'Reporting', color: 'text-emerald-400' },
  { value: 'full_access', label: 'Full Access', color: 'text-primary' },
];

const ACCOUNT_STATUSES = [
  { value: 'active', label: 'Active', bg: 'bg-emerald-400/15', text: 'text-emerald-400' },
  { value: 'disabled', label: 'Disabled', bg: 'bg-amber-400/15', text: 'text-amber-400' },
  { value: 'archived', label: 'Archived', bg: 'bg-slate-400/15', text: 'text-slate-400' },
];

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [editForms, setEditForms] = useState({});
  const [saving, setSaving] = useState({});
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    base44.entities.User.list('-created_date', 500).then(data => {
      setUsers(data);
      setLoading(false);
    });
  }, []);

  const filteredUsers = users.filter(u =>
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const initEditForm = (user) => {
    setEditForms(prev => ({
      ...prev,
      [user.id]: {
        assigned_firm: user.assigned_firm || '',
        permission_level: user.permission_level || 'view_only',
        account_status: user.account_status || 'active',
      },
    }));
    setExpandedId(user.id);
  };

  const setField = (userId, field, value) => {
    setEditForms(prev => ({
      ...prev,
      [userId]: { ...prev[userId], [field]: value },
    }));
  };

  const handleSave = async (user) => {
    setSaving(prev => ({ ...prev, [user.id]: true }));
    const data = editForms[user.id];
    await base44.auth.updateMe({ ...data });
    setUsers(prev =>
      prev.map(u => (u.id === user.id ? { ...u, ...data } : u))
    );
    setSaving(prev => ({ ...prev, [user.id]: false }));
    setExpandedId(null);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }
    setInviting(true);
    try {
      await base44.users.inviteUser(inviteEmail.trim(), inviteRole);
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      setInviteRole('user');
      setShowInviteForm(false);
    } catch (err) {
      toast.error(err.message || 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Users className="w-6 h-6 text-primary" />
          <h1 className="font-space text-2xl font-bold text-foreground">User Management</h1>
        </div>
        <p className="text-muted-foreground text-sm">Assign firm roles, permissions, and account status for all users.</p>
      </div>

      {/* Invite Section */}
      <div className="bg-primary/10 border border-primary/20 rounded-xl p-5">
        {!showInviteForm ? (
          <button
            onClick={() => setShowInviteForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Send className="w-4 h-4" />
            Invite New User
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Send invitation by email</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="email"
                placeholder="user@example.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleInvite()}
                className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value)}
                className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleInvite}
                disabled={inviting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                <Send className="w-4 h-4" />
                {inviting ? 'Sending...' : 'Send Invite'}
              </button>
              <button
                onClick={() => {
                  setShowInviteForm(false);
                  setInviteEmail('');
                  setInviteRole('user');
                }}
                className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by email or name..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full bg-input border border-border rounded-lg pl-10 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Users List */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <p className="text-sm font-medium text-foreground">{filteredUsers.length} users</p>
        </div>

        <div className="divide-y divide-border/60">
          {filteredUsers.length === 0 && (
            <p className="text-center py-12 text-muted-foreground text-sm">No users found.</p>
          )}

          {filteredUsers.map(user => {
            const isOpen = expandedId === user.id;
            const form = editForms[user.id];
            const isSaving = saving[user.id];
            const permLabel = PERMISSION_LEVELS.find(p => p.value === user.permission_level)?.label || '—';
            const statusConfig = ACCOUNT_STATUSES.find(s => s.value === user.account_status);

            return (
              <div key={user.id}>
                {/* Row */}
                <button
                  onClick={() => (isOpen ? setExpandedId(null) : initEditForm(user))}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{user.full_name || user.email}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">{user.email}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/15 text-primary">
                        {user.role === 'admin' ? 'Admin' : 'User'}
                      </span>
                      {user.assigned_firm && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-400/15 text-slate-400">
                          {user.assigned_firm}
                        </span>
                      )}
                      {user.permission_level && (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground`}
                        >
                          {permLabel}
                        </span>
                      )}
                      {statusConfig && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                          {statusConfig.label}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-primary hover:text-primary/80 flex-shrink-0">
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {/* Expanded Form */}
                {isOpen && form && (
                  <div className="px-5 pb-5 bg-muted/10 border-t border-border/40 space-y-4 pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1.5">Assigned Firm</label>
                        <select
                          value={form.assigned_firm}
                          onChange={e => setField(user.id, 'assigned_firm', e.target.value)}
                          className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value="">None</option>
                          {FIRMS.map(f => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1.5">Permission Level</label>
                        <select
                          value={form.permission_level}
                          onChange={e => setField(user.id, 'permission_level', e.target.value)}
                          className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          {PERMISSION_LEVELS.map(p => (
                            <option key={p.value} value={p.value}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-muted-foreground mt-1">
                          {PERMISSION_LEVELS.find(p => p.value === form.permission_level)?.label === 'View Only'
                            ? 'Read-only access to firm data'
                            : PERMISSION_LEVELS.find(p => p.value === form.permission_level)?.label === 'Transaction Entry'
                              ? 'Can create and edit transactions'
                              : PERMISSION_LEVELS.find(p => p.value === form.permission_level)?.label === 'Reporting'
                                ? 'Can access reports and analytics'
                                : 'Full administrative access'}
                        </p>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1.5">Account Status</label>
                        <select
                          value={form.account_status}
                          onChange={e => setField(user.id, 'account_status', e.target.value)}
                          className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          {ACCOUNT_STATUSES.map(s => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-muted-foreground mt-1">
                          {form.account_status === 'active'
                            ? 'User can log in normally'
                            : form.account_status === 'disabled'
                              ? 'User account is temporarily disabled'
                              : 'User account is archived (historical reference only)'}
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={() => setExpandedId(null)}
                        className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSave(user)}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
                      >
                        <Save className="w-4 h-4" />
                        {isSaving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}