import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { current_password, new_password } = await req.json();

  if (!current_password || !new_password) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (new_password.length < 8) {
    return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  try {
    await base44.auth.changePassword(current_password, new_password);
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message || 'Failed to change password' }, { status: 401 });
  }
});