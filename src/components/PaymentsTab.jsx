import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, Loader2, DollarSign } from 'lucide-react';

const PAYMENT_TYPES = [
  'Drawdown Repayment',
  'New Capital Balance',
  'Funda Interest',
  'Attorney Interest',
  'Full Settlement',
];

const TYPE_COLORS = {
  'Drawdown Repayment': 'bg-blue-400/15 text-blue-400',
  'New Capital Balance': 'bg-amber-400/15 text-amber-400',
  'Funda Interest': 'bg-purple-400/15 text-purple-400',
  'Attorney Interest': 'bg-orange-400/15 text-orange-400',
  'Full Settlement': 'bg-emerald-400/15 text-emerald-400',
};

const fmt = (n) => `R ${Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-ZA') : '—';

const EMPTY_ENTRY = { payment_date: '', amount: '', payment_type: 'Drawdown Repayment', notes: '' };

export default function PaymentsTab({ transactionId, traceNo, lawFirm }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [entry, setEntry] = useState(EMPTY_ENTRY);

  useEffect(() => {
    base44.entities.Payment.filter({ transaction_id: transactionId }, '-payment_date', 200)
      .then(data => { setPayments(data); setLoading(false); });
  }, [transactionId]);

  const handleAdd = async () => {
    if (!entry.payment_date || !entry.amount || !entry.payment_type) return;
    setSaving(true);
    const created = await base44.entities.Payment.create({
      transaction_id: transactionId,
      trace_no: traceNo,
      law_firm: lawFirm,
      payment_date: entry.payment_date,
      amount: Number(entry.amount),
      payment_type: entry.payment_type,
      notes: entry.notes,
    });
    setPayments(prev => [created, ...prev]);
    setEntry(EMPTY_ENTRY);
    setShowForm(false);
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this payment entry?')) return;
    await base44.entities.Payment.delete(id);
    setPayments(prev => prev.filter(p => p.id !== id));
  };

  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);

  if (loading) return (
    <div className="flex items-center justify-center h-24">
      <Loader2 className="w-5 h-5 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-primary" />
          <span className="text-sm text-muted-foreground">Total Recorded:</span>
          <span className="text-sm font-semibold text-foreground">{fmt(totalPaid)}</span>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Payment
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">New Payment Entry</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Date *</label>
              <input
                type="date"
                value={entry.payment_date}
                onChange={e => setEntry(p => ({ ...p, payment_date: e.target.value }))}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Amount (R) *</label>
              <input
                type="number"
                value={entry.amount}
                onChange={e => setEntry(p => ({ ...p, amount: e.target.value }))}
                placeholder="0.00"
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Payment Type *</label>
              <select
                value={entry.payment_type}
                onChange={e => setEntry(p => ({ ...p, payment_type: e.target.value }))}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {PAYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Notes</label>
              <input
                type="text"
                value={entry.notes}
                onChange={e => setEntry(p => ({ ...p, notes: e.target.value }))}
                placeholder="Optional"
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleAdd}
              disabled={saving || !entry.payment_date || !entry.amount}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Save Entry
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Payment list */}
      {payments.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">No payment entries yet.</div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs">Date</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs">Type</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium text-xs">Amount</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs">Notes</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => (
                <tr key={p.id} className={`border-t border-border/50 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                  <td className="px-4 py-3 text-foreground whitespace-nowrap">{fmtDate(p.payment_date)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[p.payment_type] || 'bg-muted text-muted-foreground'}`}>
                      {p.payment_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-foreground">{fmt(p.amount)}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs max-w-[160px] truncate">{p.notes || '—'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(p.id)} className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}