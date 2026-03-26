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
      result[sheetName] = {
        column_names: Object.keys(rows[0]),
        sample_row: rows[0],
        // Find rows with payment-related data
        rows_with_dates: rows.slice(0, 500).filter(r => {
          return Object.values(r).some(v => v && String(v).match(/date|paid|settled|settlement/i));
        }).slice(0, 3),
      };
    }
  }
  return Response.json(result);
});