import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, ClipboardPaste, CheckCircle2, AlertTriangle, Loader2, X, Save } from 'lucide-react';

const FIRMS = ['S STEYN INCORPORATED', 'LHL ATTORNEYS', 'DBVS ATTORNEYS', 'RH LAWYERS', 'A WOLMARANS INCORPORATED'];

const COLUMN_ALIASES = {
  trace_no: ['trace no', 'trace_no', 'traceno', 'trace number'],
  attorney_ref_no: ['attorney ref no.', 'attorney ref no', 'attorney ref', 'attorney_ref_no', 'ref no', 'reference'],
  client_name: ['client name', 'client_name', 'client', 'name'],
  approved: ['approved'],
  potential_drawdown: ['potential draw-down', 'potential drawdown', 'potential_drawdown', 'potential draw down'],
  budget_amount: ['budget amount', 'budget_amount'],
  drawdown_amount: ['draw-down amount', 'drawdown amount', 'drawdown_amount', 'draw down amount'],
  drawdown_date: ['drawn-down date', 'draw-down date', 'drawdown date', 'drawdown_date', 'drawn down date'],
  draw_no: ['draw no', 'draw_no', 'draw number', 'drawn-down', 'drawn down'],
  attorney_interest_start_date: ['attorney interest start date', 'interest start date', 'attorney_interest_start_date'],
  second_payment: ['second payment', 'second_payment'],
  attorney_interest: ['attorney interest', 'attorney_interest'],
  funda_interest: ['funda amount', 'funda_interest', 'funda interest'],
  funda_interest_payment_date: ['date paid', 'funda_interest_payment_date'],
  amount_attorney_paid: ['amount paid', 'amount_attorney_paid'],
  mlf: ['mlf'],
  law_firm: ['attorney/client', 'attorney client', 'law firm', 'law_firm', 'firm'],
  contact_person: ['contact person', 'contact_person', 'contact'],
  expert_name: ['expert name', 'expert_name', 'expert'],
  product: ['product'],
  date_of_assessment: ['date of assessment', 'date_of_assessment', 'assessment date'],
  assessment_status: ['assessment status', 'assessment_status'],
  invoice_date: ['invoice date', 'invoice_date'],
  invoice_no: ['invoice no', 'invoice no.', 'invoice_no', 'invoice number'],
  total_invoiced: ['total invoiced', 'total_invoiced', 'invoiced amount'],
  account_number: ['account number', 'account_number', 'account no'],
  notes: ['notes', 'note', 'comment'],
};

const FIRM_NAME_MAP = {
  'lhl attorneys': 'LHL ATTORNEYS',
  'rh lawyers': 'RH LAWYERS',
  's steyn incorporated': 'S STEYN INCORPORATED',
  'dbvs attorneys': 'DBVS ATTORNEYS',
  'a wolmarans incorporated': 'A WOLMARANS INCORPORATED',
};

function normalizeFirm(val) {
  if (!val) return null;
  return FIRM_NAME_MAP[val.toLowerCase().trim()] || null;
}

