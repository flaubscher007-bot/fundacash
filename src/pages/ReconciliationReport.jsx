import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Upload, AlertTriangle, CheckCircle2, XCircle, Loader2,
  ChevronDown, ChevronRight, FileSearch, TrendingDown, TrendingUp, Minus
} from 'lucide-react';
import ReconciliationActions from '../components/ReconciliationActions';

const FIRMS = [
  'S STEYN INCORPORATED', 'LHL ATTORNEYS', 'DBVS ATTORNEYS',
  'RH LAWYERS', 'A WOLMARANS INCORPORATED'
];

const SEV_STYLES = {
  high:   { badge: 'bg-red-500/15 text-red-400 border border-red-500/30',   dot: 'bg-red-400',    label: 'High' },
  medium: { badge: 'bg-amber-400/15 text-amber-400 border border-amber-400/30', dot: 'bg-amber-400', label: 'Medium' },
  low:    { badge: 'bg-blue-400/15 text-blue-400 border border-blue-400/30',  dot: 'bg-blue-400',   label: 'Low' },
};

const fmt = (n) => n == null ? '—' : `R ${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDelta = (n) => {
  if (n == null) return null;
  const abs = Math.abs(n);
  return `${n > 0 ? '+' : '-'}R ${abs.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

function DeltaChip({ delta }) {
  if (delta === null) return <span className="text-muted-foreground text-xs">date/text</span>;
  const pos = delta > 0;
  const Icon = delta === 0 ? Minus : pos ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${pos ? 'text-amber-400' : 'text-red-400'}`}>
      <Icon className="w-3 h-3" />
      {fmtDelta(delta)}
    </span>
  );
}

function VarianceRow({ v }) {
  const [open, setOpen] = useState(false);
  const sev = SEV_STYLES[v.severity];
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sev.dot}`} />
        <span className="font-mono text-primary text-sm font-medium flex-shrink-0 w-36">{v.trace_no}</span>
        <span className="text-foreground text-sm flex-1 truncate">{v.client_name}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sev.badge}`}>{sev.label}</span>
        <span className="text-muted-foreground text-xs flex-shrink-0 mr-1">{v.diffs.length} field{v.diffs.length !== 1 ? 's' : ''}</span>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-border bg-muted/10 px-4 py-3">
          <div className="text-xs text-muted-foreground mb-2">{v.law_firm}</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left pb-2 pr-4 font-medium">Field</th>
                  <th className="text-right pb-2 pr-4 font-medium">Excel</th>
                  <th className="text-right pb-2 pr-4 font-medium">Database</th>
                  <th className="text-right pb-2 font-medium">Variance</th>
                </tr>
              </thead>
              <tbody>
                {v.diffs.map((d, i) => (
                  <tr key={i} className="border-t border-border/40">
                    <td className="py-2 pr-4 text-foreground font-medium">{d.field}</td>
                    <td className="py-2 pr-4 text-right text-amber-300">{typeof d.excel === 'number' ? fmt(d.excel) : d.excel ?? '—'}</td>
                    <td className="py-2 pr-4 text-right text-blue-300">{typeof d.db === 'number' ? fmt(d.db) : d.db ?? '—'}</td>
                    <td className="py-2 text-right"><DeltaChip delta={d.delta} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ReconciliationActions variance={v} onResolved={(traceNo, action) => console.log('Resolved', traceNo, action)} />
        </div>
      )}
    </div>
  );
}

export default function ReconciliationReport() {
  const [file, setFile] = useState(null);
  const [firm, setFirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all | high | medium | low

  const handleUpload = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    setError('');
    e.target.value = '';
  };

  const handleRun = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const res = await base44.functions.invoke('reconcileTrackers', {
        file_url,
        law_firm: firm || undefined,
      });
      setResult(res.data);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Reconciliation failed');
    }
    setLoading(false);
  };

  const variances = result?.variances || [];
  const filtered = filter === 'all' ? variances : variances.filter(v => v.severity === filter);

  const counts = {
    high: variances.filter(v => v.severity === 'high').length,
    medium: variances.filter(v => v.severity === 'medium').length,
    low: variances.filter(v => v.severity === 'low').length,
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-space text-2xl font-bold text-foreground flex items-center gap-3">
          <FileSearch className="w-6 h-6 text-primary" />
          Reconciliation Variance Report
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload a draw-down Excel statement to compare against internal transaction records and identify discrepancies.
        </p>
      </div>

      {/* Upload card */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h2 className="font-space font-semibold text-foreground">Upload Statement</h2>

        <div className="flex flex-col sm:flex-row gap-4 items-end">
          {/* Firm filter */}
          <div className="space-y-1.5 flex-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Filter by Firm (optional)</label>
            <select
              value={firm}
              onChange={e => setFirm(e.target.value)}
              className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">All Firms</option>
              {FIRMS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          {/* File picker */}
          <div className="space-y-1.5 flex-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Excel File</label>
            <label className="flex items-center gap-3 px-3 py-2.5 bg-input border border-border rounded-lg cursor-pointer hover:border-primary/60 transition-colors">
              <Upload className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm text-foreground truncate">{file ? file.name : 'Choose .xlsx / .xls / .csv'}</span>
              <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleUpload} />
            </label>
          </div>

          <button
            onClick={handleRun}
            disabled={!file || loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors disabled:opacity-50 flex-shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSearch className="w-4 h-4" />}
            {loading ? 'Analysing...' : 'Run Reconciliation'}
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-3 px-4 py-3 bg-destructive/10 border border-destructive/30 rounded-lg">
            <XCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </div>

      {/* Summary cards */}
      {result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <SummaryCard label="Matched Records" value={result.summary.matched} icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />} color="emerald" />
            <SummaryCard label="With Variance" value={result.summary.with_variance} icon={<AlertTriangle className="w-5 h-5 text-amber-400" />} color="amber" />
            <SummaryCard label="Excel Only" value={result.summary.excel_only} icon={<XCircle className="w-5 h-5 text-muted-foreground" />} color="muted" />
            <SummaryCard
              label="Settlement Δ"
              value={result.summary.total_settlement_delta != null
                ? `${result.summary.total_settlement_delta >= 0 ? '+' : ''}R ${Math.abs(result.summary.total_settlement_delta).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`
                : '—'
              }
              icon={<TrendingDown className="w-5 h-5 text-red-400" />}
              color="red"
            />
          </div>

          {/* Severity breakdown */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="font-space font-semibold text-foreground">
                Variance Details
                <span className="ml-2 text-muted-foreground font-normal text-sm">({filtered.length} of {variances.length})</span>
              </h2>
              <div className="flex gap-2 flex-wrap">
                {[['all', 'All', variances.length], ['high', 'High', counts.high], ['medium', 'Medium', counts.medium], ['low', 'Low', counts.low]].map(([key, label, cnt]) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      filter === key ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {label} <span className="ml-1 opacity-70">{cnt}</span>
                  </button>
                ))}
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center py-12 gap-3 text-muted-foreground">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                <p className="font-medium text-foreground">No variances found</p>
                <p className="text-sm">All matched records are in agreement.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(v => <VarianceRow key={v.trace_no} v={v} />)}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon, color }) {
  const colorMap = {
    emerald: 'border-emerald-400/30 bg-emerald-400/5',
    amber:   'border-amber-400/30 bg-amber-400/5',
    red:     'border-red-400/30 bg-red-400/5',
    muted:   'border-border bg-card',
  };
  return (
    <div className={`rounded-xl border p-4 space-y-2 ${colorMap[color] || colorMap.muted}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <p className="font-space text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}