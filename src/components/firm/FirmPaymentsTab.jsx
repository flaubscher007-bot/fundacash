import { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Download, Upload, CheckSquare, Square, Loader2, AlertTriangle,
  CheckCircle2, FileSpreadsheet, Plus, X
} from 'lucide-react';

const fmt = (n) => Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-ZA') : '';

// Column definitions for the template
const TEMPLATE_COLS = [
  { key: 'trace_no', label: 'Trace Number' },
  { key: 'law_firm', label: 'Law Firm' },
  { key: 'client_name', label: 'Claimant Name' },
  { key: 'attorney_ref_no', label: 'Claimant Reference Number' },
  { key: 'drawdown_amount', label: 'Drawdown Amount' },
  { key: 'drawdown_date', label: 'Drawdown Date' },
  { key: 'drawdown_payment_date', label: 'Drawdown Payment Date' },
  { key: 'funda_interest', label: 'Funda Interest Amount' },
  { key: 'funda_interest_payment_date', label: 'Funda Interest Payment Date' },
  { key: 'attorney_interest', label: 'Attorney Interest Amount' },
  { key: 'attorney_interest_payment_date', label: 'Attorney Payment Date' },
  { key: 'total_invoiced', label: 'Total Invoice Amount' },
  { key: 'settlement_payment_date', label: 'Settlement Date' },
];

// Map spreadsheet column headers back to entity fields
const HEADER_MAP = {};
TEMPLATE_COLS.forEach(c => { HEADER_MAP[c.label.toLowerCase().trim()] = c.key; });

function parseDate(val) {
  if (!val) return '';
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return d.toISOString().split('T')[0];
  }
  const str = String(val).trim();
  if (!str) return '';
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return str;
}

