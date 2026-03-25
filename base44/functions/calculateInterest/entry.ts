import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Allow both admin users and scheduled automation (no user context)
  const isAuthenticated = await base44.auth.isAuthenticated();
  if (isAuthenticated) {
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Fetch all agreements
  const agreements = await base44.asServiceRole.entities.FirmAgreement.list();
  const agreementMap = {};
  for (const ag of agreements) {
    agreementMap[ag.firm_name] = ag;
  }

  // Fetch all active transactions with a drawdown amount and interest start date
  const transactions = await base44.asServiceRole.entities.Transaction.list('-created_date', 10000);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let updated = 0;
  let skipped = 0;

  for (const txn of transactions) {
    const ag = agreementMap[txn.law_firm];
    if (!ag) { skipped++; continue; }

    // Interest always starts from the draw-down date (when amount hits Fundamedical's account)
    // Only calculate interest for approved transactions
    if (txn.approved !== 'YES') { skipped++; continue; }

    const startDateStr = txn.drawdown_date;

    if (!startDateStr || !txn.drawdown_amount) { skipped++; continue; }

    // If already paid out fully, skip
    if (txn.amount_attorney_paid && txn.amount_attorney_paid >= txn.drawdown_amount) {
      skipped++;
      continue;
    }

    const startDate = new Date(startDateStr);
    startDate.setHours(0, 0, 0, 0);
    if (isNaN(startDate.getTime()) || startDate > today) { skipped++; continue; }

    const msPerDay = 1000 * 60 * 60 * 24;
    const daysElapsed = Math.floor((today - startDate) / msPerDay);
    if (daysElapsed <= 0) { skipped++; continue; }

    const principal = txn.drawdown_amount;

    // Daily simple interest based on a monthly rate
    // daily_rate = monthly_rate / 30; total = principal × daily_rate × days_elapsed
    const fundaRate = (ag.funda_interest_rate || 0) / 100;
    const fundaInterest = parseFloat((principal * (fundaRate / 30) * daysElapsed).toFixed(2));

    const attorneyRate = (ag.attorney_interest_rate || 0) / 100;
    const attorneyInterest = parseFloat((principal * (attorneyRate / 30) * daysElapsed).toFixed(2));

    const fundaChanged = Math.abs((txn.funda_interest || 0) - fundaInterest) > 0.01;
    const attorneyChanged = Math.abs((txn.attorney_interest || 0) - attorneyInterest) > 0.01;

    if (fundaChanged || attorneyChanged) {
      const updatePayload = {};
      const auditChanges = [];
      if (fundaChanged) { updatePayload.funda_interest = fundaInterest; auditChanges.push({ field: 'funda_interest', old_value: String(txn.funda_interest || 0), new_value: String(fundaInterest) }); }
      if (attorneyChanged) { updatePayload.attorney_interest = attorneyInterest; auditChanges.push({ field: 'attorney_interest', old_value: String(txn.attorney_interest || 0), new_value: String(attorneyInterest) }); }
      updatePayload.new_capital_amount = parseFloat((principal + fundaInterest).toFixed(2));
      await base44.asServiceRole.entities.Transaction.update(txn.id, updatePayload);
      await base44.asServiceRole.entities.AuditLog.create({
        transaction_id: txn.id,
        trace_no: txn.trace_no,
        action: 'interest_calculated',
        description: `Daily interest update: ${daysElapsed} days elapsed (monthly rate basis)`,
        changes: auditChanges,
        timestamp: new Date().toISOString(),
      });
      updated++;
    } else {
      skipped++;
    }
  }

  return Response.json({
    success: true,
    processed: transactions.length,
    updated,
    skipped,
    timestamp: new Date().toISOString(),
  });
});