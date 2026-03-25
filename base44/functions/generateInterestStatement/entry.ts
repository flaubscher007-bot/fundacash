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
  doc.setFontSize(18);
  doc.setTextColor(21, 128, 61);
  doc.text('INTEREST STATEMENT', pageWidth / 2, y, { align: 'center' });
  y += 12;

  // Firm & Transaction Details
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`Law Firm: ${txn.law_firm}`, 20, y);
  y += 6;
  doc.text(`Client: ${txn.client_name}`, 20, y);
  y += 6;
  doc.text(`Trace No: ${txn.trace_no}`, 20, y);
  y += 6;
  doc.text(`Statement Date: ${new Date().toLocaleDateString('en-ZA')}`, 20, y);
  y += 10;

  // Interest Summary
  doc.setFont(undefined, 'bold');
  doc.setFontSize(11);
  doc.text('INTEREST SUMMARY', 20, y);
  y += 8;
  doc.setFont(undefined, 'normal');
  doc.setFontSize(10);

  const fmt = (n) => Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const principal = txn.drawdown_amount || 0;
  const fundaInt = txn.funda_interest || 0;
  const attorneyInt = txn.attorney_interest || 0;
  const totalInt = fundaInt + attorneyInt;
  const newCapital = txn.new_capital_amount || (principal + fundaInt);
  const paid = txn.amount_attorney_paid || 0;
  const outstanding = Math.max(0, newCapital - paid);

  const summaryData = [
    [`Principal (Draw-Down):`, `R ${fmt(principal)}`],
    [`Fundamedical Interest:`, `R ${fmt(fundaInt)}`],
    [`Law Firm Interest:`, `R ${fmt(attorneyInt)}`],
    [`Total Interest:`, `R ${fmt(totalInt)}`],
    [``, ``],
    [`New Capital Amount:`, `R ${fmt(newCapital)}`],
    [`Amount Paid to Date:`, `R ${fmt(paid)}`],
    [`Outstanding Balance:`, `R ${fmt(outstanding)}`],
  ];

  summaryData.forEach(([label, value]) => {
    if (y > pageHeight - 40) {
      doc.addPage();
      y = 20;
    }
    if (label === '') {
      y += 4;
    } else {
      doc.text(label, 20, y);
      doc.text(value, 130, y);
      y += 6;
    }
  });
  y += 8;

  // Interest Calculation Details
  doc.setFont(undefined, 'bold');
  doc.text('INTEREST CALCULATION DETAILS', 20, y);
  y += 8;
  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);

  const calcDetails = [
    [`Fundamedical Interest Rate:`, `${ag.funda_interest_rate || '—'}% per month`],
    [`Law Firm Interest Rate:`, `${ag.attorney_interest_rate || '—'}% per month`],
    [`Interest Basis:`, ag.interest_basis || '365 days'],
    [`Interest Start Date:`, txn.attorney_interest_start_date || txn.drawdown_date || '—'],
    [`Days Elapsed:`, Math.floor((new Date() - new Date(txn.attorney_interest_start_date || txn.drawdown_date)) / (1000 * 60 * 60 * 24)).toString()],
  ];

  calcDetails.forEach(([label, value]) => {
    if (y > pageHeight - 30) {
      doc.addPage();
      y = 20;
    }
    doc.text(label, 20, y);
    doc.text(value, 100, y);
    y += 5;
  });
  y += 8;

  // Payment Schedule Note
  doc.setFont(undefined, 'bold');
  doc.setFontSize(10);
  doc.text('PAYMENT DUE', 20, y);
  y += 6;
  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);

  const dueDate = new Date(txn.drawdown_date || new Date());
  dueDate.setDate(dueDate.getDate() + (ag.payment_terms_days || 0));
  const dueDateStr = dueDate.toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' });

  doc.text(`Payment terms: ${ag.payment_terms_days || '—'} days`, 20, y);
  y += 5;
  doc.text(`Due date: ${dueDateStr}`, 20, y);
  y += 5;
  doc.text(`Amount due: R ${fmt(outstanding)}`, 20, y);

  // Footer
  y = pageHeight - 15;
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(`This is an automatically generated statement. For inquiries, contact your account manager.`, 20, y);
  doc.text(`Generated on ${new Date().toLocaleDateString('en-ZA')} at ${new Date().toLocaleTimeString('en-ZA')}`, pageWidth - 20, y, { align: 'right' });

  const pdfBuffer = doc.output('arraybuffer');
  return new Response(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=interest-statement-${txn.trace_no}.pdf`,
    },
  });
});