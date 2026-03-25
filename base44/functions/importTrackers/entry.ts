import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import * as XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { fileUrl, lawFirm } = await req.json();

  // Download the file
  const resp = await fetch(fileUrl);
  const buffer = await resp.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });

  // Use FULL TRACKER sheet
  const sheetName = wb.SheetNames.find(n => n.includes('FULL TRACKER') || n.includes('Full Tracker')) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

  const toDate = (v) => {
    if (!v) return null;
    if (v instanceof Date) return v.toISOString().split('T')[0];
    if (typeof v === 'string' && v.match(/\d{4}-\d{2}-\d{2}/)) return v.split('T')[0];
    return null;
  };

  const toNum = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
  };

  const normalize = (v) => {
    if (!v) return null;
    const s = String(v).trim().toUpperCase();
    if (s === 'YES' || s === 'NO' || s === 'PENDING' || s === 'CANCELLED') return s;
    return 'PENDING';
  };

  const records = rows
    .filter(r => r['TRACE NO'] && r['CLIENT NAME'] && String(r['TRACE NO']).trim() !== 'Total')
    .map(r => ({
      trace_no: String(r['TRACE NO'] || '').trim(),
      attorney_ref_no: String(r['ATTORNEY REF NO.'] || r['ATTORNEY REF NO'] || '').trim(),
      client_name: String(r['CLIENT NAME'] || '').trim(),
      approved: normalize(r['APPROVED']),
      potential_drawdown: toNum(r['POTENTIAL DRAW-DOWN']),
      budget_amount: toNum(r['BUDGET AMOUNT']),
      drawn_down: String(r['DRAWN-DOWN'] || r['DRAW-DOWN'] || '').trim(),
      drawdown_amount: toNum(r['DRAW-DOWN AMOUNT']),
      drawdown_date: toDate(r['DRAWN-DOWN DATE'] || r['DRAWDOWN DATE']),
      mlf: String(r['MLF'] || 'YES').trim(),
      law_firm: lawFirm,
      account_number: String(r['ACCOUNT NUMBER'] || '').trim(),
      contact_person: String(r['CONTACT PERSON'] || '').trim(),
      expert_name: String(r['EXPERT NAME'] || '').trim(),
      product: String(r['PRODUCT'] || '').trim(),
      date_of_assessment: toDate(r['DATE OF ASSESSMENT']),
      assessment_status: String(r['ASSESSMENT STATUS'] || 'SEEN').trim(),
      invoice_date: toDate(r['INVOICE DATE'] || r['Invoice Date']),
      invoice_no: String(r['INVOICE NO'] || '').trim(),
      total_invoiced: toNum(r['TOTAL INVOICED']),
      draw_no: String(r['DRAW NO'] || r['DRAW NUMBER'] || r['DRAWN-DOWN'] || '').trim(),
      attorney_interest_start_date: toDate(r['ATTORNEY INTEREST START DATE'] || r['INTEREST START DATE']),
      second_payment: toNum(r['SECOND PAYMENT']),
      attorney_interest: toNum(r['ATTORNEY INTEREST']),
      funda_interest: toNum(r['FUNDA AMOUNT'] || r['FUNDA INTEREST']),
      amount_attorney_paid: toNum(r['AMOUNT ATTORNEY PAID'] || r['AMOUNT PAID']),
      new_capital_amount: toNum(r['NEW CAPITAL AMOUNT']),
      notes: '',
    }));

  // Bulk create in batches of 100
  let created = 0;
  let errors = 0;
  for (let i = 0; i < records.length; i += 100) {
    const batch = records.slice(i, i + 100);
    const results = await base44.asServiceRole.entities.Transaction.bulkCreate(batch);
    created += batch.length;
  }

  return Response.json({ success: true, created, total: records.length, sheet: sheetName });
});