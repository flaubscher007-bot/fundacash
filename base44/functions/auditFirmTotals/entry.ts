import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { law_firm } = await req.json();
  if (!law_firm) return Response.json({ error: 'law_firm required' }, { status: 400 });

  // Paginate through ALL transactions for this firm
  let all = [];
  let page = 0;
  const PAGE_SIZE = 500;
  while (true) {
    const batch = await base44.asServiceRole.entities.Transaction.filter(
      { law_firm },
      '-created_date',
      PAGE_SIZE,
      page * PAGE_SIZE
    );
    const items = Array.isArray(batch) ? batch : (batch.items || batch.results || []);
    if (!items.length) break;
    all.push(...items);
    if (items.length < PAGE_SIZE) break;
    page++;
    await new Promise(r => setTimeout(r, 150));
  }

  const total = all.length;

  // Drawdowns: records with a drawdown_amount > 0
  const drawdowns = all.filter(t => t.drawdown_amount > 0);
  const totalDrawdownAmount = drawdowns.reduce((s, t) => s + (t.drawdown_amount || 0), 0);
  const drawdownCount = drawdowns.length;

  // Settled: drawdowns with a settlement_payment_date set
  const settled = drawdowns.filter(t => t.settlement_payment_date);
  const settledAmount = settled.reduce((s, t) => s + (t.drawdown_amount || 0), 0);

  // Total invoiced (for all records with total_invoiced)
  const totalInvoiced = all.reduce((s, t) => s + (t.total_invoiced || 0), 0);

  // Cancelled: drawdown_amount is null/0/missing
  const cancelled = all.filter(t => !t.drawdown_amount || t.drawdown_amount === 0);

  // Breakdown by draw_no
  const byDraw = {};
  for (const t of all) {
    const d = t.draw_no || 'UNKNOWN';
    if (!byDraw[d]) byDraw[d] = { count: 0, drawdown_amount: 0, total_invoiced: 0 };
    byDraw[d].count++;
    byDraw[d].drawdown_amount += t.drawdown_amount || 0;
    byDraw[d].total_invoiced += t.total_invoiced || 0;
  }

  return Response.json({
    law_firm,
    total_transactions: total,
    drawdown_count: drawdownCount,
    total_drawdown_amount: Math.round(totalDrawdownAmount * 100) / 100,
    settled_count: settled.length,
    settled_drawdown_amount: Math.round(settledAmount * 100) / 100,
    total_invoiced: Math.round(totalInvoiced * 100) / 100,
    cancelled_count: cancelled.length,
    cancelled_trace_nos: cancelled.map(t => t.trace_no),
    drawdown_breakdown_by_draw_no: byDraw,
  });
});