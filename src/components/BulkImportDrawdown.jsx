import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, ClipboardPaste, CheckCircle2, AlertTriangle, Loader2, X, Save } from 'lucide-react';

const FIRMS = ['S STEYN INCORPORATED', 'LHL ATTORNEYS', 'DBVS ATTORNEYS', 'RH LAWYERS', 'A WOLMARANS INCORPORATED'];

const COLUMN_ALIASES = {
  trace_no: ['trace no', 'trace_no', 'traceno', 'trace number'],
  attorney_ref_no: ['attorney ref', 'attorney ref no', 'attorney_ref_no', 'ref no', 'reference'],
  client_name: ['client name', 'client_name', 'client', 'name'],
  drawdown_amount: ['drawdown amount', 'draw-down amount', 'drawdown_amount', 'amount', 'draw down amount'],
  drawdown_date: ['drawdown date', 'draw-down date', 'drawdown_date', 'date', 'draw down date'],
  expert_name: ['expert name', 'expert_name', 'expert'],
  product: ['product'],
  invoice_no: ['invoice no', 'invoice_no', 'invoice number'],
  invoice_date: ['invoice date', 'invoice_date'],
  total_invoiced: ['total invoiced', 'total_invoiced', 'invoiced amount'],
  draw_no: ['draw no', 'draw_no', 'draw number'],
  account_number: ['account number', 'account_number', 'account no'],
  contact_person: ['contact person', 'contact_person', 'contact'],
  notes: ['notes', 'note', 'comment'],
};

function normalizeKey(header) {
  const h = header.toLowerCase().trim();
  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.includes(h)) return key;
  }
  return null;
}

function parseDate(val) {
  if (!val) return '';
  // Excel serial date
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

function parsePaste(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split('\t').map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    const row = {};
    headers.forEach((h, idx) => {
      const key = normalizeKey(h);
      if (key) row[key] = cols[idx]?.trim() || '';
    });
    rows.push(row);
  }
  return rows;
}

function nextTraceNo(txns) {
  let maxNum = 0, prefix = '';
  for (const t of txns) {
    const m = t.trace_no?.match(/^(.*?)(\d+)$/);
    if (m) { const n = parseInt(m[2]); if (n > maxNum) { maxNum = n; prefix = m[1]; } }
  }
  if (!prefix && maxNum === 0) return null;
  return (i) => `${prefix}${String(maxNum + 1 + i).padStart(String(maxNum).length, '0')}`;
}

