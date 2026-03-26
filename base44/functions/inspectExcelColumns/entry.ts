import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5?target=deno';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

  const { file_url } = await req.json();
  const resp = await fetch(file_url);
  const buffer = await resp.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', raw: true, cellDates: false });

  const result = {};
  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { raw: true, defval: null });
    if (rows.length > 0) {
      const rowsWithPayment = rows.filter(r => {
        const val = r['DATE ATTORNEY PAID'];
        return val !== null && val !== undefined && val !== '';
      }).slice(0, 5);
      result[sheetName] = {
        total_rows: rows.length,
        rows_with_date_attorney_paid: rowsWithPayment.map(r => ({
          trace_no: r['TRACE NO'],
          date_attorney_paid: r['DATE ATTORNEY PAID'],
          draw_down_amount: r[' DRAW-DOWN AMOUNT '],
          attorney_interest: r[' ATTORNEY INTEREST '],
        })),
      };
    }
  }
  return Response.json(result);
});