import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Allow scheduled automation (no user auth) or admin user
  let isAutomation = false;
  try {
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch {
    // Called from automation without user token — use service role
    isAutomation = true;
  }

  const client = isAutomation ? base44.asServiceRole : base44;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Fetch all transactions that are not yet fully paid
  const transactions = await client.entities.Transaction.list('-created_date', 5000);

  const pending = transactions.filter(t =>
    t.settlement_payment_date &&
    t.payment_status !== 'PAID' &&
    t.approved !== 'CANCELLED'
  );

  const alerts = [];

  for (const t of pending) {
    const settlementDate = new Date(t.settlement_payment_date);
    settlementDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round((settlementDate - today) / (1000 * 60 * 60 * 24));

    let alertType = null;

    if (diffDays < 0) {
      // Overdue — alert every 7 days after due date
      const daysPastDue = Math.abs(diffDays);
      if (daysPastDue % 7 === 0 || daysPastDue === 1) {
        alertType = 'overdue';
      }
    } else if (diffDays === 90) {
      alertType = '3_months';
    } else if (diffDays < 90 && diffDays > 0 && diffDays % 7 === 0) {
      alertType = 'weekly_reminder';
    }

    if (!alertType) continue;

    const contactEmail = getContactEmail(t.law_firm);
    if (!contactEmail) continue;

    const fmt = (n) => `R ${Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';

    const newCapital = Number(t.new_capital_amount) || (Number(t.drawdown_amount || 0) + Number(t.funda_interest || 0));
    const amountPaid = Number(t.amount_attorney_paid || 0);
    const outstanding = Math.max(0, newCapital - amountPaid);

    let subject, urgencyLine;

    if (alertType === 'overdue') {
      const daysPast = Math.abs(diffDays);
      subject = `⚠️ OVERDUE Payment — ${t.client_name} (${t.trace_no}) — ${daysPast} day${daysPast !== 1 ? 's' : ''} overdue`;
      urgencyLine = `<p style="color:#ef4444;font-weight:bold;font-size:16px;">This payment is now <strong>${daysPast} day${daysPast !== 1 ? 's' : ''} overdue</strong>.</p>`;
    } else if (alertType === '3_months') {
      subject = `📅 Settlement Due in 3 Months — ${t.client_name} (${t.trace_no})`;
      urgencyLine = `<p style="color:#f59e0b;font-weight:bold;">Settlement date is in <strong>90 days</strong>. Please plan accordingly.</p>`;
    } else {
      const weeks = Math.ceil(diffDays / 7);
      subject = `🔔 Settlement Reminder — ${t.client_name} (${t.trace_no}) — Due in ${diffDays} days`;
      urgencyLine = `<p style="color:#f59e0b;font-weight:bold;">Settlement date is in <strong>${diffDays} days</strong> (${weeks} week${weeks !== 1 ? 's' : ''}).</p>`;
    }

    const body = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Inter,Arial,sans-serif;background:#0f1729;color:#e2e8f0;margin:0;padding:0;">
  <div style="max-width:600px;margin:40px auto;background:#151f38;border-radius:12px;overflow:hidden;border:1px solid #1e2d4a;">
    <div style="background:#1e2d4a;padding:24px 32px;border-bottom:1px solid #1e3a5f;">
      <h1 style="margin:0;font-size:22px;color:#f8fafc;">FundaCash <span style="color:#f59e0b;">MLF Tracker</span></h1>
      <p style="margin:4px 0 0;font-size:13px;color:#94a3b8;">Settlement Date Alert</p>
    </div>
    <div style="padding:32px;">
      ${urgencyLine}
      <table style="width:100%;border-collapse:collapse;margin-top:20px;font-size:14px;">
        <tr style="border-bottom:1px solid #1e2d4a;">
          <td style="padding:10px 0;color:#94a3b8;width:45%;">Client Name</td>
          <td style="padding:10px 0;color:#f8fafc;font-weight:600;">${t.client_name}</td>
        </tr>
        <tr style="border-bottom:1px solid #1e2d4a;">
          <td style="padding:10px 0;color:#94a3b8;">Trace No</td>
          <td style="padding:10px 0;color:#f59e0b;font-family:monospace;">${t.trace_no}</td>
        </tr>
        <tr style="border-bottom:1px solid #1e2d4a;">
          <td style="padding:10px 0;color:#94a3b8;">Attorney Ref</td>
          <td style="padding:10px 0;color:#f8fafc;">${t.attorney_ref_no || '—'}</td>
        </tr>
        <tr style="border-bottom:1px solid #1e2d4a;">
          <td style="padding:10px 0;color:#94a3b8;">Draw No</td>
          <td style="padding:10px 0;color:#f8fafc;">${t.draw_no || '—'}</td>
        </tr>
        <tr style="border-bottom:1px solid #1e2d4a;">
          <td style="padding:10px 0;color:#94a3b8;">Settlement Date</td>
          <td style="padding:10px 0;color:#f8fafc;font-weight:600;">${fmtDate(t.settlement_payment_date)}</td>
        </tr>
        <tr style="border-bottom:1px solid #1e2d4a;">
          <td style="padding:10px 0;color:#94a3b8;">Capital Balance</td>
          <td style="padding:10px 0;color:#f8fafc;">${fmt(newCapital)}</td>
        </tr>
        <tr style="border-bottom:1px solid #1e2d4a;">
          <td style="padding:10px 0;color:#94a3b8;">Amount Paid</td>
          <td style="padding:10px 0;color:#34d399;">${fmt(amountPaid)}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#94a3b8;">Outstanding Balance</td>
          <td style="padding:10px 0;color:#ef4444;font-weight:700;font-size:16px;">${fmt(outstanding)}</td>
        </tr>
      </table>
      ${t.notes ? `<div style="margin-top:20px;padding:14px;background:#1e2d4a;border-radius:8px;font-size:13px;color:#94a3b8;"><strong style="color:#f8fafc;">Notes:</strong> ${t.notes}</div>` : ''}
    </div>
    <div style="padding:16px 32px;background:#0f1729;font-size:12px;color:#64748b;text-align:center;">
      This is an automated alert from FundaCash MLF Tracker. Please do not reply to this email.
    </div>
  </div>
</body>
</html>`;

    await client.integrations.Core.SendEmail({
      to: contactEmail,
      subject,
      body,
    });

    alerts.push({ trace_no: t.trace_no, client: t.client_name, alertType, sentTo: contactEmail });
  }

  return Response.json({
    success: true,
    processed: pending.length,
    alertsSent: alerts.length,
    alerts,
    timestamp: new Date().toISOString(),
  });
});

function getContactEmail(lawFirm) {
  // Map firm names to contact emails — update these as needed
  const emails = {
    'S STEYN INCORPORATED': 'contact@ssteyn.co.za',
    'LHL ATTORNEYS': 'contact@lhlattorneys.co.za',
    'DBVS ATTORNEYS': 'contact@dbvs.co.za',
    'RH LAWYERS': 'contact@rhlawyers.co.za',
    'A WOLMARANS INCORPORATED': 'contact@wolmarans.co.za',
  };
  return emails[lawFirm] || null;
}