import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { transaction_id } = await req.json();
  const txn = (await base44.asServiceRole.entities.Transaction.list())[0];
  if (!txn) return Response.json({ error: 'Transaction not found' }, { status: 404 });

  const ag = (await base44.asServiceRole.entities.FirmAgreement.list()).find(a => a.firm_name === txn.law_firm);
  if (!ag) return Response.json({ error: 'Agreement not found' }, { status: 404 });

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 20;

  // Header
  doc.setFontSize(20);
  doc.setTextColor(21, 128, 61);
  doc.text('DRAWDOWN AGREEMENT', pageWidth / 2, y, { align: 'center' });
  y += 15;

  // Firm & Transaction Details
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`Law Firm: ${txn.law_firm}`, 20, y);
  y += 7;
  doc.text(`Client: ${txn.client_name}`, 20, y);
  y += 7;
  doc.text(`Trace No: ${txn.trace_no}`, 20, y);
  y += 7;
  doc.text(`Draw-Down Date: ${txn.drawdown_date || '—'}`, 20, y);
  y += 12;

  // Transaction Details Section
  doc.setFontSize(11);
  doc.setFont(undefined, 'bold');
  doc.text('TRANSACTION DETAILS', 20, y);
  y += 8;
  doc.setFont(undefined, 'normal');
  doc.setFontSize(10);

  const txnDetails = [
    [`Draw-Down Amount:`, `R ${Number(txn.drawdown_amount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`],
    [`Invoice Amount:`, `R ${Number(txn.total_invoiced || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`],
    [`Approved:`, txn.approved === 'YES' ? 'Yes' : 'No'],
    [`Status:`, txn.payment_status || '—'],
  ];

  txnDetails.forEach(([label, value]) => {
    doc.text(label, 20, y);
    doc.text(value, 120, y);
    y += 6;
  });
  y += 4;

  // Agreement Terms Section
  doc.setFont(undefined, 'bold');
  doc.text('AGREEMENT TERMS', 20, y);
  y += 8;
  doc.setFont(undefined, 'normal');

  const agTerms = [
    [`Fundamedical Interest Rate:`, `${ag.funda_interest_rate || '—'}% per month`],
    [`Law Firm Interest Rate:`, `${ag.attorney_interest_rate || '—'}% per month`],
    [`Interest Basis:`, ag.interest_basis || '365 days'],
    [`Interest Starts From:`, ag.interest_start_trigger?.replace('_', ' ') || 'Draw-Down Date'],
    [`Payment Terms:`, `${ag.payment_terms_days || '—'} days`],
    [`Capital Limit:`, `R ${Number(ag.capital_limit || 0).toLocaleString('en-ZA')}`],
    [`Admin Fee:`, ag.admin_fee_rate ? `${ag.admin_fee_rate}%` : (ag.admin_fee_fixed ? `R ${Number(ag.admin_fee_fixed).toLocaleString('en-ZA')}` : 'None')],
  ];

  agTerms.forEach(([label, value]) => {
    if (y > pageHeight - 30) {
      doc.addPage();
      y = 20;
    }
    doc.text(label, 20, y);
    doc.text(value, 120, y);
    y += 6;
  });
  y += 8;

  // Calculated Amounts Section
  doc.setFont(undefined, 'bold');
  doc.text('CALCULATED AMOUNTS', 20, y);
  y += 8;
  doc.setFont(undefined, 'normal');

  const calcs = [
    [`Fundamedical Interest:`, `R ${Number(txn.funda_interest || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`],
    [`Law Firm Interest:`, `R ${Number(txn.attorney_interest || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`],
    [`New Capital Amount:`, `R ${Number(txn.new_capital_amount || (Number(txn.drawdown_amount || 0) + Number(txn.funda_interest || 0))).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`],
  ];

  calcs.forEach(([label, value]) => {
    if (y > pageHeight - 30) {
      doc.addPage();
      y = 20;
    }
    doc.text(label, 20, y);
    doc.text(value, 120, y);
    y += 6;
  });

  // Footer
  y += 10;
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(`Generated on ${new Date().toLocaleDateString('en-ZA')}`, 20, pageHeight - 10);

  const pdfBuffer = doc.output('arraybuffer');
  return new Response(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=drawdown-agreement-${txn.trace_no}.pdf`,
    },
  });
});