export default function BulkImportDrawdown({ defaultFirm, onImported, onCancel }) {
  const [mode, setMode] = useState('excel'); // 'excel' | 'paste'
  const [pasteText, setPasteText] = useState('');
  const [rows, setRows] = useState([]);
  const [duplicates, setDuplicates] = useState([]); // indices of duplicate rows
  const [firm, setFirm] = useState(defaultFirm || FIRMS[0]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: 'object',
          properties: {
            transactions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  trace_no: { type: 'string' },
                  attorney_ref_no: { type: 'string' },
                  client_name: { type: 'string' },
                  drawdown_amount: { type: 'number' },
                  drawdown_date: { type: 'string', description: 'ISO date YYYY-MM-DD' },
                  expert_name: { type: 'string' },
                  product: { type: 'string' },
                  invoice_no: { type: 'string' },
                  invoice_date: { type: 'string' },
                  total_invoiced: { type: 'number' },
                  draw_no: { type: 'string' },
                  account_number: { type: 'string' },
                  contact_person: { type: 'string' },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
      });
      if (result.status !== 'success') throw new Error(result.details || 'Extraction failed');
      const extracted = result.output?.transactions || (Array.isArray(result.output) ? result.output : []);
      setRows(extracted.map(r => ({ ...r, drawdown_date: parseDate(r.drawdown_date), invoice_date: parseDate(r.invoice_date) })));
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
    e.target.value = '';
  };

  const handleParsePaste = () => {
    const parsed = parsePaste(pasteText);
    if (!parsed.length) { setError('Could not parse data. Make sure headers are in the first row and columns are tab-separated.'); return; }
    setError('');
    setRows(parsed);
  };

  const handleSave = async () => {
    if (!rows.length) return;
    setSaving(true);

    // Fetch existing transactions for this firm to check duplicates and get next trace_no
    const existing = await base44.entities.Transaction.filter({ law_firm: firm }, '-created_date', 2000);
    const getNext = nextTraceNo(existing);
    let traceOffset = 0;

    // Find duplicates
    const dupIndices = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const isDup = existing.some(t =>
        t.client_name?.toLowerCase().trim() === r.client_name?.toLowerCase().trim() &&
        t.expert_name?.toLowerCase().trim() === r.expert_name?.toLowerCase().trim() &&
        t.product?.toLowerCase().trim() === r.product?.toLowerCase().trim() &&
        r.client_name && r.expert_name && r.product
      );
      if (isDup) dupIndices.push(i);
    }

    if (dupIndices.length > 0) {
      setDuplicates(dupIndices);
      setSaving(false);
      return;
    }

    const records = rows.map(r => ({
      ...r,
      law_firm: firm,
      approved: 'PENDING',
      payment_status: 'PENDING',
      drawdown_amount: Number(r.drawdown_amount) || 0,
      total_invoiced: Number(r.total_invoiced) || 0,
      // auto-assign trace_no if missing
      trace_no: r.trace_no || (getNext ? getNext(traceOffset++) : ''),
    }));
    for (let i = 0; i < records.length; i += 50) {
      await base44.entities.Transaction.bulkCreate(records.slice(i, i + 50));
    }
    setSaving(false);
    onImported(records.length);
  };

  const handleForceSave = async () => {
    setDuplicates([]);
    // Fetch existing again for trace_no
    const existing = await base44.entities.Transaction.filter({ law_firm: firm }, '-created_date', 2000);
    const getNext = nextTraceNo(existing);
    let traceOffset = 0;
    const records = rows.map(r => ({
      ...r,
      law_firm: firm,
      approved: 'PENDING',
      payment_status: 'PENDING',
      drawdown_amount: Number(r.drawdown_amount) || 0,
      total_invoiced: Number(r.total_invoiced) || 0,
      trace_no: r.trace_no || (getNext ? getNext(traceOffset++) : ''),
    }));
    setSaving(true);
    for (let i = 0; i < records.length; i += 50) {
      await base44.entities.Transaction.bulkCreate(records.slice(i, i + 50));
    }
    setSaving(false);
    onImported(records.length);
  };

  const removeRow = (idx) => setRows(r => r.filter((_, i) => i !== idx));

  return (
    <div className="space-y-6">
      {/* Firm selector */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Law Firm for all records</label>
          <select value={firm} onChange={e => setFirm(e.target.value)} className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
            {FIRMS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        {/* Mode toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden self-end">
          {['excel', 'paste'].map(m => (
            <button key={m} onClick={() => { setMode(m); setRows([]); setError(''); }} className={`px-4 py-2 text-sm font-medium transition-colors ${mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
              {m === 'excel' ? '📄 Upload Excel' : '📋 Paste Data'}
            </button>
          ))}
        </div>
      </div>

      {/* Input area */}
      {mode === 'excel' ? (
        <div className="bg-card border-2 border-dashed border-border rounded-xl p-8 text-center space-y-3">
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-muted-foreground text-sm">Extracting data from Excel...</p>
            </div>
          ) : (
            <>
              <Upload className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-foreground font-medium">Upload your Excel statement</p>
              <p className="text-muted-foreground text-sm">Columns will be auto-mapped. Supports .xlsx, .xls, .csv</p>
              <label className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-primary/90 transition-colors">
                <Upload className="w-4 h-4" /> Choose File
                <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleExcelUpload} />
              </label>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-muted/30 border border-border rounded-lg p-3 text-xs text-muted-foreground">
            <strong className="text-foreground">How to paste:</strong> Copy rows from Excel (including the header row) and paste below. Columns should be tab-separated. Recognised headers: <em>Trace No, Client Name, Drawdown Amount, Drawdown Date, Expert Name, Draw No, Invoice No, Total Invoiced, Notes</em>
          </div>
          <textarea
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            rows={8}
            placeholder="Paste Excel data here (including header row)..."
            className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono resize-none"
          />
          <button onClick={handleParsePaste} disabled={!pasteText.trim()} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
            <ClipboardPaste className="w-4 h-4" /> Parse Data
          </button>
        </div>
      )}

      {/* Duplicate warning */}
      {duplicates.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-amber-400/10 border border-amber-400/30 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <p className="text-sm text-amber-300 font-semibold">{duplicates.length} possible duplicate{duplicates.length !== 1 ? 's' : ''} detected</p>
            <p className="text-sm text-amber-300/80 mt-0.5">Rows {duplicates.map(i => i + 1).join(', ')} match existing transactions (same firm, client, expert & product).</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => setDuplicates([])} className="text-xs px-3 py-1.5 rounded border border-border text-muted-foreground hover:text-foreground transition-colors">Review</button>
            <button onClick={handleForceSave} className="text-xs px-3 py-1.5 rounded bg-amber-400 text-black font-semibold hover:bg-amber-300 transition-colors">Import Anyway</button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 px-4 py-3 bg-destructive/10 border border-destructive/30 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Preview table */}
      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {rows.length} transaction{rows.length !== 1 ? 's' : ''} ready to import
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/80">
                  <tr>
                    {['Trace No', 'Client Name', 'Draw No', 'Amount', 'Date', 'Expert', 'Notes', ''].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                   <tr key={i} className={`border-t border-border/50 hover:bg-muted/20 ${duplicates.includes(i) ? 'bg-amber-400/10' : ''}`}>
                     <td className="px-3 py-2 font-mono text-primary">
                       {r.trace_no || <span className="text-muted-foreground italic">auto</span>}
                       {duplicates.includes(i) && <span className="ml-1 text-amber-400 text-xs font-bold">⚠</span>}
                     </td>
                      <td className="px-3 py-2 text-foreground max-w-[160px] truncate">{r.client_name || '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.draw_no || '—'}</td>
                      <td className="px-3 py-2 text-foreground">R {Number(r.drawdown_amount || 0).toLocaleString('en-ZA')}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.drawdown_date || '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">{r.expert_name || '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">{r.notes || '—'}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => removeRow(i)} className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Importing...' : `Import ${rows.length} Transaction${rows.length !== 1 ? 's' : ''}`}
            </button>
            <button onClick={onCancel} className="px-4 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}