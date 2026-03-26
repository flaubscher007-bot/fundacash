import { useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  Search, Plus, Upload, Eye, Edit2, Save, X,
  ChevronUp, ChevronDown, Loader2, CheckCircle2
} from 'lucide-react';

const fmt = (n) => n != null ? `R ${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 0 })}` : '—';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const STATUS_COLORS = {
  YES: 'bg-emerald-400/15 text-emerald-400',
  PENDING: 'bg-amber-400/15 text-amber-400',
  NO: 'bg-red-400/15 text-red-400',
  CANCELLED: 'bg-muted text-muted-foreground',
};
const PAY_COLORS = {
  PAID: 'text-emerald-400',
  PARTIAL: 'text-amber-400',
  OVERDUE: 'text-red-400',
  PENDING: 'text-muted-foreground',
};

const EDITABLE_FIELDS = [
  { key: 'trace_no', label: 'Trace No', type: 'text' },
  { key: 'client_name', label: 'Client Name', type: 'text' },
  { key: 'draw_no', label: 'Draw No', type: 'text' },
  { key: 'drawdown_amount', label: 'Draw-Down Amount', type: 'number' },
  { key: 'drawdown_date', label: 'Draw-Down Date', type: 'date' },
  { key: 'attorney_interest_start_date', label: 'Interest Start Date', type: 'date' },
  { key: 'attorney_interest', label: 'Attorney Interest', type: 'number' },
  { key: 'funda_interest', label: 'Funda Interest', type: 'number' },
  { key: 'amount_attorney_paid', label: 'Amount Paid', type: 'number' },
  { key: 'new_capital_amount', label: 'New Capital Amount', type: 'number' },
  { key: 'payment_status', label: 'Pay Status', type: 'select', options: ['PENDING', 'PAID', 'PARTIAL', 'OVERDUE'] },
  { key: 'approved', label: 'Approved', type: 'select', options: ['YES', 'NO', 'PENDING', 'CANCELLED'] },
  { key: 'notes', label: 'Notes', type: 'text' },
];

const PAGE_SIZE = 50;

