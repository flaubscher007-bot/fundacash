import { useState } from 'react';
import { Download, FileText, Calendar } from 'lucide-react';
import { jsPDF } from 'jspdf';

const fmt = (n) => `R ${Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-ZA') : '—';

export default function StatementTab({ firmName, transactions, agreement }) {
  const today = new Date();
  const [month, setMonth] = useState(today.toISOString().slice(0, 7));
  const [generating, setGenerating] = useState(false);

  const [year, mon] = month.split('-').map(Number);
  const startOfMonth = new Date(year, mon - 1, 1);
  const endOfMonth = new Date(year, mon, 0, 23, 59, 59);

  // Transactions active in the selected month
  const activeInMonth = transactions.filter(t => {
    if (!t.drawdown_amount) return false;
    const dd = t.drawdown_date ? new Date(t.drawdown_date) : null;
    if (dd && dd > endOfMonth) return false;
    return true;
  });

  const totalCapital = activeInMonth.reduce((s, t) => s + (t.drawdown_amount || 0), 0);
  const totalInterest = activeInMonth.reduce((s, t) => s + (t.attorney_interest || 0), 0);
  const totalPaid = activeInMonth.reduce((s, t) => s + (t.amount_attorney_paid || 0), 0);
  const outstanding = totalCapital + totalInterest - totalPaid;

  const generatePDF = async () => {
    setGenerating(true);
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    let y = 20;

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('FUNDACASH', 20, y);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Medical Legal Funding Statement', 20, y + 7);
    y += 20;

    // Statement details
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Statement for: ${firmName}`, 20, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Period: ${new Date(year, mon - 1, 1).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}`, 20, y);
    doc.text(`Generated: ${today.toLocaleDateString('en-ZA')}`, pageW - 20, y, { align: 'right' });
    y += 5;
    if (agreement?.annual_interest_rate) {
      doc.text(`Interest Rate: ${agreement.annual_interest_rate}% per annum`, 20, y);
    }
    y += 12;

    // Summary box
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(15, y, pageW - 30, 30, 3, 3, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('SUMMARY', 22, y + 8);
    const summaryItems = [
      ['Total Capital Advanced', fmt(totalCapital)],
      ['Interest Accrued', fmt(totalInterest)],
      ['Total Repaid', fmt(totalPaid)],
      ['Outstanding Balance', fmt(outstanding)],
    ];
    summaryItems.forEach(([label, val], i) => {
      const col = i < 2 ? 22 : pageW / 2 + 5;
      const row = i % 2 === 0 ? y + 15 : y + 23;
      doc.setFont('helvetica', 'normal');
      doc.text(`${label}:`, col, row);
      doc.setFont('helvetica', 'bold');
      doc.text(val, col + 55, row);
    });
    y += 40;

    // Table header
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(30, 41, 59);
    doc.setTextColor(255, 255, 255);
    doc.rect(15, y, pageW - 30, 8, 'F');
    const cols = [20, 55, 100, 130, 158];
    const headers = ['Trace No', 'Client Name', 'Draw-Down', 'Interest', 'Amount Paid'];
    headers.forEach((h, i) => doc.text(h, cols[i], y + 5.5));
    doc.setTextColor(0, 0, 0);
    y += 10;

    // Table rows
    doc.setFont('helvetica', 'normal');
    for (const t of activeInMonth) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      const rowData = [
        t.trace_no || '—',
        (t.client_name || '—').slice(0, 22),
        fmt(t.drawdown_amount),
        fmt(t.attorney_interest),
        fmt(t.amount_attorney_paid),
      ];
      const bg = activeInMonth.indexOf(t) % 2 === 0;
      if (bg) {
        doc.setFillColor(249, 250, 251);
        doc.rect(15, y - 4, pageW - 30, 8, 'F');
      }
      rowData.forEach((v, i) => doc.text(v, cols[i], y + 0.5));
      y += 8;
    }

    // Footer
    y += 10;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 100);
    doc.text('This statement is generated automatically by FundaCash. E&OE.', 20, y);

    const fileName = `${firmName.replace(/ /g, '_')}_Statement_${month}.pdf`;
    doc.save(fileName);
    setGenerating(false);
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Statement Month
            </label>
            <input
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <button
            onClick={generatePDF}
            disabled={generating}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            <Download className="w-4 h-4" />
            {generating ? 'Generating...' : 'Download PDF Statement'}
          </button>
        </div>
      </div>

      {/* Preview Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Accounts', value: activeInMonth.length.toString() },
          { label: 'Capital Advanced', value: fmt(totalCapital) },
          { label: 'Interest Accrued', value: fmt(totalInterest) },
          { label: 'Outstanding Balance', value: fmt(outstanding), highlight: true },
        ].map(({ label, value, highlight }) => (
          <div key={label} className={`bg-card border rounded-xl p-4 ${highlight ? 'border-primary/40' : 'border-border'}`}>
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className={`mt-1 text-lg font-space font-semibold ${highlight ? 'text-primary' : 'text-foreground'}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Preview Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <h3 className="font-space font-semibold text-foreground">
            Statement Preview — {new Date(year, mon - 1, 1).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {['Trace No', 'Client Name', 'Draw-Down Date', 'Capital', 'Interest', 'Paid', 'Outstanding'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeInMonth.slice(0, 50).map((t, i) => {
                const balance = (t.drawdown_amount || 0) + (t.attorney_interest || 0) - (t.amount_attorney_paid || 0);
                return (
                  <tr key={t.id} className={`border-b border-border/50 ${i % 2 ? 'bg-muted/5' : ''}`}>
                    <td className="px-4 py-2.5 font-mono text-xs text-primary">{t.trace_no}</td>
                    <td className="px-4 py-2.5 text-foreground max-w-[200px] truncate">{t.client_name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{fmtDate(t.drawdown_date)}</td>
                    <td className="px-4 py-2.5 text-foreground text-right">{fmt(t.drawdown_amount)}</td>
                    <td className="px-4 py-2.5 text-amber-400 text-right">{fmt(t.attorney_interest)}</td>
                    <td className="px-4 py-2.5 text-emerald-400 text-right">{fmt(t.amount_attorney_paid)}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-foreground">{fmt(balance)}</td>
                  </tr>
                );
              })}
              {activeInMonth.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No active transactions this month.</td></tr>
              )}
            </tbody>
            {activeInMonth.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/20">
                  <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-foreground">TOTALS</td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground">{fmt(totalCapital)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-amber-400">{fmt(totalInterest)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-400">{fmt(totalPaid)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-primary">{fmt(outstanding)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}