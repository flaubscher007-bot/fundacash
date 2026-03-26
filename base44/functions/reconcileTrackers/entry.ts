import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5?target=deno';

function xlsxDateToISO(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    if (val < 1000) return null;
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (d.getFullYear() < 1990 || d.getFullYear() > 2100) return null;
    return d.toISOString().split('T')[0];
  }
  if (typeof val === 'string') {
    const s = val.trim();
    if (!s || s.includes('#')) return null;
    const m = s.match(/^(\d{4}[-/]\d{2}[-/]\d{2})/);
    if (m) {
      const d = new Date(m[1]);
      if (!isNaN(d.getTime()) && d.getFullYear() > 1990) return d.toISOString().split('T')[0];
    }
  }
  return null;
}

function parseNum(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'string' && (val.includes('#') || val.trim() === '')) return null;
  const n = Number(val);
  return isNaN(n) || n === 0 ? null : n;
}

function getField(row, ...keys) {
  for (const key of keys) {
    const found = Object.keys(row).find(k => k.toLowerCase().trim() === key.toLowerCase().trim());
    if (found !== undefined && row[found] !== null && row[found] !== undefined && row[found] !== '') {
      return row[found];
    }
  }
  return null;
}

function roundTo2(n) {
  if (n === null || n === undefined) return null;
  return Math.round(n * 100) / 100;
}

function diff(label, excelVal, dbVal, threshold = 0.01) {
  const e = roundTo2(excelVal);
  const d = roundTo2(dbVal);
  if (e === null && d === null) return null;
  if (typeof e === 'number' && typeof d === 'number') {
    if (Math.abs(e - d) <= threshold) return null;
    return { field: label, excel: e, db: d, delta: roundTo2(e - d) };
  }
  // date / string comparison
  if (String(e ?? '') !== String(d ?? '')) {
    return { field: label, excel: e, db: d, delta: null };
  }
  return null;
}

const SKIP_SHEETS = ['summary', 'pivot'];
const TARGET_SHEET = 'FULL TRACKER';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { file_url, law_firm } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url required' }, { status: 400 });

    // --- Parse Excel ---
    const resp = await fetch(file_url);
    if (!resp.ok) return Response.json({ error: `Failed to fetch file: ${resp.status}` }, { status: 500 });
    const buffer = await resp.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', raw: true, cellDates: false });

    let allRows = [];
    if (workbook.SheetNames.includes(TARGET_SHEET)) {
      allRows = XLSX.utils.sheet_to_json(workbook.Sheets[TARGET_SHEET], { raw: true, defval: null });
    } else {
      for (const name of workbook.SheetNames) {
        if (SKIP_SHEETS.some(s => name.toLowerCase().includes(s))) continue;
        allRows.push(...XLSX.utils.sheet_to_json(workbook.Sheets[name], { raw: true, defval: null }));
      }
    }

    // Build Excel map: trace_no -> fields
    const excelMap = new Map();
    for (const r of allRows) {
      const traceNo = String(getField(r, 'TRACE NO', 'trace no', 'trace_no') || '').trim();
      if (!traceNo || traceNo.toLowerCase() === 'total') continue;
      excelMap.set(traceNo, {
        settlement_payment_date: xlsxDateToISO(
          getField(r, 'SETTLEMENT PAYMENT DATE', 'settlement payment date', 'SETTLEMENT DATE', 'settlement date',
            'DATE SETTLED', 'SETTLED DATE', 'DATE ATTORNEY PAID', 'date attorney paid')
        ),
        amount_attorney_paid: parseNum(getField(r, 'AMOUNT PAID', 'amount paid', 'AMOUNT ATTORNEY PAID', 'amount attorney paid')),
        funda_interest: parseNum(getField(r, 'FUNDA AMOUNT', 'funda amount', 'funda interest', 'FUNDA INTEREST')),
        attorney_interest: parseNum(getField(r, 'ATTORNEY INTEREST', 'attorney interest', 'ATTORNEY INTEREST AFTER DD PAID')),
        new_capital_amount: parseNum(getField(r, 'NEW CAPITAL AMOUNT', 'new capital amount')),
        drawdown_amount: parseNum(getField(r, 'DRAW-DOWN AMOUNT', 'draw-down amount', 'drawdown amount')),
      });
    }

    // --- Fetch DB records ---
    const filter = law_firm ? { law_firm } : {};
    let dbRecords = [];
    let page = 0;
    const PAGE_SIZE = 200;
    while (true) {
      const batch = await base44.asServiceRole.entities.Transaction.list('-created_date', PAGE_SIZE, page * PAGE_SIZE);
      const items = Array.isArray(batch) ? batch : (batch.items || batch.results || []);
      if (!items.length) break;
      dbRecords.push(...items);
      if (items.length < PAGE_SIZE) break;
      page++;
      await new Promise(r => setTimeout(r, 300));
    }

    // --- Compare ---
    const variances = [];
    let matched = 0;
    let excelOnly = 0;
    let dbOnly = 0;

    const dbMap = new Map();
    for (const t of dbRecords) {
      if (t.trace_no) dbMap.set(t.trace_no, t);
    }

    for (const [traceNo, excel] of excelMap) {
      const db = dbMap.get(traceNo);
      if (!db) { excelOnly++; continue; }
      matched++;

      const diffs = [
        diff('Settlement Date', excel.settlement_payment_date, db.settlement_payment_date),
        diff('Amount Attorney Paid', excel.amount_attorney_paid, db.amount_attorney_paid),
        diff('Funda Interest', excel.funda_interest, db.funda_interest),
        diff('Attorney Interest', excel.attorney_interest, db.attorney_interest),
        diff('New Capital Amount', excel.new_capital_amount, db.new_capital_amount),
        diff('Drawdown Amount', excel.drawdown_amount, db.drawdown_amount),
      ].filter(Boolean);

      if (diffs.length > 0) {
        variances.push({
          trace_no: traceNo,
          client_name: db.client_name,
          law_firm: db.law_firm,
          diffs,
          severity: diffs.some(d => d.delta !== null && Math.abs(d.delta) > 1000) ? 'high'
            : diffs.some(d => d.delta !== null && Math.abs(d.delta) > 100) ? 'medium' : 'low',
        });
      }
    }

    for (const [traceNo] of dbMap) {
      if (!excelMap.has(traceNo)) dbOnly++;
    }

    // Sort: high severity first
    const severityOrder = { high: 0, medium: 1, low: 2 };
    variances.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    const totalDelta = variances.reduce((sum, v) => {
      const amtDiff = v.diffs.find(d => d.field === 'Amount Attorney Paid');
      return sum + (amtDiff?.delta ?? 0);
    }, 0);

    return Response.json({
      success: true,
      summary: {
        excel_rows: excelMap.size,
        db_rows: dbMap.size,
        matched,
        with_variance: variances.length,
        clean: matched - variances.length,
        excel_only: excelOnly,
        db_only: dbOnly,
        total_settlement_delta: roundTo2(totalDelta),
      },
      variances,
    });
  } catch (err) {
    console.error('RECONCILE ERROR:', err.message, err.stack);
    return Response.json({ error: err.message }, { status: 500 });
  }
});