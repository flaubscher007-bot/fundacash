const fmt = (n) => n != null && n !== '' ? `R ${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

export default function InterestBreakdown({ form }) {
  const drawdown = Number(form.drawdown_amount) || 0;
  const fundaInterest = Number(form.funda_interest) || 0;
  const attorneyInterest = Number(form.attorney_interest) || 0;
  const newCapital = Number(form.new_capital_amount) || (drawdown + fundaInterest);
  const paid = Number(form.amount_attorney_paid) || 0;
  const outstanding = Math.max(0, newCapital - paid);

  const rows = [
    { label: 'Initial Draw-Down', value: drawdown, color: 'text-foreground' },
    { label: '+ Funda Interest', value: fundaInterest, color: 'text-amber-400' },
    { label: '+ Attorney Interest', value: attorneyInterest, color: 'text-orange-400' },
    { label: '= New Capital Balance', value: newCapital, color: 'text-primary', divider: true, bold: true },
    { label: '− Amount Repaid', value: paid, color: 'text-emerald-400' },
    { label: '= Outstanding Balance', value: outstanding, color: outstanding > 0 ? 'text-red-400' : 'text-emerald-400', divider: true, bold: true },
  ];

  if (!drawdown && !fundaInterest && !newCapital) return null;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h2 className="font-space font-semibold text-foreground">Balance Breakdown</h2>
        <p className="text-xs text-muted-foreground mt-0.5">How the current balance is derived</p>
      </div>
      <div className="p-6 space-y-0">
        {rows.map(({ label, value, color, divider, bold }) => (
          <div key={label}>
            {divider && <div className="border-t border-border/60 my-2" />}
            <div className="flex items-center justify-between py-1.5">
              <span className={`text-sm ${bold ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{label}</span>
              <span className={`text-sm font-mono font-semibold ${color}`}>{fmt(value)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}