import { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Pin, PinOff, Settings2 } from 'lucide-react';

const fmt = (n) => n != null ? `R ${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 0 })}` : '—';

const WIDGET_DEFS = [
  {
    id: 'outstanding',
    label: 'Outstanding Balance',
    color: 'text-amber-400',
    border: 'border-amber-400/30',
    compute: (txns) => fmt(txns.filter(t => t.payment_status !== 'PAID').reduce((s, t) => s + Math.max(0, (Number(t.new_capital_amount) || Number(t.drawdown_amount) || 0) - (t.amount_attorney_paid || 0)), 0)),
  },
  {
    id: 'advanced',
    label: 'Total Advanced',
    color: 'text-primary',
    border: 'border-primary/30',
    compute: (txns) => fmt(txns.reduce((s, t) => s + (t.drawdown_amount || 0), 0)),
  },
  {
    id: 'paid',
    label: 'Total Repaid',
    color: 'text-emerald-400',
    border: 'border-emerald-400/30',
    compute: (txns) => fmt(txns.reduce((s, t) => s + (t.amount_attorney_paid || 0), 0)),
  },
  {
    id: 'settled',
    label: 'Settled Matters',
    color: 'text-blue-400',
    border: 'border-blue-400/30',
    compute: (txns) => txns.filter(t => t.payment_status === 'PAID').length,
  },
  {
    id: 'overdue',
    label: 'Overdue Transactions',
    color: 'text-red-400',
    border: 'border-red-400/30',
    compute: (txns) => txns.filter(t => t.payment_status === 'OVERDUE').length,
  },
  {
    id: 'total',
    label: 'Total Transactions',
    color: 'text-foreground',
    border: 'border-border',
    compute: (txns) => txns.length,
  },
  {
    id: 'funda_interest',
    label: 'Funda Interest Accrued',
    color: 'text-chart-3',
    border: 'border-blue-400/30',
    compute: (txns) => fmt(txns.reduce((s, t) => s + (t.funda_interest || 0), 0)),
  },
  {
    id: 'partial',
    label: 'Partial Payments',
    color: 'text-amber-400',
    border: 'border-amber-400/20',
    compute: (txns) => txns.filter(t => t.payment_status === 'PARTIAL').length,
  },
];

const DEFAULT_PINS = ['outstanding', 'advanced', 'paid', 'settled'];

export default function FirmPinnedWidgets({ transactions, pinnedWidgets, onPinsChange }) {
  const [editing, setEditing] = useState(false);
  const pins = pinnedWidgets && pinnedWidgets.length > 0 ? pinnedWidgets : DEFAULT_PINS;

  const pinned = WIDGET_DEFS.filter(w => pins.includes(w.id));
  const unpinned = WIDGET_DEFS.filter(w => !pins.includes(w.id));

  const togglePin = async (id) => {
    const next = pins.includes(id) ? pins.filter(p => p !== id) : [...pins, id];
    onPinsChange(next);
    await base44.auth.updateMe({ pinned_widgets: next });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-space font-semibold text-foreground text-sm flex items-center gap-2">
          <Pin className="w-4 h-4 text-primary" />
          My Dashboard
        </h2>
        <button
          onClick={() => setEditing(e => !e)}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${editing ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'}`}
        >
          <Settings2 className="w-3.5 h-3.5" />
          {editing ? 'Done' : 'Customise'}
        </button>
      </div>

      {/* Pinned widgets grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {pinned.map(w => (
          <div key={w.id} className={`relative bg-card border rounded-xl p-4 ${w.border} group transition-all`}>
            {editing && (
              <button
                onClick={() => togglePin(w.id)}
                className="absolute top-2 right-2 p-1 rounded-md bg-red-400/10 text-red-400 hover:bg-red-400/20 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Unpin"
              >
                <PinOff className="w-3 h-3" />
              </button>
            )}
            {/* Hex accent */}
            <div className="absolute bottom-2 right-3 opacity-5">
              <svg viewBox="0 0 40 35" width="40" height="35">
                <polygon points="20,1 39,10.5 39,24.5 20,34 1,24.5 1,10.5" fill="currentColor" className="text-primary" />
              </svg>
            </div>
            <p className="text-xs text-muted-foreground font-medium">{w.label}</p>
            <p className={`mt-1.5 text-xl font-space font-bold ${w.color}`}>{w.compute(transactions)}</p>
          </div>
        ))}
      </div>

      {/* Edit panel — add more widgets */}
      {editing && unpinned.length > 0 && (
        <div className="bg-muted/30 border border-border/60 border-dashed rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-semibold mb-3 uppercase tracking-wide">Add to dashboard</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {unpinned.map(w => (
              <button
                key={w.id}
                onClick={() => togglePin(w.id)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:border-primary hover:bg-primary/5 text-xs text-muted-foreground hover:text-primary transition-all"
              >
                <Pin className="w-3 h-3 flex-shrink-0" />
                {w.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}