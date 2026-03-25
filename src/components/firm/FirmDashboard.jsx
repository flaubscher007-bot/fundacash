import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { CheckCircle2, Clock, AlertTriangle, TrendingUp, Eye, Download } from 'lucide-react';
import { exportTransactionsCsv } from '../../utils/exportCsv';

const fmt = (n) => `R ${Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 0 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function FirmDashboard({ firmName, transactions, agreement }) {
  const handleExport = () => {
    const slug = firmName.replace(/\s+/g, '_').toLowerCase();
    exportTransactionsCsv(transactions, `${slug}_transactions.csv`);
  };
  const active = transactions.filter(t => t.approved !== 'CANCELLED');

  const stats = useMemo(() => {
    const drawdown = active.reduce((s, t) => s + (t.drawdown_amount || 0), 0);
    const paid = active.reduce((s, t) => s + (t.amount_attorney_paid || 0), 0);
    const fundaInterest = active.reduce((s, t) => s + (t.funda_interest || 0), 0);
    const attorneyInterest = active.reduce((s, t) => s + (t.attorney_interest || 0), 0);
    const outstanding = Math.max(0, drawdown - paid);
    const settled = active.filter(t => t.payment_status === 'PAID').length;
    const overdue = active.filter(t => t.payment_status === 'OVERDUE').length;
    const partial = active.filter(t => t.payment_status === 'PARTIAL').length;
    return { drawdown, paid, fundaInterest, attorneyInterest, outstanding, settled, overdue, partial };
  }, [active]);

  // Monthly drawdown trend (last 12 months)
  const monthlyData = useMemo(() => {
    const map = {};
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map[key] = { month: d.toLocaleString('en-ZA', { month: 'short', year: '2-digit' }), drawdown: 0, repaid: 0 };
    }
    for (const t of active) {
      if (t.drawdown_date) {
        const key = t.drawdown_date.slice(0, 7);
        if (map[key]) map[key].drawdown += t.drawdown_amount || 0;
      }
      if (t.settlement_payment_date) {
        const key = t.settlement_payment_date.slice(0, 7);
        if (map[key]) map[key].repaid += t.amount_attorney_paid || 0;
      }
    }
    return Object.values(map);
  }, [active]);

  // Draw groups
  const drawGroups = useMemo(() => {
    const map = {};
    for (const t of active) {
      const draw = t.draw_no || '(No Draw)';
      if (!map[draw]) map[draw] = { draw, count: 0, total: 0, paid: 0 };
      map[draw].count++;
      map[draw].total += t.drawdown_amount || 0;
      map[draw].paid += t.amount_attorney_paid || 0;
    }
    return Object.values(map).sort((a, b) => a.draw.localeCompare(b.draw));
  }, [active]);

  // Projected repayments based on payment terms
  const projected = useMemo(() => {
    if (!agreement?.payment_terms_days) return null;
    const termsDays = agreement.payment_terms_days;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const buckets = { d30: 0, d60: 0, d90: 0, d30count: 0, d60count: 0, d90count: 0 };
    for (const t of active) {
      if (!t.drawdown_date || !t.drawdown_amount || t.payment_status === 'PAID' || t.approved !== 'YES') continue;
      const due = new Date(t.drawdown_date);
      due.setDate(due.getDate() + termsDays);
      const daysUntilDue = Math.floor((due - today) / (1000 * 60 * 60 * 24));
      const outstanding = Math.max(0, (Number(t.new_capital_amount) || (Number(t.drawdown_amount) + Number(t.funda_interest || 0))) - (t.amount_attorney_paid || 0));
      if (daysUntilDue >= 0 && daysUntilDue <= 30)  { buckets.d30 += outstanding; buckets.d30count++; }
      if (daysUntilDue >= 0 && daysUntilDue <= 60)  { buckets.d60 += outstanding; buckets.d60count++; }
      if (daysUntilDue >= 0 && daysUntilDue <= 90)  { buckets.d90 += outstanding; buckets.d90count++; }
    }
    return buckets;
  }, [active, agreement]);

  // Recent unpaid transactions
  const unpaid = active
    .filter(t => t.payment_status !== 'PAID' && t.drawdown_amount > 0)
    .sort((a, b) => new Date(a.drawdown_date || 0) - new Date(b.drawdown_date || 0))
    .slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Export button */}
      <div className="flex justify-end">
        <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="Drawdown Amount" value={fmt(stats.drawdown)} sub={`${active.length} transactions`} color="text-primary" />
        <KpiCard label="Outstanding Capital" value={fmt(stats.outstanding)} sub={`${stats.partial} partial payments`} color="text-amber-400" />
        <KpiCard label="Funda Interest" value={fmt(stats.fundaInterest)} sub={agreement ? `${agreement.funda_interest_rate}% p.a.` : 'No agreement'} color="text-emerald-400" />
        <KpiCard label="Attorney Interest" value={fmt(stats.attorneyInterest)} sub={agreement ? `${agreement.attorney_interest_rate}% p.a.` : '—'} color="text-chart-3" />
        <KpiCard label="Total Repaid" value={fmt(stats.paid)} sub={`${stats.settled} settled`} color="text-blue-400" />
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-3">
        <StatusPill icon={CheckCircle2} color="emerald" label="Settled" count={stats.settled} />
        <StatusPill icon={Clock} color="amber" label="Pending" count={active.filter(t => t.payment_status === 'PENDING').length} />
        <StatusPill icon={AlertTriangle} color="red" label="Overdue" count={stats.overdue} />
        <StatusPill icon={TrendingUp} color="blue" label="Partial" count={stats.partial} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Monthly trend */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-space font-semibold text-foreground mb-4 text-sm">Monthly Drawdown vs Repayment</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthlyData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 11 }}
                formatter={(v, name) => [fmt(v), name]}
              />
              <Line type="monotone" dataKey="drawdown" name="Drawdown" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="repaid" name="Repaid" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Draw group bar */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-space font-semibold text-foreground mb-4 text-sm">By Draw Number</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={drawGroups} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="draw" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 11 }}
                formatter={(v, name) => [fmt(v), name]}
              />
              <Bar dataKey="total" name="Advanced" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="paid" name="Repaid" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Projected Repayments */}
      {projected ? (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-space font-semibold text-foreground text-sm">Projected Repayments</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Based on {agreement.payment_terms_days}-day payment terms · outstanding approved drawdowns</p>
          </div>
          <div className="grid grid-cols-3 divide-x divide-border">
            {[
              { label: 'Next 30 Days', amount: projected.d30, count: projected.d30count, color: 'text-emerald-400', bg: 'bg-emerald-400/5' },
              { label: 'Next 60 Days', amount: projected.d60, count: projected.d60count, color: 'text-amber-400', bg: 'bg-amber-400/5' },
              { label: 'Next 90 Days', amount: projected.d90, count: projected.d90count, color: 'text-blue-400', bg: 'bg-blue-400/5' },
            ].map(({ label, amount, count, color, bg }) => (
              <div key={label} className={`px-5 py-5 ${bg}`}>
                <p className="text-xs text-muted-foreground font-medium">{label}</p>
                <p className={`mt-1.5 text-2xl font-space font-bold ${color}`}>{fmt(amount)}</p>
                <p className="text-xs text-muted-foreground mt-1">{count} transaction{count !== 1 ? 's' : ''} due</p>
              </div>
            ))}
          </div>
        </div>
      ) : agreement === null ? (
        <div className="px-5 py-4 bg-card border border-border rounded-xl text-xs text-muted-foreground">
          ⚠ No agreement configured — set payment terms in the Agreements tab to enable projected repayments.
        </div>
      ) : null}

      {/* Unpaid transactions */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-space font-semibold text-foreground text-sm">Outstanding Transactions</h3>
          <span className="text-xs text-muted-foreground">{unpaid.length} shown</span>
        </div>
        <div className="divide-y divide-border/60">
          {unpaid.length === 0 && (
            <p className="text-center py-8 text-muted-foreground text-sm">All transactions settled.</p>
          )}
          {unpaid.map(t => {
            const outstanding = Math.max(0, (t.new_capital_amount || t.drawdown_amount || 0) - (t.amount_attorney_paid || 0));
            return (
              <div key={t.id} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/20 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{t.client_name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{t.trace_no} · {t.draw_no} · Interest from {fmtDate(t.attorney_interest_start_date)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-amber-400">{fmt(outstanding)}</p>
                  <PayStatusBadge status={t.payment_status} />
                </div>
                <Link to={`/drawdown/${t.id}`} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                  <Eye className="w-3.5 h-3.5" />
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, color }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className={`mt-1 text-xl font-space font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function StatusPill({ icon: Icon, color, label, count }) {
  const colors = { emerald: 'bg-emerald-400/10 text-emerald-400', amber: 'bg-amber-400/10 text-amber-400', red: 'bg-red-400/10 text-red-400', blue: 'bg-blue-400/10 text-blue-400' };
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${colors[color]}`}>
      <Icon className="w-3.5 h-3.5" />
      {count} {label}
    </div>
  );
}

function PayStatusBadge({ status }) {
  const map = { PAID: 'text-emerald-400', PARTIAL: 'text-amber-400', OVERDUE: 'text-red-400', PENDING: 'text-muted-foreground' };
  return <span className={`text-xs font-medium ${map[status] || 'text-muted-foreground'}`}>{status || '—'}</span>;
}