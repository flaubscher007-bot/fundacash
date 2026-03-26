import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5?target=deno';

const FIRM_MAP = {
  'lhl attorneys': 'LHL ATTORNEYS',
  'lhl': 'LHL ATTORNEYS',
  'rh lawyers': 'RH LAWYERS',
  'rhlawyers': 'RH LAWYERS',
  'rh': 'RH LAWYERS',
  's steyn incorporated': 'S STEYN INCORPORATED',
  's steyn inc': 'S STEYN INCORPORATED',
  'ssteyn': 'S STEYN INCORPORATED',
  'dbvs attorneys': 'DBVS ATTORNEYS',
  'dbvs': 'DBVS ATTORNEYS',
  'a wolmarans incorporated': 'A WOLMARANS INCORPORATED',
  'a wolmarans inc': 'A WOLMARANS INCORPORATED',
  'wolmarans': 'A WOLMARANS INCORPORATED',
  'awolmarans': 'A WOLMARANS INCORPORATED',
};

function normalizeFirm(val) {
  if (!val) return null;
  const key = String(val).toLowerCase().trim();
  return FIRM_MAP[key] || null;
}

function detectFirmFromTrace(traceNo) {
  if (!traceNo) return null;
  const t = String(traceNo).toUpperCase().trim();
  if (t.startsWith('LHL')) return 'LHL ATTORNEYS';
  if (t.startsWith('RHL') || t.startsWith('RHH')) return 'RH LAWYERS';
  if (t.startsWith('STE') || t.startsWith('SST')) return 'S STEYN INCORPORATED';
  if (t.startsWith('DBV')) return 'DBVS ATTORNEYS';
  if (t.startsWith('WOL') || t.startsWith('AWI')) return 'A WOLMARANS INCORPORATED';
  return null;
}

function xlsxDateToISO(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    if (val < 1000) return null; // probably a serial error
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (d.getFullYear() < 1990 || d.getFullYear() > 2100) return null;
    return d.toISOString().split('T')[0];
  }
  if (typeof val === 'string') {
    const s = val.trim();
    if (!s || s.includes('#') || s === '1901-06-23') return null;
    // Handle various date formats
    const m = s.match(/^(\d{4}[-/]\d{2}[-/]\d{2})/);
    if (m) {
      const d = new Date(m[1]);
      if (!isNaN(d.getTime()) && d.getFullYear() > 1990 && d.getFullYear() < 2100) {
        return d.toISOString().split('T')[0];
      }
    }
  }
  return null;
}

function parseNum(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'boolean') return null;
  if (typeof val === 'string' && (val.includes('#') || val.trim() === '')) return null;
  const n = Number(val);
  return isNaN(n) || n === 0 ? null : n;
}

