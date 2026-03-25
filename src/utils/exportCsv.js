export function exportTransactionsCsv(transactions, filename = 'transactions.csv') {
  const headers = [
    'Trace No', 'Attorney Ref No', 'Client Name', 'Law Firm', 'Draw No',
    'Approved', 'Drawdown Amount', 'Drawdown Date', 'Total Invoiced',
    'Invoice No', 'Invoice Date', 'Funda Interest', 'Attorney Interest',
    'New Capital Balance', 'Amount Paid', 'Outstanding', 'Payment Status',
    'Settlement Date', 'Interest Start Date', 'Expert Name', 'Product',
    'Contact Person', 'Notes',
  ];

  const rows = transactions.map(t => {
    const newCap = Number(t.new_capital_amount) || (Number(t.drawdown_amount || 0) + Number(t.funda_interest || 0));
    const paid = Number(t.amount_attorney_paid) || 0;
    const outstanding = Math.max(0, newCap - paid);
    return [
      t.trace_no, t.attorney_ref_no, t.client_name, t.law_firm, t.draw_no,
      t.approved, t.drawdown_amount, t.drawdown_date, t.total_invoiced,
      t.invoice_no, t.invoice_date, t.funda_interest, t.attorney_interest,
      newCap.toFixed(2), paid.toFixed(2), outstanding.toFixed(2), t.payment_status,
      t.settlement_payment_date, t.attorney_interest_start_date, t.expert_name, t.product,
      t.contact_person, t.notes,
    ];
  });

  const escape = (v) => {
    if (v == null || v === '') return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}