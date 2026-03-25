import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Clock, User, Edit3, Plus, TrendingUp, Trash2 } from 'lucide-react';

const ACTION_CONFIG = {
  created: { icon: Plus, color: 'text-emerald-400', bg: 'bg-emerald-400/15', label: 'Created' },
  updated: { icon: Edit3, color: 'text-blue-400', bg: 'bg-blue-400/15', label: 'Updated' },
  interest_calculated: { icon: TrendingUp, color: 'text-amber-400', bg: 'bg-amber-400/15', label: 'Interest Updated' },
  deleted: { icon: Trash2, color: 'text-red-400', bg: 'bg-red-400/15', label: 'Deleted' },
};

const FIELD_LABELS = {
  drawdown_amount: 'Draw-Down Amount',
  drawdown_date: 'Draw-Down Date',
  funda_interest: 'Funda Interest',
  attorney_interest: 'Attorney Interest',
  new_capital_amount: 'New Capital Amount',
  amount_attorney_paid: 'Amount Paid',
  payment_status: 'Payment Status',
  approved: 'Approved',
  settlement_payment_date: 'Settlement Date',
  total_invoiced: 'Total Invoiced',
  assessment_status: 'Assessment Status',
  attorney_interest_start_date: 'Interest Start Date',
};

const fmtTs = (ts) => ts ? new Date(ts).toLocaleString('en-ZA', {
  day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit'
}) : '—';

const fmtVal = (field, val) => {
  if (val === null || val === undefined || val === '') return '(empty)';
  const numFields = ['drawdown_amount','funda_interest','attorney_interest','new_capital_amount','amount_attorney_paid','total_invoiced'];
  if (numFields.includes(field) && !isNaN(Number(val))) {
    return `R ${Number(val).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
  }
  return String(val);
};

export default function ActivityTab({ transactionId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!transactionId || transactionId === 'new') { setLoading(false); return; }
    base44.entities.AuditLog.filter({ transaction_id: transactionId }, '-timestamp', 100).then(data => {
      setLogs(data);
      setLoading(false);
    });
  }, [transactionId]);

  if (loading) return (
    <div className="flex justify-center py-10">
      <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (logs.length === 0) return (
    <div className="text-center py-10 text-muted-foreground text-sm">No activity recorded yet.</div>
  );

  return (
    <div className="space-y-3">
      {logs.map((log, idx) => {
        const cfg = ACTION_CONFIG[log.action] || ACTION_CONFIG.updated;
        const Icon = cfg.icon;
        return (
          <div key={log.id} className="flex gap-4">
            {/* Timeline line */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                <Icon className={`w-4 h-4 ${cfg.color}`} />
              </div>
              {idx < logs.length - 1 && <div className="w-px flex-1 bg-border mt-2" />}
            </div>
            {/* Content */}
            <div className="flex-1 pb-4 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />{fmtTs(log.timestamp || log.created_date)}
                </span>
                {log.user_email && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <User className="w-3 h-3" />{log.user_email}
                  </span>
                )}
              </div>
              {log.description && (
                <p className="text-sm text-foreground mb-1">{log.description}</p>
              )}
              {log.changes && log.changes.length > 0 && (
                <div className="space-y-1 mt-2">
                  {log.changes.map((ch, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs bg-muted/30 rounded px-3 py-1.5">
                      <span className="text-muted-foreground font-medium min-w-[140px]">
                        {FIELD_LABELS[ch.field] || ch.field}
                      </span>
                      <span className="text-red-400/80 line-through">{fmtVal(ch.field, ch.old_value)}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-emerald-400">{fmtVal(ch.field, ch.new_value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}