export default function FirmTransactionsTab({ firmName, transactions, onTransactionUpdated, onTransactionsImported }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [payFilter, setPayFilter] = useState('All');
  const [sortField, setSortField] = useState('created_date');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const fileRef = useRef();

  const filtered = useMemo(() => {
    let data = [...transactions];
    const q = search.toLowerCase();
    if (q) {
      data = data.filter(t =>
        t.trace_no?.toLowerCase().includes(q) ||
        t.client_name?.toLowerCase().includes(q) ||
        t.draw_no?.toLowerCase().includes(q) ||
        t.expert_name?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'All') data = data.filter(t => t.approved === statusFilter);
    if (payFilter !== 'All') data = data.filter(t => t.payment_status === payFilter);
    data.sort((a, b) => {
      let va = a[sortField], vb = b[sortField];
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return data;
  }, [transactions, search, statusFilter, payFilter, sortField, sortDir]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
    setPage(1);
  };

  const startEdit = (t) => {
    setEditingId(t.id);
    setEditForm({ ...t });
  };

  const cancelEdit = () => { setEditingId(null); setEditForm({}); };

  const saveEdit = async () => {
    setSaving(true);
    const patch = {};
    EDITABLE_FIELDS.forEach(f => { patch[f.key] = editForm[f.key] ?? null; });
    await base44.entities.Transaction.update(editingId, patch);
    onTransactionUpdated(editingId, patch);
    setSaving(false);
    setEditingId(null);
    setEditForm({});
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    setImportMsg('');
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const res = await base44.functions.invoke('importTrackers', {
      file_url,
      skip_duplicates: true,
      dry_run: false,
      max_insert: 500,
    });
    const d = res.data;
    setImportMsg(`✓ Imported ${d.inserted} new records (${d.skipped_duplicates || 0} duplicates skipped)`);
    setImporting(false);
    if (d.inserted > 0 && onTransactionsImported) onTransactionsImported();
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronUp className="w-3 h-3 opacity-20" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />;
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="bg-input border border-border rounded-lg pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-52"
            />
          </div>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
            {['All', 'YES', 'PENDING', 'NO', 'CANCELLED'].map(v => <option key={v}>{v === 'All' ? 'All Status' : v}</option>)}
          </select>
          <select value={payFilter} onChange={e => { setPayFilter(e.target.value); setPage(1); }}
            className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
            {['All', 'PENDING', 'PAID', 'PARTIAL', 'OVERDUE'].map(v => <option key={v}>{v === 'All' ? 'All Pay Status' : v}</option>)}
          </select>
          <span className="text-xs text-muted-foreground">{filtered.length.toLocaleString()} records</span>
        </div>

        <div className="flex gap-2 items-center">
          {importMsg && (
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {importMsg}
            </span>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {importing ? 'Importing...' : 'Import Excel'}
          </button>
          <input ref={fileRef} type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleImport} />
          <Link
            to="/drawdown/new"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {[
                  { label: 'Trace No', field: 'trace_no' },
                  { label: 'Client Name', field: 'client_name' },
                  { label: 'Draw No', field: 'draw_no' },
                  { label: 'Draw-Down', field: 'drawdown_amount' },
                  { label: 'Interest Start', field: 'attorney_interest_start_date' },
                  { label: 'Amount Paid', field: 'amount_attorney_paid' },
                  { label: 'Status', field: 'approved' },
                  { label: 'Pay Status', field: 'payment_status' },
                  { label: '', field: null },
                ].map(({ label, field }) => (
                  <th key={label} className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide whitespace-nowrap">
                    {field ? (
                      <button onClick={() => handleSort(field)} className="flex items-center gap-1 hover:text-foreground transition-colors">
                        {label} <SortIcon field={field} />
                      </button>
                    ) : label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((t, i) => {
                const isEditing = editingId === t.id;
                return (
                  <tr key={t.id} className={`border-b border-border/50 ${i % 2 ? 'bg-muted/5' : ''} ${isEditing ? 'bg-primary/5' : 'hover:bg-muted/20'} transition-colors`}>
                    {isEditing ? (
                      <>
                        <td className="px-4 py-2">
                          <input value={editForm.trace_no || ''} onChange={e => setEditForm(f => ({ ...f, trace_no: e.target.value }))}
                            className="bg-input border border-border rounded px-2 py-1 text-xs w-28 focus:outline-none focus:ring-1 focus:ring-ring font-mono" />
                        </td>
                        <td className="px-4 py-2">
                          <input value={editForm.client_name || ''} onChange={e => setEditForm(f => ({ ...f, client_name: e.target.value }))}
                            className="bg-input border border-border rounded px-2 py-1 text-xs w-40 focus:outline-none focus:ring-1 focus:ring-ring" />
                        </td>
                        <td className="px-4 py-2">
                          <input value={editForm.draw_no || ''} onChange={e => setEditForm(f => ({ ...f, draw_no: e.target.value }))}
                            className="bg-input border border-border rounded px-2 py-1 text-xs w-24 focus:outline-none focus:ring-1 focus:ring-ring" />
                        </td>
                        <td className="px-4 py-2">
                          <input type="number" value={editForm.drawdown_amount ?? ''} onChange={e => setEditForm(f => ({ ...f, drawdown_amount: e.target.value === '' ? null : Number(e.target.value) }))}
                            className="bg-input border border-border rounded px-2 py-1 text-xs w-28 focus:outline-none focus:ring-1 focus:ring-ring" />
                        </td>
                        <td className="px-4 py-2">
                          <input type="date" value={editForm.attorney_interest_start_date || ''} onChange={e => setEditForm(f => ({ ...f, attorney_interest_start_date: e.target.value || null }))}
                            className="bg-input border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
                        </td>
                        <td className="px-4 py-2">
                          <input type="number" value={editForm.amount_attorney_paid ?? ''} onChange={e => setEditForm(f => ({ ...f, amount_attorney_paid: e.target.value === '' ? null : Number(e.target.value) }))}
                            className="bg-input border border-border rounded px-2 py-1 text-xs w-28 focus:outline-none focus:ring-1 focus:ring-ring" />
                        </td>
                        <td className="px-4 py-2">
                          <select value={editForm.approved || 'PENDING'} onChange={e => setEditForm(f => ({ ...f, approved: e.target.value }))}
                            className="bg-input border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
                            {['YES', 'NO', 'PENDING', 'CANCELLED'].map(v => <option key={v}>{v}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <select value={editForm.payment_status || 'PENDING'} onChange={e => setEditForm(f => ({ ...f, payment_status: e.target.value }))}
                            className="bg-input border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
                            {['PENDING', 'PAID', 'PARTIAL', 'OVERDUE'].map(v => <option key={v}>{v}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <div className="flex gap-1">
                            <button onClick={saveEdit} disabled={saving}
                              className="p-1.5 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors disabled:opacity-50">
                              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={cancelEdit} className="p-1.5 rounded bg-muted text-muted-foreground hover:text-foreground transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-mono text-xs text-primary whitespace-nowrap">{t.trace_no}</td>
                        <td className="px-4 py-3 text-foreground max-w-[180px] truncate">{t.client_name}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{t.draw_no || '—'}</td>
                        <td className="px-4 py-3 text-right font-medium text-foreground whitespace-nowrap">{fmt(t.drawdown_amount)}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{fmtDate(t.attorney_interest_start_date)}</td>
                        <td className="px-4 py-3 text-right text-foreground whitespace-nowrap">{fmt(t.amount_attorney_paid)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[t.approved] || 'bg-muted text-muted-foreground'}`}>
                            {t.approved || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium ${PAY_COLORS[t.payment_status] || 'text-muted-foreground'}`}>
                            {t.payment_status || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button onClick={() => startEdit(t)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <Link to={`/transaction/${t.id}`} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                              <Eye className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
              {paginated.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground text-sm">No transactions found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border">
            <p className="text-sm text-muted-foreground">Page {page} of {totalPages} · {filtered.length.toLocaleString()} records</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-sm disabled:opacity-40 hover:bg-secondary/80 transition-colors">Prev</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-sm disabled:opacity-40 hover:bg-secondary/80 transition-colors">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}