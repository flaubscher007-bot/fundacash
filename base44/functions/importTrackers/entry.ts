import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5?target=deno';

const FIRM_MAP = {
  'lhl attorneys': 'LHL ATTORNEYS',
  'rh lawyers': 'RH LAWYERS',
  's steyn incorporated': 'S STEYN INCORPORATED',
  'dbvs attorneys': 'DBVS ATTORNEYS',
  'a wolmarans incorporated': 'A WOLMARANS INCORPORATED',
};

function normalizeFirm(val) {
  if (!val) return null;
  return FIRM_MAP[String(val).toLowerCase().trim()] || null;
}

function detectFirmFromTrace(traceNo) {
  if (!traceNo) return null;
  const t = String(traceNo).toUpperCase().trim();
  if (t.startsWith('LHL')) return 'LHL ATTORNEYS';
  if (t.match(/^RH[HL0-9]/)) return 'RH LAWYERS';
  if (t.startsWith('STE') || t.startsWith('SST')) return 'S STEYN INCORPORATED';
  if (t.startsWith('DBV')) return 'DBVS ATTORNEYS';
  if (t.startsWith('WOL') || t.startsWith('AWI')) return 'A WOLMARANS INCORPORATED';
  return null;
}

function xlsxDateToISO(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    // Excel serial number
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (d.getFullYear() < 1990) return null;
    return d.toISOString().split('T')[0];
  }
  if (typeof val === 'string') {
    const s = val.trim();
    if (!s || s.includes('#')) return null;
    const d = new Date(s.split('T')[0].split(' ')[0]);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1990) return d.toISOString().split('T')[0];
  }
  return null;
}

function parseNum(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'string' && (val.includes('#') || val.trim() === '')) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function normalizeApproved(val) {
  if (!val) return 'PENDING';
  const v = String(val).trim().toUpperCase();
  if (v === 'YES' || v === 'Y') return 'YES';
  if (v === 'NO' || v === 'N') return 'NO';
  if (v === 'CANCELLED') return 'CANCELLED';
  return 'PENDING';
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { file_url, skip_duplicates = true } = await req.json();
  if (!file_url) return Response.json({ error: 'file_url required' }, { status: 400 });

  // Fetch the Excel file
  const resp = await fetch(file_url);
  if (!resp.ok) return Response.json({ error: `Failed to fetch file: ${resp.status}` }, { status: 500 });

  const buffer = await resp.arrayBuffer();
  const data = new Uint8Array(buffer);
  const workbook = XLSX.read(data, { type: 'array', raw: true, cellDates: false });

  const TARGET_SHEETS = ['FULL TRACKER'];
  const sheetName = TARGET_SHEETS.find(s => workbook.SheetNames.includes(s)) || workbook.SheetNames[0];
  const ws = workbook.Sheets[sheetName];

  const rawRows = XLSX.utils.sheet_to_json(ws, { raw: true, defval: null });

  const mapped = rawRows
    .filter(r => r['TRACE NO'] && r['CLIENT NAME'])
    .map(r => {
      const firmFromCol = normalizeFirm(r['ATTORNEY/CLIENT']);
      const firmFromTrace = detectFirmFromTrace(r['TRACE NO']);
      const law_firm = firmFromCol || firmFromTrace;
      if (!law_firm) return null;

      return {
        trace_no: String(r['TRACE NO']).trim(),
        attorney_ref_no: r['ATTORNEY REF NO.'] ? String(r['ATTORNEY REF NO.']).trim() : null,
        client_name: r['CLIENT NAME'] ? String(r['CLIENT NAME']).trim() : null,
        approved: normalizeApproved(r['APPROVED']),
        potential_drawdown: parseNum(r['POTENTIAL DRAW-DOWN']),
        budget_amount: parseNum(r['BUDGET AMOUNT']),
        draw_no: (r['DRAWN-DOWN'] || r['DRAW NO']) ? String(r['DRAWN-DOWN'] || r['DRAW NO']).trim() : null,
        drawdown_amount: parseNum(r['DRAW-DOWN AMOUNT']),
        drawdown_date: xlsxDateToISO(r['DRAWN-DOWN DATE']),
        attorney_interest_start_date: xlsxDateToISO(r['ATTORNEY INTEREST START DATE'] ?? r['INTEREST START DATE']),
        second_payment: parseNum(r['SECOND PAYMENT']),
        attorney_interest: parseNum(r['ATTORNEY INTEREST']),
        funda_interest: parseNum(r['FUNDA AMOUNT']),
        funda_interest_payment_date: xlsxDateToISO(r['DATE PAID']),
        amount_attorney_paid: parseNum(r['AMOUNT PAID']),
        mlf: r['MLF'] ? String(r['MLF']).trim().toUpperCase() : null,
        law_firm,
        contact_person: r['CONTACT PERSON'] ? String(r['CONTACT PERSON']).trim() : null,
        expert_name: r['EXPERT NAME'] ? String(r['EXPERT NAME']).trim() : null,
        product: r['PRODUCT'] ? String(r['PRODUCT']).trim() : null,
        date_of_assessment: xlsxDateToISO(r['DATE OF ASSESSMENT']),
        assessment_status: r['ASSESSMENT STATUS'] ? String(r['ASSESSMENT STATUS']).trim() : null,
        invoice_date: xlsxDateToISO(r['INVOICE DATE']),
        invoice_no: r['INVOICE NO'] ? String(r['INVOICE NO']).replace(/\n/g, ' ').trim() : null,
        total_invoiced: parseNum(r['TOTAL INVOICED']),
        account_number: r['ACCOUNT NUMBER'] ? String(r['ACCOUNT NUMBER']).trim() : null,
        payment_status: 'PENDING',
      };
    })
    .filter(Boolean);

  // Load existing trace numbers to skip duplicates
  const existing = await base44.asServiceRole.entities.Transaction.list('-created_date', 10000);
  const existingTraceNos = new Set(existing.map(t => t.trace_no).filter(Boolean));

  const toInsert = skip_duplicates ? mapped.filter(r => !existingTraceNos.has(r.trace_no)) : mapped;

  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += 50) {
    await base44.asServiceRole.entities.Transaction.bulkCreate(toInsert.slice(i, i + 50));
    inserted += Math.min(50, toInsert.length - i);
  }

  return Response.json({
    success: true,
    sheet_used: sheetName,
    total_rows: rawRows.length,
    total_extracted: mapped.length,
    skipped_duplicates: mapped.length - toInsert.length,
    inserted,
  });
});