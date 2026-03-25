import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { transaction_id, trace_no, action, changes, description } = await req.json();

  if (!transaction_id || !action) {
    return Response.json({ error: 'transaction_id and action are required' }, { status: 400 });
  }

  // Only log if there are actual changes (for 'updated' action)
  if (action === 'updated' && (!changes || changes.length === 0)) {
    return Response.json({ skipped: true });
  }

  const entry = await base44.entities.AuditLog.create({
    transaction_id,
    trace_no,
    user_email: user.email,
    action,
    changes: changes || [],
    description: description || '',
    timestamp: new Date().toISOString(),
  });

  return Response.json({ success: true, entry });
});