function exportToCSV(rows, filename) {
  const headers = TEMPLATE_COLS.map(c => c.label);
  const lines = [
    headers.join(','),
    ...rows.map(t =>
      TEMPLATE_COLS.map(c => {
        let v = t[c.key] ?? '';
        if (c.key.includes('date') || c.key.includes('Date')) v = fmtDate(v) || v;
        if (typeof v === 'string' && (v.includes(',') || v.includes('"'))) v = `"${v.replace(/"/g, '""')}"`;
        return v;
      }).join(',')
    )
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function downloadBlankTemplate() {
  const headers = TEMPLATE_COLS.map(c => c.label);
  const blob = new Blob([headers.join(',') + '\n'], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'FundaCash_Payment_Template.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

const PAYMENT_TYPES = [
  'Drawdown Repayment', 'New Capital Balance', 'Funda Interest',
  'Attorney Interest', 'Full Settlement'
];

const EMPTY_SINGLE = { trace_no: '', payment_date: '', amount: '', payment_type: 'Full Settlement', notes: '' };

export default function FirmPaymentsTab({ firmName, transactions }) {
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [singleEntry, setSingleEntry] = useState(EMPTY_SINGLE);
  const [savingSingle, setSavingSingle] = useState(false);
  const [singleSuccess, setSingleSuccess] = useState('');
  const [activeMode, setActiveMode] = useState('export'); // 'export' | 'single' | 'bulk'

  const filtered = useMemo(() => {
    if (!search.trim()) return transactions;
    const q = search.toLowerCase();
    return transactions.filter(t =>
      t.trace_no?.toLowerCase().includes(q) ||
      t.client_name?.toLowerCase().includes(q) ||
      t.draw_no?.toLowerCase().includes(q)
    );
  }, [transactions, search]);

  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(t => t.id)));
  };

  const handleExport = () => {
    const rows = transactions.filter(t => selected.has(t.id));
    exportToCSV(rows, `${firmName.replace(/ /g, '_')}_Payments_Export.csv`);
  };

  // Parse uploaded CSV/Excel via AI extraction
  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setUploadError('');
    setUploadResult(null);

    const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadFile });
    const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: 'object',
        properties: {
          rows: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                trace_no: { type: 'string' },
                drawdown_amount: { type: 'number' },
                drawdown_date: { type: 'string' },
                drawdown_payment_date: { type: 'string' },
                funda_interest: { type: 'number' },
                funda_interest_payment_date: { type: 'string' },
                attorney_interest: { type: 'number' },
                attorney_interest_payment_date: { type: 'string' },
                total_invoiced: { type: 'number' },
                settlement_payment_date: { type: 'string' },
              }
            }
          }
        }
      }
    });

    if (result.status !== 'success') {
      setUploadError(result.details || 'Failed to extract data from file.');
      setUploading(false);
      return;
    }

    const rows = result.output?.rows || (Array.isArray(result.output) ? result.output : []);
    if (!rows.length) {
      setUploadError('No data rows found in file.');
      setUploading(false);
      return;
    }

    // Match each row to a transaction by trace_no and update
    let updated = 0, notFound = 0;
    const notFoundTraces = [];

    for (const row of rows) {
      if (!row.trace_no) continue;
      const txn = transactions.find(t =>
        t.trace_no?.toLowerCase().trim() === String(row.trace_no).toLowerCase().trim()
      );
      if (!txn) { notFound++; notFoundTraces.push(row.trace_no); continue; }

      const patch = {};
      if (row.drawdown_amount != null) patch.drawdown_amount = Number(row.drawdown_amount);
      if (row.drawdown_date) patch.drawdown_date = parseDate(row.drawdown_date);
      if (row.drawdown_payment_date) patch.drawdown_payment_date = parseDate(row.drawdown_payment_date);
      if (row.funda_interest != null) patch.funda_interest = Number(row.funda_interest);
      if (row.funda_interest_payment_date) {
        // store on attorney_interest_start_date as the interest payment reference
        patch.funda_interest_payment_date = parseDate(row.funda_interest_payment_date);
      }
      if (row.attorney_interest != null) patch.attorney_interest = Number(row.attorney_interest);
      if (row.attorney_interest_payment_date) patch.attorney_interest_payment_date = parseDate(row.attorney_interest_payment_date);
      if (row.total_invoiced != null) patch.total_invoiced = Number(row.total_invoiced);
      if (row.settlement_payment_date) patch.settlement_payment_date = parseDate(row.settlement_payment_date);

      if (Object.keys(patch).length > 0) {
        await base44.entities.Transaction.update(txn.id, patch);
        updated++;
      }
    }

    setUploadResult({ updated, notFound, notFoundTraces });
    setUploading(false);
    setUploadFile(null);
  };

  const handleSinglePayment = async () => {
    if (!singleEntry.trace_no || !singleEntry.payment_date || !singleEntry.amount) return;
    setSavingSingle(true);
    setSingleSuccess('');
    const txn = transactions.find(t =>
      t.trace_no?.toLowerCase().trim() === singleEntry.trace_no.toLowerCase().trim()
    );
    if (!txn) {
      setSavingSingle(false);
      setSingleSuccess('ERROR: Trace number not found for this firm.');
      return;
    }
    await base44.entities.Payment.create({
      transaction_id: txn.id,
      trace_no: txn.trace_no,
      law_firm: firmName,
      payment_date: singleEntry.payment_date,
      amount: Number(singleEntry.amount),
      payment_type: singleEntry.payment_type,
      notes: singleEntry.notes,
    });
    setSingleEntry(EMPTY_SINGLE);
    setSingleSuccess(`Payment recorded for ${txn.trace_no} — ${txn.client_name}`);
    setSavingSingle(false);
  };

  return (
    <div className="space-y-6">

      {/* Mode tabs */}
      <div className="flex gap-1 bg-muted/30 p-1 rounded-xl w-fit">
        {[
          { key: 'export', label: 'Export & Upload' },
          { key: 'single', label: 'Single Payment' },
        ].map(m => (
          <button
            key={m.key}
            onClick={() => setActiveMode(m.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeMode === m.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* ── EXPORT & BULK UPLOAD ── */}
      {activeMode === 'export' && (
        <div className="space-y-5">

          {/* Step 1 — Select & Export */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="font-space font-semibold text-foreground">Step 1 — Select Transactions & Export</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Select the transactions you want to update, export to CSV, fill in the payment fields, then upload below.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={downloadBlankTemplate}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Blank Template
                </button>
                <button
                  onClick={handleExport}
                  disabled={selected.size === 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" /> Export {selected.size > 0 ? `(${selected.size})` : ''}
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="px-6 py-3 border-b border-border/60">
              <input
                type="text"
                placeholder="Search trace no, client, draw no..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full max-w-sm bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <button onClick={toggleAll} className="text-muted-foreground hover:text-foreground">
                        {selected.size === filtered.length && filtered.length > 0
                          ? <CheckSquare className="w-4 h-4 text-primary" />
                          : <Square className="w-4 h-4" />}
                      </button>
                    </th>
                    {['Trace No', 'Client Name', 'Draw No', 'Drawdown Amt', 'Funda Interest', 'Atty Interest', 'Settled'].map(h => (
                      <th key={h} className="text-left px-3 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t, i) => (
                    <tr
                      key={t.id}
                      onClick={() => toggleSelect(t.id)}
                      className={`border-t border-border/50 cursor-pointer transition-colors ${selected.has(t.id) ? 'bg-primary/10' : i % 2 ? 'bg-muted/5' : ''} hover:bg-muted/20`}
                    >
                      <td className="px-4 py-2.5">
                        {selected.has(t.id)
                          ? <CheckSquare className="w-4 h-4 text-primary" />
                          : <Square className="w-4 h-4 text-muted-foreground" />}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-primary">{t.trace_no}</td>
                      <td className="px-3 py-2.5 text-foreground max-w-[180px] truncate">{t.client_name}</td>
                      <td className="px-3 py-2.5 text-muted-foreground text-xs">{t.draw_no || '—'}</td>
                      <td className="px-3 py-2.5 text-right text-foreground text-xs">R {fmt(t.drawdown_amount)}</td>
                      <td className="px-3 py-2.5 text-right text-purple-400 text-xs">R {fmt(t.funda_interest)}</td>
                      <td className="px-3 py-2.5 text-right text-amber-400 text-xs">R {fmt(t.attorney_interest)}</td>
                      <td className="px-3 py-2.5 text-center">
                        {t.payment_status === 'PAID'
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                          : <span className="text-xs text-muted-foreground">{t.payment_status || '—'}</span>}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">No transactions found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Step 2 — Upload completed file */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div>
              <h3 className="font-space font-semibold text-foreground">Step 2 — Upload Completed File</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Upload the filled-in CSV/Excel to update transactions. Rows are matched by Trace Number.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-secondary text-secondary-foreground text-sm font-medium cursor-pointer hover:bg-secondary/80 transition-colors">
                <FileSpreadsheet className="w-4 h-4" />
                {uploadFile ? uploadFile.name : 'Choose CSV / Excel file'}
                <input type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={e => { setUploadFile(e.target.files[0]); setUploadResult(null); setUploadError(''); e.target.value = ''; }} />
              </label>
              {uploadFile && (
                <>
                  <button onClick={() => setUploadFile(null)} className="p-1 text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
                  >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploading ? 'Processing...' : 'Upload & Update'}
                  </button>
                </>
              )}
            </div>

            {uploadError && (
              <div className="flex items-start gap-3 px-4 py-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{uploadError}</p>
              </div>
            )}

            {uploadResult && (
              <div className="flex items-start gap-3 px-4 py-3 bg-emerald-400/10 border border-emerald-400/30 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-emerald-400 font-semibold">{uploadResult.updated} transaction{uploadResult.updated !== 1 ? 's' : ''} updated successfully.</p>
                  {uploadResult.notFound > 0 && (
                    <p className="text-amber-400 mt-1">
                      {uploadResult.notFound} row{uploadResult.notFound !== 1 ? 's' : ''} not matched: <span className="font-mono text-xs">{uploadResult.notFoundTraces.join(', ')}</span>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SINGLE PAYMENT ── */}
      {activeMode === 'single' && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-4 max-w-xl">
          <div>
            <h3 className="font-space font-semibold text-foreground">Record Single Payment</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Log a payment against a specific transaction by trace number.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Trace Number *</label>
              <input
                type="text"
                value={singleEntry.trace_no}
                onChange={e => setSingleEntry(p => ({ ...p, trace_no: e.target.value }))}
                placeholder="e.g. STE004-01234"
                className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Payment Date *</label>
              <input
                type="date"
                value={singleEntry.payment_date}
                onChange={e => setSingleEntry(p => ({ ...p, payment_date: e.target.value }))}
                className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Amount (R) *</label>
              <input
                type="number"
                value={singleEntry.amount}
                onChange={e => setSingleEntry(p => ({ ...p, amount: e.target.value }))}
                placeholder="0.00"
                className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Payment Type *</label>
              <select
                value={singleEntry.payment_type}
                onChange={e => setSingleEntry(p => ({ ...p, payment_type: e.target.value }))}
                className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {PAYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs text-muted-foreground font-medium">Notes</label>
              <input
                type="text"
                value={singleEntry.notes}
                onChange={e => setSingleEntry(p => ({ ...p, notes: e.target.value }))}
                placeholder="Optional"
                className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <button
            onClick={handleSinglePayment}
            disabled={savingSingle || !singleEntry.trace_no || !singleEntry.payment_date || !singleEntry.amount}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {savingSingle ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {savingSingle ? 'Saving...' : 'Save Payment'}
          </button>

          {singleSuccess && (
            <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm border ${singleSuccess.startsWith('ERROR') ? 'bg-destructive/10 border-destructive/30 text-destructive' : 'bg-emerald-400/10 border-emerald-400/30 text-emerald-400'}`}>
              {singleSuccess.startsWith('ERROR')
                ? <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                : <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
              {singleSuccess}
            </div>
          )}
        </div>
      )}
    </div>
  );
}