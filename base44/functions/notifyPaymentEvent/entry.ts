import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { action, doc } = await req.json();

    // action: 'APPROVED' | 'REJECTED'
    // doc: { id, firm_name, trace_no, client_name, payment_amount, admin_comments, transaction_id }

    const isApproved = action === 'APPROVED';
    const amtStr = doc.payment_amount ? `R ${Number(doc.payment_amount).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : '';
    const title = isApproved
      ? `Payment Approved${amtStr ? ` · ${amtStr}` : ''}`
      : `Proof of Payment Rejected`;
    const message = isApproved
      ? `A proof of payment${amtStr ? ` of ${amtStr}` : ''} for ${doc.client_name || doc.trace_no} (${doc.trace_no || ''}) has been approved and applied to the account.`
      : `Your submitted proof of payment for ${doc.client_name || doc.trace_no} (${doc.trace_no || ''}) was rejected.${doc.admin_comments ? ` Reason: ${doc.admin_comments}` : ''}`;

    // Get admin users
    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    // Get firm users for this firm
    const firmUsers = await base44.asServiceRole.entities.User.filter({ assigned_firm: doc.firm_name });

    const recipients = [
      ...admins.map(u => ({ email: u.email, name: u.full_name })),
      ...firmUsers.map(u => ({ email: u.email, name: u.full_name })),
    ];
    // De-duplicate
    const seen = new Set();
    const uniqueRecipients = recipients.filter(r => {
      if (seen.has(r.email)) return false;
      seen.add(r.email);
      return true;
    });

    // Send emails + create in-app notifications
    await Promise.all(uniqueRecipients.flatMap(r => [
      base44.asServiceRole.integrations.Core.SendEmail({
        to: r.email,
        from_name: 'FundaCash',
        subject: title,
        body: `<p>Dear ${r.name || r.email},</p><p>${message}</p><p style="color:#888;font-size:12px">FundaCash · Fundamedical Payment Management</p>`,
      }),
      base44.asServiceRole.entities.Notification.create({
        recipient_email: r.email,
        firm_name: doc.firm_name,
        type: isApproved ? 'payment_approved' : 'payment_rejected',
        title,
        message,
        transaction_id: doc.transaction_id || '',
        trace_no: doc.trace_no || '',
        is_read: false,
      }),
    ]));

    return Response.json({ ok: true, notified: uniqueRecipients.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});