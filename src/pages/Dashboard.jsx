import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { TrendingUp, DollarSign, FileText, Clock, Building2, CheckCircle } from 'lucide-react';
import StatCard from '../components/StatCard';
import FirmExposureChart from '../components/FirmExposureChart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Link } from 'react-router-dom';

const FIRMS = ['S STEYN INCORPORATED', 'LHL ATTORNEYS', 'DBVS ATTORNEYS', 'RH LAWYERS', 'A WOLMARANS INCORPORATED'];
const FIRM_COLORS = ['#F59E0B', '#34D399', '#60A5FA', '#A78BFA', '#F87171'];

const fmt = (n) => `R ${Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function Dashboard() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Transaction.list('-created_date', 2000).then(data => {
      setTransactions(data);
      setLoading(false);
    });
  }, []);

  const totalDrawdown = transactions.reduce((s, t) => s + (t.drawdown_amount || 0), 0);
  const totalFundaInterest = transactions.reduce((s, t) => s + (t.funda_interest || 0), 0);
  const totalAttorneyInterest = transactions.reduce((s, t) => s + (t.attorney_interest || 0), 0);
  const totalNewCapital = transactions.reduce((s, t) => {
    const nc = Number(t.new_capital_amount) || (Number(t.drawdown_amount || 0) + Number(t.funda_interest || 0));
    return s + nc;
  }, 0);
  const totalSettled = transactions.filter(t => t.payment_status === 'PAID').reduce((s, t) => s + (t.amount_attorney_paid || 0), 0);
  const activeCount = transactions.filter(t => t.approved !== 'CANCELLED').length;
  const pendingPayment = transactions.filter(t => !t.amount_attorney_paid && t.drawdown_amount > 0).length;

  // Per firm bar chart data
  const firmData = FIRMS.map(firm => {
    const firmTxns = transactions.filter(t => t.law_firm === firm);
    return {
      name: firm.replace(' INCORPORATED', ' Inc').replace(' ATTORNEYS', '').replace(' LAWYERS', ''),
      drawdown: firmTxns.reduce((s, t) => s + (t.drawdown_amount || 0), 0),
      paid: firmTxns.reduce((s, t) => s + (t.amount_attorney_paid || 0), 0),
    };
  });

  const pieData = FIRMS.map((firm, i) => ({
    name: firm.replace(' INCORPORATED', ' Inc').replace(' ATTORNEYS', '').replace(' LAWYERS', ''),
    value: transactions.filter(t => t.law_firm === firm).reduce((s, t) => s + (t.drawdown_amount || 0), 0),
    color: FIRM_COLORS[i],
  })).filter(d => d.value > 0);

  // Recent transactions
  const recent = [...transactions].slice(0, 10);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-space text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Medical Legal Funding Overview — {transactions.length.toLocaleString()} total transactions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard title="Total Draw-Downs" value={fmt(totalDrawdown)} icon={TrendingUp} color="primary" />
        <StatCard title="Total Invoiced" value={fmt(totalInvoiced)} icon={DollarSign} color="blue" />
        <StatCard title="Total Repaid" value={fmt(totalPaid)} icon={CheckCircle} color="green" />
        <StatCard title="Interest Accrued" value={fmt(totalInterest)} icon={Clock} color="amber" />
        <StatCard title="Active Transactions" value={activeCount.toLocaleString()} icon={FileText} color="primary" />
        <StatCard title="Awaiting Payment" value={pendingPayment.toLocaleString()} icon={Building2} color="red" />
      </div>

      {/* Firm Exposure Chart */}
      <FirmExposureChart transactions={transactions} />

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Bar Chart */}
        <div className="xl:col-span-2 bg-card border border-border rounded-xl p-6">
          <h2 className="font-space font-semibold text-foreground mb-4">Draw-Downs vs Repayments by Firm</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={firmData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={v => `R${(v/1000000).toFixed(1)}M`} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(v) => [fmt(v)]}
              />
              <Bar dataKey="drawdown" name="Draw-Down" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
              <Bar dataKey="paid" name="Repaid" fill="hsl(var(--chart-2))" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="font-space font-semibold text-foreground mb-4">Funding Distribution</h2>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                formatter={(v) => [fmt(v)]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-1.5">
            {pieData.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                  <span className="text-muted-foreground truncate max-w-[120px]">{d.name}</span>
                </div>
                <span className="text-foreground font-medium">{fmt(d.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-space font-semibold text-foreground">Recent Transactions</h2>
          <Link to="/transactions" className="text-sm text-primary hover:text-primary/80 transition-colors">View all →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-6 py-3 text-muted-foreground font-medium">Trace No</th>
                <th className="text-left px-6 py-3 text-muted-foreground font-medium">Client</th>
                <th className="text-left px-6 py-3 text-muted-foreground font-medium">Firm</th>
                <th className="text-left px-6 py-3 text-muted-foreground font-medium">Draw No</th>
                <th className="text-right px-6 py-3 text-muted-foreground font-medium">Amount</th>
                <th className="text-center px-6 py-3 text-muted-foreground font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((t, i) => (
                <tr key={t.id} className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                  <td className="px-6 py-3 font-mono text-xs text-primary">{t.trace_no}</td>
                  <td className="px-6 py-3 text-foreground max-w-[160px] truncate">{t.client_name}</td>
                  <td className="px-6 py-3 text-muted-foreground text-xs">{t.law_firm?.split(' ')[0]}</td>
                  <td className="px-6 py-3 text-muted-foreground">{t.draw_no}</td>
                  <td className="px-6 py-3 text-right font-medium text-foreground">{fmt(t.drawdown_amount)}</td>
                  <td className="px-6 py-3 text-center">
                    <StatusBadge status={t.approved} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
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
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-muted text-muted-foreground'}`}>
      {status || '—'}
    </span>
  );
}