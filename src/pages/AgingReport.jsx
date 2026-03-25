import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, CheckCircle2, Clock, Building2 } from 'lucide-react';

const FIRMS = ['S STEYN INCORPORATED', 'LHL ATTORNEYS', 'DBVS ATTORNEYS', 'RH LAWYERS', 'A WOLMARANS INCORPORATED'];
const fmt = (n) => `R ${Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function daysElapsed(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today - d) / (1000 * 60 * 60 * 24));
}

function AgingBadge({ days, termsDays }) {
  if (days === null) return <span className="text-muted-foreground text-xs">No date</span>;
  if (!termsDays) return <span className="text-xs text-muted-foreground">{days}d elapsed</span>;
  const overdue = days > termsDays;
  const daysOverdue = days - termsDays;
  if (overdue) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-400/15 text-red-400">
        <AlertTriangle className="w-3 h-3" /> {daysOverdue}d overdue
      </span>
    );
  }
  const remaining = termsDays - days;
  const pct = days / termsDays;
  const color = pct > 0.8 ? 'bg-amber-400/15 text-amber-400' : 'bg-emerald-400/15 text-emerald-400';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      <Clock className="w-3 h-3" /> {remaining}d left
    </span>
  );
}

export default function AgingReport() {
  const [transactions, setTransactions] = useState([]);
  const [agreements, setAgreements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFirm, setSelectedFirm] = useState('All');

  useEffect(() => {
    Promise.all([
      base44.entities.Transaction.list('-drawdown_date', 5000),
      base44.entities.FirmAgreement.list(),
    ]).then(([txns, ags]) => {
      setTransactions(txns);
      setAgreements(ags);
      setLoading(false);
    });
  }, []);

  const agreementMap = useMemo(() => {
    const map = {};
    for (const ag of agreements) map[ag.firm_name] = ag;
    return map;
  }, [agreements]);

  // Only show outstanding (not fully paid) approved transactions with drawdown
  const outstanding = useMemo(() => {
    return transactions.filter(t =>
      t.drawdown_amount > 0 &&
      t.approved === 'YES' &&
      t.payment_status !== 'PAID'
    ).map(t => {
      const ag = agreementMap[t.law_firm];
      const termsDays = ag?.payment_terms_days || null;
      const days = daysElapsed(t.drawdown_date);
      const balance = Number(t.new_capital_amount) || (Number(t.drawdown_amount || 0) + Number(t.funda_interest || 0));
      const paid = Number(t.amount_attorney_paid || 0);
      const outstanding = Math.max(0, balance - paid);
      const isOverdue = termsDays !== null && days !== null && days > termsDays;
      return { ...t, termsDays, days, balance, paid, outstanding, isOverdue, ag };
    });
  }, [transactions, agreementMap]);

  const filtered = selectedFirm === 'All' ? outstanding : outstanding.filter(t => t.law_firm === selectedFirm);

  const firmSummaries = useMemo(() => {
    return FIRMS.map(firm => {
      const firmTxns = outstanding.filter(t => t.law_firm === firm);
      const totalOutstanding = firmTxns.reduce((s, t) => s + t.outstanding, 0);
      const overdueCount = firmTxns.filter(t => t.isOverdue).length;
      const overdueAmount = firmTxns.filter(t => t.isOverdue).reduce((s, t) => s + t.outstanding, 0);
      const ag = agreementMap[firm];
      return { firm, totalOutstanding, overdueCount, overdueAmount, count: firmTxns.length, ag };
    }).filter(f => f.count > 0);
  }, [outstanding, agreementMap]);

  const totalOverdue = filtered.filter(t => t.isOverdue).reduce((s, t) => s + t.outstanding, 0);
  const totalOutstanding = filtered.reduce((s, t) => s + t.outstanding, 0);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-space text-3xl font-bold text-foreground">Aging Report</h1>
        <p className="text-muted-foreground mt-1">Outstanding balances vs payment terms — approved drawdowns only</p>
      </div>

      {/* Summary by Firm */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {firmSummaries.map(({ firm, totalOutstanding, overdueCount, overdueAmount, count, ag }) => (
          <button
            key={firm}
            onClick={() => setSelectedFirm(selectedFirm === firm ? 'All' : firm)}
            className={`text-left bg-card border rounded-xl p-4 transition-all ${
              selectedFirm === firm ? 'border-primary ring-1 ring-primary' : overdueCount > 0 ? 'border-red-400/40 hover:border-red-400/70' : 'border-border hover:border-primary/40'
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm font-semibold text-foreground leading-tight">{firm}</span>
              </div>
              {overdueCount > 0 && (
                <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-red-400/15 text-red-400">
                  <AlertTriangle className="w-3 h-3" /> {overdueCount} overdue
                </span>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Outstanding ({count} txns)</span>
                <span className="font-semibold text-foreground">{fmt(totalOutstanding)}</span>
              </div>
              {overdueAmount > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-red-400">Overdue amount</span>
                  <span className="font-semibold text-red-400">{fmt(overdueAmount)}</span>
                </div>
              )}
              {ag?.payment_terms_days && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Payment terms</span>
                  <span className="text-muted-foreground">{ag.payment_terms_days} days</span>
                </div>
              )}
            </div>
          </button>
        ))}
        {firmSummaries.length === 0 && (
          <div className="col-span-3 text-center py-8 text-muted-foreground">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
            No outstanding balances
          </div>
        )}
      </div>

      {/* Totals bar */}
      {filtered.length > 0 && (
        <div className="flex flex-wrap gap-4 px-5 py-4 bg-card border border-border rounded-xl">
          <div>
            <p className="text-xs text-muted-foreground">Total Outstanding</p>
            <p className="text-xl font-space font-semibold text-foreground">{fmt(totalOutstanding)}</p>
          </div>
          <div className="w-px bg-border" />
          <div>
            <p className="text-xs text-red-400">Overdue</p>
            <p className="text-xl font-space font-semibold text-red-400">{fmt(totalOverdue)}</p>
          </div>
          <div className="w-px bg-border" />
          <div>
            <p className="text-xs text-muted-foreground">Transactions</p>
            <p className="text-xl font-space font-semibold text-foreground">{filtered.length}</p>
          </div>
          {selectedFirm !== 'All' && (
            <button onClick={() => setSelectedFirm('All')} className="ml-auto text-xs text-primary hover:underline self-center">
              Clear filter
            </button>
          )}
        </div>
      )}

      {/* Detail table */}
      {filtered.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {['Trace No', 'Client', 'Firm', 'Drawdown Date', 'Draw-Down', 'Balance', 'Paid', 'Outstanding', 'Aging'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.sort((a, b) => (b.days || 0) - (a.days || 0)).map((t, i) => (
                  <tr key={t.id} className={`border-b border-border/50 transition-colors ${t.isOverdue ? 'bg-red-400/5 hover:bg-red-400/10' : i % 2 ? 'bg-muted/5 hover:bg-muted/20' : 'hover:bg-muted/20'}`}>
                    <td className="px-4 py-3 font-mono text-xs text-primary whitespace-nowrap">{t.trace_no}</td>
                    <td className="px-4 py-3 text-foreground max-w-[160px] truncate">{t.client_name}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{t.law_firm?.split(' ')[0]}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{fmtDate(t.drawdown_date)}</td>
                    <td className="px-4 py-3 text-right text-foreground whitespace-nowrap">{fmt(t.drawdown_amount)}</td>
                    <td className="px-4 py-3 text-right text-foreground whitespace-nowrap">{fmt(t.balance)}</td>
                    <td className="px-4 py-3 text-right text-emerald-400 whitespace-nowrap">{t.paid > 0 ? fmt(t.paid) : '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                      <span className={t.isOverdue ? 'text-red-400' : 'text-foreground'}>{fmt(t.outstanding)}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <AgingBadge days={t.days} termsDays={t.termsDays} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}