function parseNumAllowZero(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function normalizeApproved(val) {
  if (!val) return 'PENDING';
  const v = String(val).trim().toUpperCase();
  if (v === 'YES' || v === 'Y' || v === 'APPROVED') return 'YES';
  if (v === 'NO' || v === 'N') return 'NO';
  if (v === 'CANCELLED' || v.includes('CANCEL')) return 'CANCELLED';
  return 'PENDING';
}

// Get field from row using multiple possible column names (case-insensitive)
function getField(row, ...keys) {
  for (const key of keys) {
    const found = Object.keys(row).find(k => k.toLowerCase().trim() === key.toLowerCase().trim());
    if (found !== undefined && row[found] !== null && row[found] !== undefined && row[found] !== '') {
      return row[found];
    }
  }
  return null;
}

function mapRow(r) {
  const traceNo = getField(r, 'TRACE NO', 'trace no', 'trace_no');
  const clientName = getField(r, 'CLIENT NAME', 'client name', 'client_name');
  if (!traceNo || !clientName) return null;

  // Skip total/summary rows
  const traceStr = String(traceNo).trim();
  if (traceStr.toLowerCase() === 'total' || traceStr.toLowerCase() === 'row labels') return null;

  const firmFromCol = normalizeFirm(getField(r, 'ATTORNEY/CLIENT', 'attorney/client', 'law firm', 'law_firm', 'firm'));
  const firmFromTrace = detectFirmFromTrace(traceStr);
  const law_firm = firmFromCol || firmFromTrace;
  if (!law_firm) return null;

  // Draw number — can be in DRAW NO or DRAWN-DOWN or Column2 (older S Steyn sheets) or DRAW NUMBER
  const drawNo = getField(r, 'DRAW NO', 'draw no', 'draw number') ||
    (() => {
      // Column2 sometimes holds draw no in older S Steyn sheets
      const col2 = r['Column2'] || r['Column1'];
      if (col2 && typeof col2 === 'string' && col2.toUpperCase().startsWith('DRAW')) return col2;
      return null;
    })();

  return {
    trace_no: traceStr,
    attorney_ref_no: String(getField(r, 'ATTORNEY REF NO.', 'attorney ref no.', 'attorney ref no', 'attorney_ref_no') || '').trim() || null,
    client_name: String(clientName).trim(),
    approved: normalizeApproved(getField(r, 'APPROVED')),
    potential_drawdown: parseNum(getField(r, 'POTENTIAL DRAW-DOWN', 'potential drawdown', 'potential draw-down')),
    budget_amount: parseNum(getField(r, 'BUDGET AMOUNT', 'budget amount')),
    draw_no: drawNo ? String(drawNo).trim() : null,
    drawdown_amount: parseNumAllowZero(getField(r, 'DRAW-DOWN AMOUNT', 'draw-down amount', 'drawdown amount')) || null,
    drawdown_date: xlsxDateToISO(getField(r, 'DRAWN-DOWN DATE', 'draw-down date', 'drawn-down date', 'drawdown date')),
    attorney_interest_start_date: xlsxDateToISO(
      getField(r, 'ATTORNEY INTEREST START DATE', 'attorney interest start date', 'INTEREST START DATE', 'interest start date')
    ),
    second_payment: parseNum(getField(r, 'SECOND PAYMENT', 'second payment')),
    attorney_interest: parseNum(getField(r, 'ATTORNEY INTEREST', 'attorney interest', 'ATTORNEY INTEREST AFTER DD PAID')),
    funda_interest: parseNum(getField(r, 'FUNDA AMOUNT', 'funda amount', 'funda interest', 'FUNDA INTEREST')),
    funda_interest_payment_date: xlsxDateToISO(getField(r, 'DATE PAID', 'date paid')),
    attorney_interest_payment_date: xlsxDateToISO(getField(r, 'DATE ATTORNEY PAID', 'date attorney paid')),
    amount_attorney_paid: parseNum(getField(r, 'AMOUNT PAID', 'amount paid', 'AMOUNT ATTORNEY PAID', 'amount attorney paid')),
    new_capital_amount: parseNum(getField(r, 'NEW CAPITAL AMOUNT', 'new capital amount')),
    drawdown_payment_date: xlsxDateToISO(getField(r, 'DRAWDOWN PAYMENT DATE', 'drawdown payment date')),
    settlement_payment_date: xlsxDateToISO(getField(r, 'SETTLEMENT PAYMENT DATE', 'settlement payment date')),
    mlf: getField(r, 'MLF') ? String(getField(r, 'MLF')).trim().toUpperCase() : null,
    law_firm,
    contact_person: String(getField(r, 'CONTACT PERSON', 'contact person') || '').trim() || null,
    expert_name: String(getField(r, 'EXPERT NAME', 'expert name') || '').trim() || null,
    product: String(getField(r, 'PRODUCT') || '').trim() || null,
    date_of_assessment: xlsxDateToISO(getField(r, 'DATE OF ASSESSMENT', 'date of assessment')),
    assessment_status: String(getField(r, 'ASSESSMENT STATUS', 'assessment status') || '').trim() || null,
    invoice_date: xlsxDateToISO(getField(r, 'INVOICE DATE', 'invoice date', 'Invoice Date')),
    invoice_no: String(getField(r, 'INVOICE NO', 'invoice no', 'Invoice NO') || '').replace(/\n/g, ' ').trim() || null,
    total_invoiced: parseNum(getField(r, 'TOTAL INVOICED', 'total invoiced', 'INVOICE AMOUNT', 'invoice amount')),
    account_number: String(getField(r, 'ACCOUNT NUMBER', 'account number') || '').trim() || null,
    payment_status: 'PENDING',
  };
}

const SKIP_SHEETS = ['SUMMARY', 'summary', 'PIVOT', 'pivot'];

Deno.serve(async (req) => {
  try {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { file_url, skip_duplicates = true, dry_run = false, max_insert = 200 } = await req.json();
  if (!file_url) return Response.json({ error: 'file_url required' }, { status: 400 });

  const resp = await fetch(file_url);
  if (!resp.ok) return Response.json({ error: `Failed to fetch file: ${resp.status}` }, { status: 500 });

  const buffer = await resp.arrayBuffer();
  const data = new Uint8Array(buffer);
  const workbook = XLSX.read(data, { type: 'array', raw: true, cellDates: false });

  // Use FULL TRACKER if available, otherwise merge all non-summary sheets
  const TARGET_SHEET = 'FULL TRACKER';
  let allRows = [];
  let sheetsUsed = [];

  if (workbook.SheetNames.includes(TARGET_SHEET)) {
    const ws = workbook.Sheets[TARGET_SHEET];
    const rows = XLSX.utils.sheet_to_json(ws, { raw: true, defval: null });
    allRows = rows;
    sheetsUsed = [TARGET_SHEET];
  } else {
    // Merge all non-summary data sheets (e.g. A Wolmarans has only FULL STATEMENT)
    for (const sheetName of workbook.SheetNames) {
      if (SKIP_SHEETS.some(s => sheetName.toLowerCase().includes(s.toLowerCase()))) continue;
      const ws = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { raw: true, defval: null });
      allRows.push(...rows);
      sheetsUsed.push(sheetName);
    }
  }

  // Map rows
  const mapped = allRows.map(mapRow).filter(Boolean);

  // Deduplicate within this import by trace_no (keep last occurrence)
  const seenInFile = new Map();
  for (const r of mapped) {
    seenInFile.set(r.trace_no, r);
  }
  const deduped = Array.from(seenInFile.values());

  // Load existing trace numbers
  let existingTraceNos = new Set();
  let page = 0;
  const PAGE_SIZE = 200;
  while (true) {
    const batch = await base44.asServiceRole.entities.Transaction.list('-created_date', PAGE_SIZE, page * PAGE_SIZE);
    const items = Array.isArray(batch) ? batch : (batch.items || batch.results || []);
    if (!items.length) break;
    for (const t of items) { if (t.trace_no) existingTraceNos.add(t.trace_no); }
    if (items.length < PAGE_SIZE) break;
    page++;
    await new Promise(r => setTimeout(r, 200));
  }

  const toInsert = skip_duplicates ? deduped.filter(r => !existingTraceNos.has(r.trace_no)) : deduped;
  const skipped = deduped.length - toInsert.length;
  const limited = toInsert.slice(0, max_insert);

  let inserted = 0;
  if (!dry_run) {
    const BATCH = 15;
    for (let i = 0; i < limited.length; i += BATCH) {
      await base44.asServiceRole.entities.Transaction.bulkCreate(limited.slice(i, i + BATCH));
      inserted += Math.min(BATCH, limited.length - i);
      if (i + BATCH < limited.length) await new Promise(r => setTimeout(r, 500));
    }
  }

  return Response.json({
    success: true,
    dry_run,
    sheets_used: sheetsUsed,
    total_rows_parsed: allRows.length,
    total_valid: mapped.length,
    unique_trace_nos: deduped.length,
    skipped_duplicates: skipped,
    to_insert_total: toInsert.length,
    inserted,
    remaining: Math.max(0, toInsert.length - (dry_run ? 0 : limited.length)),
  });
  } catch (err) {
    console.error('IMPORT ERROR:', err.message, err.stack);
    return Response.json({ error: err.message }, { status: 500 });
  }
});