function normalizeApproved(val) {
  if (!val) return 'PENDING';
  const v = String(val).trim().toUpperCase();
  if (v === 'YES' || v === 'Y') return 'YES';
  if (v === 'NO' || v === 'N') return 'NO';
  if (v === 'CANCELLED') return 'CANCELLED';
  return 'PENDING';
}

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
                  trace_no: { type: 'string', description: 'TRACE NO column' },
                  attorney_ref_no: { type: 'string', description: 'ATTORNEY REF NO. column' },
                  client_name: { type: 'string', description: 'CLIENT NAME column' },
                  approved: { type: 'string', description: 'APPROVED column - YES/NO/PENDING' },
                  potential_drawdown: { type: 'number', description: 'POTENTIAL DRAW-DOWN column' },
                  budget_amount: { type: 'number', description: 'BUDGET AMOUNT column' },
                  draw_no: { type: 'string', description: 'DRAWN-DOWN or DRAW NO column e.g. DRAW 01' },
                  drawdown_amount: { type: 'number', description: 'DRAW-DOWN AMOUNT column' },
                  drawdown_date: { type: 'string', description: 'DRAWN-DOWN DATE column as ISO date YYYY-MM-DD' },
                  attorney_interest_start_date: { type: 'string', description: 'ATTORNEY INTEREST START DATE or INTEREST START DATE column as ISO date YYYY-MM-DD' },
                  second_payment: { type: 'number', description: 'SECOND PAYMENT column' },
                  attorney_interest: { type: 'number', description: 'ATTORNEY INTEREST column' },
                  funda_interest: { type: 'number', description: 'FUNDA AMOUNT column' },
                  funda_interest_payment_date: { type: 'string', description: 'DATE PAID column as ISO date YYYY-MM-DD' },
                  amount_attorney_paid: { type: 'number', description: 'AMOUNT PAID column' },
                  mlf: { type: 'string', description: 'MLF column YES/NO' },
                  law_firm: { type: 'string', description: 'ATTORNEY/CLIENT column - the law firm name' },
                  contact_person: { type: 'string', description: 'CONTACT PERSON column' },
                  expert_name: { type: 'string', description: 'EXPERT NAME column' },
                  product: { type: 'string', description: 'PRODUCT column e.g. MLR RAF, RAF 4' },
                  date_of_assessment: { type: 'string', description: 'DATE OF ASSESSMENT column as ISO date YYYY-MM-DD' },
                  assessment_status: { type: 'string', description: 'ASSESSMENT STATUS column e.g. SEEN' },
                  invoice_date: { type: 'string', description: 'INVOICE DATE column as ISO date YYYY-MM-DD' },
                  invoice_no: { type: 'string', description: 'INVOICE NO column' },
                  total_invoiced: { type: 'number', description: 'TOTAL INVOICED column' },
                  account_number: { type: 'string', description: 'ACCOUNT NUMBER column' },
                },
              },
            },
          },
        },
      });
      if (result.status !== 'success') throw new Error(result.details || 'Extraction failed');
      const extracted = result.output?.transactions || (Array.isArray(result.output) ? result.output : []);
      const mapped = extracted
        .filter(r => r.trace_no && r.client_name)
        .map(r => ({
          ...r,
          drawdown_date: parseDate(r.drawdown_date),
          invoice_date: parseDate(r.invoice_date),
          date_of_assessment: parseDate(r.date_of_assessment),
          attorney_interest_start_date: parseDate(r.attorney_interest_start_date),
          funda_interest_payment_date: parseDate(r.funda_interest_payment_date),
          approved: normalizeApproved(r.approved),
          mlf: r.mlf ? String(r.mlf).trim().toUpperCase() : '',
          // Auto-detect firm from ATTORNEY/CLIENT column
          _detected_firm: normalizeFirm(r.law_firm),
        }));
      setRows(mapped);
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

  const buildRecords = (rowList, existingMap) => {
    let traceOffsets = {};
    return rowList.map(r => {
      // Use detected firm from ATTORNEY/CLIENT col, else fallback to selector
      const rowFirm = r._detected_firm || firm;
      if (!traceOffsets[rowFirm]) traceOffsets[rowFirm] = 0;
      const existing = existingMap[rowFirm] || [];
      const getNext = nextTraceNo(existing);
      const { _detected_firm, law_firm, ...rest } = r;
      return {
        ...rest,
        law_firm: rowFirm,
        approved: r.approved || 'PENDING',
        payment_status: 'PENDING',
        drawdown_amount: Number(r.drawdown_amount) || 0,
        total_invoiced: Number(r.total_invoiced) || 0,
        potential_drawdown: Number(r.potential_drawdown) || undefined,
        budget_amount: Number(r.budget_amount) || undefined,
        second_payment: r.second_payment ? Number(r.second_payment) : undefined,
        attorney_interest: r.attorney_interest ? Number(r.attorney_interest) : undefined,
        funda_interest: r.funda_interest ? Number(r.funda_interest) : undefined,
        amount_attorney_paid: r.amount_attorney_paid ? Number(r.amount_attorney_paid) : undefined,
        trace_no: r.trace_no || (getNext ? getNext(traceOffsets[rowFirm]++) : ''),
      };
    });
  };

  const handleSave = async () => {
    if (!rows.length) return;
    setSaving(true);

    // Collect all unique firms in this import
    const firmSet = [...new Set(rows.map(r => r._detected_firm || firm))];
    const existingMap = {};
    for (const f of firmSet) {
      existingMap[f] = await base44.entities.Transaction.filter({ law_firm: f }, '-created_date', 2000);
    }

    // Find duplicates (check trace_no first, then client+expert+product)
    const dupIndices = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowFirm = r._detected_firm || firm;
      const existing = existingMap[rowFirm] || [];
      const isDup = existing.some(t =>
        (r.trace_no && t.trace_no === r.trace_no) ||
        (
          t.client_name?.toLowerCase().trim() === r.client_name?.toLowerCase().trim() &&
          t.expert_name?.toLowerCase().trim() === r.expert_name?.toLowerCase().trim() &&
          t.product?.toLowerCase().trim() === r.product?.toLowerCase().trim() &&
          r.client_name && r.expert_name && r.product
        )
      );
      if (isDup) dupIndices.push(i);
    }

    if (dupIndices.length > 0) {
      setDuplicates(dupIndices);
      setSaving(false);
      return;
    }

    const records = buildRecords(rows, existingMap);
    for (let i = 0; i < records.length; i += 50) {
      await base44.entities.Transaction.bulkCreate(records.slice(i, i + 50));
    }
    setSaving(false);
    onImported(records.length);
  };

  const handleForceSave = async () => {
    setDuplicates([]);
    setSaving(true);
    const firmSet = [...new Set(rows.map(r => r._detected_firm || firm))];
    const existingMap = {};
    for (const f of firmSet) {
      existingMap[f] = await base44.entities.Transaction.filter({ law_firm: f }, '-created_date', 2000);
    }
    const records = buildRecords(rows, existingMap);
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
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fallback Law Firm (if not detected from data)</label>
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
                    {['Trace No', 'Client Name', 'Firm', 'Draw No', 'DD Amount', 'DD Date', 'Expert', 'Approved', ''].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                   <tr key={i} className={`border-t border-border/50 hover:bg-muted/20 ${duplicates.includes(i) ? 'bg-amber-400/10' : ''}`}>
                     <td className="px-3 py-2 font-mono text-primary whitespace-nowrap">
                       {r.trace_no || <span className="text-muted-foreground italic">auto</span>}
                       {duplicates.includes(i) && <span className="ml-1 text-amber-400 text-xs font-bold">⚠</span>}
                     </td>
                      <td className="px-3 py-2 text-foreground max-w-[140px] truncate">{r.client_name || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${r._detected_firm ? 'bg-primary/15 text-primary' : 'bg-amber-400/15 text-amber-400'}`}>
                          {r._detected_firm ? r._detected_firm.split(' ')[0] : firm.split(' ')[0]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{r.draw_no || '—'}</td>
                      <td className="px-3 py-2 text-foreground whitespace-nowrap">R {Number(r.drawdown_amount || 0).toLocaleString('en-ZA')}</td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{r.drawdown_date || '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">{r.expert_name || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          r.approved === 'YES' ? 'bg-emerald-400/15 text-emerald-400' :
                          r.approved === 'NO' ? 'bg-destructive/15 text-destructive' :
                          'bg-muted text-muted-foreground'
                        }`}>{r.approved || 'PENDING'}</span>
                      </td>
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