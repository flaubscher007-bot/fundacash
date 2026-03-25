import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Computes interest days elapsed based on the agreement's interest_basis.
 * - "365 days"   → actual days / 365 × annual rate (we store monthly, so × 12)
 * - "30/360"     → uses 30-day months, 360-day year
 * - "Actual/360" → actual days / 360
 *
 * All rates stored as % per MONTH in the agreement.
 * We convert to annual (×12) then apply the chosen day-count convention.
 */
function computeInterest(principal, monthlyRatePct, startDate, today, basis) {
  if (!monthlyRatePct || monthlyRatePct <= 0) return 0;
  const annualRate = (monthlyRatePct / 100) * 12; // e.g. 3.5% per month → 42% per annum

  let interest = 0;
  if (basis === '30/360') {
    const y1 = startDate.getFullYear(), m1 = startDate.getMonth(), d1 = Math.min(startDate.getDate(), 30);
    const y2 = today.getFullYear(), m2 = today.getMonth(), d2 = Math.min(today.getDate(), 30);
    const days360 = (y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1);
    interest = principal * annualRate * (days360 / 360);
  } else if (basis === 'Actual/360') {
    const msPerDay = 1000 * 60 * 60 * 24;
    const actualDays = Math.floor((today - startDate) / msPerDay);
    interest = principal * annualRate * (actualDays / 360);
  } else {
    // Default: "365 days" — actual days / 365
    const msPerDay = 1000 * 60 * 60 * 24;
    const actualDays = Math.floor((today - startDate) / msPerDay);
    interest = principal * annualRate * (actualDays / 365);
  }

  return parseFloat(Math.max(0, interest).toFixed(2));
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Allow admin users or scheduled automation (no user context)
  const isAuthenticated = await base44.auth.isAuthenticated();
  if (isAuthenticated) {
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Load all firm agreements
  const agreements = await base44.asServiceRole.entities.FirmAgreement.list();
  const agreementMap = {};
  for (const ag of agreements) {
    agreementMap[ag.firm_name] = ag;
  }

  // Load all transactions
  const transactions = await base44.asServiceRole.entities.Transaction.list('-created_date', 10000);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let updated = 0;
  let skipped = 0;

  for (const txn of transactions) {
    const ag = agreementMap[txn.law_firm];
    if (!ag) { skipped++; continue; }
    if (txn.approved !== 'YES') { skipped++; continue; }
    if (!txn.drawdown_amount) { skipped++; continue; }

    // Skip fully paid
    if (txn.amount_attorney_paid && txn.amount_attorney_paid >= (txn.new_capital_amount || txn.drawdown_amount)) {
      skipped++; continue;
    }

    // Determine the interest start date based on the agreement trigger
    const trigger = ag.interest_start_trigger || 'drawdown_date';
    const startDateStr = trigger === 'invoice_date'
      ? txn.invoice_date
      : trigger === 'assessment_date'
        ? txn.date_of_assessment
        : txn.drawdown_date;

    if (!startDateStr) { skipped++; continue; }

    const startDate = new Date(startDateStr);
    startDate.setHours(0, 0, 0, 0);
    if (isNaN(startDate.getTime()) || startDate > today) { skipped++; continue; }

    const msPerDay = 1000 * 60 * 60 * 24;
    const daysElapsed = Math.floor((today - startDate) / msPerDay);
    if (daysElapsed <= 0) { skipped++; continue; }

    const basis = ag.interest_basis || '365 days';
    const principal = txn.drawdown_amount;

    const fundaInterest = computeInterest(principal, ag.funda_interest_rate, startDate, today, basis);
    const attorneyInterest = computeInterest(principal, ag.attorney_interest_rate, startDate, today, basis);

    // Admin fee (one-time, applied if configured — stored on the transaction once)
    let adminFee = 0;
    if (!txn._admin_fee_applied) {
      if (ag.admin_fee_rate) adminFee = parseFloat((principal * ag.admin_fee_rate / 100).toFixed(2));
      else if (ag.admin_fee_fixed) adminFee = ag.admin_fee_fixed;
    }

    const fundaChanged = Math.abs((txn.funda_interest || 0) - fundaInterest) > 0.01;
    const attorneyChanged = Math.abs((txn.attorney_interest || 0) - attorneyInterest) > 0.01;

    if (fundaChanged || attorneyChanged) {
      const updatePayload = {};
      const auditChanges = [];
      if (fundaChanged) {
        updatePayload.funda_interest = fundaInterest;
        auditChanges.push({ field: 'funda_interest', old_value: String(txn.funda_interest || 0), new_value: String(fundaInterest) });
      }
      if (attorneyChanged) {
        updatePayload.attorney_interest = attorneyInterest;
        auditChanges.push({ field: 'attorney_interest', old_value: String(txn.attorney_interest || 0), new_value: String(attorneyInterest) });
      }
      updatePayload.new_capital_amount = parseFloat((principal + fundaInterest + adminFee).toFixed(2));

      await base44.asServiceRole.entities.Transaction.update(txn.id, updatePayload);
      await base44.asServiceRole.entities.AuditLog.create({
        transaction_id: txn.id,
        trace_no: txn.trace_no,
        action: 'interest_calculated',
        description: `Interest updated: ${daysElapsed} days · basis: ${basis} · trigger: ${trigger}`,
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