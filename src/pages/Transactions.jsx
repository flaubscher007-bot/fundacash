import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, Plus, ChevronUp, ChevronDown, Eye, CheckCircle2, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

const FIRMS = ['All', 'S STEYN INCORPORATED', 'LHL ATTORNEYS', 'DBVS ATTORNEYS', 'RH LAWYERS', 'A WOLMARANS INCORPORATED'];
const fmt = (n) => n ? `R ${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '—';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [firmFilter, setFirmFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [drawFilter, setDrawFilter] = useState('All');
  const [sortField, setSortField] = useState('created_date');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  useEffect(() => {
    base44.entities.Transaction.list('-created_date', 5000).then(data => {
      setTransactions(data);
      setLoading(false);
    });
  }, []);

  const drawNos = useMemo(() => {
    const set = new Set(transactions.map(t => t.draw_no).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [transactions]);

  const filtered = useMemo(() => {
    let data = transactions;
    if (firmFilter !== 'All') data = data.filter(t => t.law_firm === firmFilter);
    if (statusFilter !== 'All') data = data.filter(t => t.approved === statusFilter);
    if (drawFilter !== 'All') data = data.filter(t => t.draw_no === drawFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(t =>
        t.client_name?.toLowerCase().includes(q) ||
        t.trace_no?.toLowerCase().includes(q) ||
        t.attorney_ref_no?.toLowerCase().includes(q) ||
        t.expert_name?.toLowerCase().includes(q) ||
        t.invoice_no?.toLowerCase().includes(q)
      );
    }
    // Sort
    data = [...data].sort((a, b) => {
      let va = a[sortField], vb = b[sortField];
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return data;
  }, [transactions, firmFilter, statusFilter, drawFilter, search, sortField, sortDir]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
    setPage(1);
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronUp className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-space text-3xl font-bold text-foreground">Transactions</h1>
          <p className="text-muted-foreground mt-1">{filtered.length.toLocaleString()} of {transactions.length.toLocaleString()} records</p>
        </div>
        <Link to="/drawdown/new" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> New Draw-Down
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search client, trace no, expert, invoice..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-input border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterSelect label="Firm" value={firmFilter} options={FIRMS.map(f => ({ value: f, label: f === 'All' ? 'All Firms' : f.split(' ')[0] + (f.includes('INCORPORATED') ? ' Inc' : f.includes('ATTORNEYS') ? ' Att.' : '') }))} onChange={v => { setFirmFilter(v); setPage(1); }} />
          <FilterSelect label="Status" value={statusFilter} options={['All', 'YES', 'PENDING', 'NO', 'CANCELLED'].map(v => ({ value: v, label: v === 'All' ? 'All Status' : v }))} onChange={v => { setStatusFilter(v); setPage(1); }} />
          <FilterSelect label="Draw" value={drawFilter} options={drawNos.slice(0, 60).map(v => ({ value: v, label: v === 'All' ? 'All Draws' : v }))} onChange={v => { setDrawFilter(v); setPage(1); }} />
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
                  { label: 'Law Firm', field: 'law_firm' },
                  { label: 'Expert', field: 'expert_name' },
                  { label: 'Draw No', field: 'draw_no' },
                  { label: 'Draw-Down', field: 'drawdown_amount' },
                  { label: 'Interest Start', field: 'attorney_interest_start_date' },
                  { label: 'Amount Paid', field: 'amount_attorney_paid' },
                  { label: 'Status', field: 'approved' },
                  { label: 'Approve', field: null },
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
              {paginated.map((t, i) => (
                <tr key={t.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${i % 2 ? 'bg-muted/5' : ''}`}>
                  <td className="px-4 py-3 font-mono text-xs text-primary whitespace-nowrap">{t.trace_no}</td>
                  <td className="px-4 py-3 text-foreground max-w-[180px] truncate">{t.client_name}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{t.law_firm?.split(' ')[0]}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs max-w-[160px] truncate">{t.expert_name}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{t.draw_no}</td>
                  <td className="px-4 py-3 text-right font-medium text-foreground whitespace-nowrap">{fmt(t.drawdown_amount)}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{fmtDate(t.attorney_interest_start_date)}</td>
                  <td className="px-4 py-3 text-right text-foreground whitespace-nowrap">{fmt(t.amount_attorney_paid)}</td>
                  <td className="px-4 py-3"><StatusBadge status={t.approved} /></td>
                  <td className="px-4 py-3">
                    {t.approved === 'PENDING' && (
                      <ApproveButton txn={t} onApproved={(id) => setTransactions(prev => prev.map(x => x.id === id ? { ...x, approved: 'YES' } : x))} />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/drawdown/${t.id}`} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors inline-flex">
                      <Eye className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                  </tr>
                  ))}
              {paginated.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">No transactions found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border">
            <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-sm disabled:opacity-40 hover:bg-secondary/80 transition-colors">Prev</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-sm disabled:opacity-40 hover:bg-secondary/80 transition-colors">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ApproveButton({ txn, onApproved }) {
  const [loading, setLoading] = useState(false);
  const handleApprove = async () => {
    setLoading(true);
    await base44.entities.Transaction.update(txn.id, { approved: 'YES' });
    onApproved(txn.id);
    setLoading(false);
  };
  return (
    <button
      onClick={handleApprove}
      disabled={loading}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-400/15 text-emerald-400 hover:bg-emerald-400/25 text-xs font-semibold transition-colors disabled:opacity-60 whitespace-nowrap"
    >
      <CheckCircle2 className="w-3 h-3" />
      {loading ? 'Approving...' : 'Approve'}
    </button>
  );
}

function FilterSelect({ value, options, onChange }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function StatusBadge({ status }) {
  const map = {
    'YES': 'bg-emerald-400/15 text-emerald-400',
    'PENDING': 'bg-amber-400/15 text-amber-400',
    'NO': 'bg-red-400/15 text-red-400',
    'CANCELLED': 'bg-muted text-muted-foreground',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${map[status] || 'bg-muted text-muted-foreground'}`}>
      {status || '—'}
    </span>
  );
}