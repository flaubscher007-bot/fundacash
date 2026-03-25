import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const FIRMS = ['S STEYN INCORPORATED', 'LHL ATTORNEYS', 'DBVS ATTORNEYS', 'RH LAWYERS', 'A WOLMARANS INCORPORATED'];
const FIRM_SHORT = { 'S STEYN INCORPORATED': 'S Steyn', 'LHL ATTORNEYS': 'LHL', 'DBVS ATTORNEYS': 'DBVS', 'RH LAWYERS': 'RH', 'A WOLMARANS INCORPORATED': 'Wolmarans' };
const fmt = (n) => n >= 1000000 ? `R${(n/1000000).toFixed(1)}M` : n >= 1000 ? `R${(n/1000).toFixed(0)}k` : `R${n}`;
const fmtFull = (n) => `R ${Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 0 })}`;

export default function FirmExposureChart({ transactions }) {
  const data = useMemo(() => FIRMS.map(firm => {
    const txns = transactions.filter(t => t.law_firm === firm && t.approved !== 'CANCELLED');
    const drawdown = txns.reduce((s, t) => s + (t.drawdown_amount || 0), 0);
    const paid = txns.reduce((s, t) => s + (t.amount_attorney_paid || 0), 0);
    const fundaInterest = txns.reduce((s, t) => s + (t.funda_interest || 0), 0);
    const outstanding = Math.max(0, drawdown - paid);
    return {
      name: FIRM_SHORT[firm],
      'Drawdown': Math.round(drawdown),
      'Outstanding': Math.round(outstanding),
      'Interest': Math.round(fundaInterest),
    };
  }).filter(d => d['Drawdown'] > 0), [transactions]);

  const totals = useMemo(() => ({
    drawdown: transactions.reduce((s, t) => s + (t.drawdown_amount || 0), 0),
    outstanding: transactions.reduce((s, t) => s + Math.max(0, (t.drawdown_amount || 0) - (t.amount_attorney_paid || 0)), 0),
    interest: transactions.reduce((s, t) => s + (t.funda_interest || 0), 0),
  }), [transactions]);

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-6">
      <div>
        <h2 className="font-space font-semibold text-foreground">Financial Exposure by Firm</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Drawdown capital, outstanding balance & accrued interest</p>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Deployed', value: totals.drawdown, color: 'text-primary' },
          { label: 'Outstanding Capital', value: totals.outstanding, color: 'text-amber-400' },
          { label: 'Interest Accrued', value: totals.interest, color: 'text-emerald-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-muted/30 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={`font-space font-bold text-base ${color}`}>{fmtFull(value)}</p>
          </div>
        ))}
      </div>

      {/* Stacked bar chart */}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
          <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={fmt} />
          <Tooltip
            contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
            formatter={(v, name) => [fmtFull(v), name]}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }} />
          <Bar dataKey="Drawdown" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
          <Bar dataKey="Outstanding" fill="hsl(38 92% 40%)" radius={[4,4,0,0]} />
          <Bar dataKey="Interest" fill="hsl(var(--chart-2))" radius={[4,4,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}