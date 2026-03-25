import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Threshold: alert if individual transaction outstanding > R100,000 and overdue
const THRESHOLD_AMOUNT = 100000;
const OVERDUE_DAYS = 60;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const today = new Date();
    const transactions = await base44.asServiceRole.entities.Transaction.list('-drawdown_date', 5000);
    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });

    const alerts = [];

    for (const t of transactions) {
      if (t.payment_status === 'PAID' || t.approved !== 'YES' || !t.drawdown_date) continue;
      const outstanding = Math.max(0,
        (Number(t.new_capital_amount) || Number(t.drawdown_amount) || 0) - (t.amount_attorney_paid || 0)
      );
      if (outstanding < THRESHOLD_AMOUNT) continue;

      const drawDate = new Date(t.drawdown_date);
      const daysOld = Math.floor((today - drawDate) / (1000 * 60 * 60 * 24));
      if (daysOld < OVERDUE_DAYS) continue;

      // Check if we already sent a notification in the last 7 days
      const existing = await base44.asServiceRole.entities.Notification.filter({
        trace_no: t.trace_no,
        type: 'low_balance_threshold',
      });
      const recentlySent = existing.some(n => {
        const age = (today - new Date(n.created_date)) / (1000 * 60 * 60 * 24);
        return age < 7;
      });
      if (recentlySent) continue;

      const amtStr = `R ${outstanding.toLocaleString('en-ZA', { minimumFractionDigits: 0 })}`;
      const title = `High Outstanding Balance · ${t.trace_no}`;
      const msg = `Transaction ${t.trace_no} (${t.client_name}) for ${t.law_firm} has an outstanding balance of ${amtStr} and is ${daysOld} days old.`;

      // Notify admins
      for (const admin of admins) {
        await base44.asServiceRole.entities.Notification.create({
          recipient_email: admin.email,
          firm_name: t.law_firm,
          type: 'low_balance_threshold',
          title,
          message: msg,
          transaction_id: t.id,
          trace_no: t.trace_no,
          is_read: false,
        });
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: admin.email,
          from_name: 'FundaCash Alerts',
          subject: title,
          body: `<p>${msg}</p><p style="color:#888;font-size:12px">FundaCash · Automated Balance Alert</p>`,
        });
      }

      // Notify firm users
      const firmUsers = await base44.asServiceRole.entities.User.filter({ assigned_firm: t.law_firm });
      for (const u of firmUsers) {
        await base44.asServiceRole.entities.Notification.create({
          recipient_email: u.email,
          firm_name: t.law_firm,
          type: 'low_balance_threshold',
          title,
          message: msg,
          transaction_id: t.id,
          trace_no: t.trace_no,
          is_read: false,
        });
      }

      alerts.push(t.trace_no);
    }

    return Response.json({ ok: true, alerts_sent: alerts.length, traces: alerts });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});