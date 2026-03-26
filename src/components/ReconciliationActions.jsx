import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, Wrench, Flag, Loader2, X, Check } from 'lucide-react';

export default function ReconciliationActions({ variance, onResolved }) {
  const [mode, setMode] = useState(null); // 'approve' | 'adjust' | 'flag' | null
  const [comment, setComment] = useState('');
  const [adjustField, setAdjustField] = useState('');
  const [adjustValue, setAdjustValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const numericDiffs = variance.diffs.filter(d => typeof d.excel === 'number');

  const handleSave = async () => {
    setSaving(true);
    const patch = {};
    const note = comment.trim();

    if (mode === 'approve') {
      patch.notes = `[RECON APPROVED] Minor variance approved. ${note}`.trim();
    } else if (mode === 'adjust' && adjustField && adjustValue !== '') {
      patch[adjustField] = Number(adjustValue);
      patch.notes = `[RECON ADJUSTED] ${adjustField} set to ${adjustValue}. ${note}`.trim();
    } else if (mode === 'flag') {
      patch.notes = `[RECON FLAGGED] Requires investigation. ${note}`.trim();
      patch.payment_status = 'OVERDUE';
    }

    if (Object.keys(patch).length === 0) { setSaving(false); return; }

    await base44.entities.Transaction.update(variance.transaction_id, patch);
    setSaving(false);
    setDone(true);
    setMode(null);
    setComment('');
    if (onResolved) onResolved(variance.trace_no, mode);
  };

  if (done) return (
    <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium mt-2">
      <Check className="w-3.5 h-3.5" /> Action applied
    </div>
  );

  return (
    <div className="mt-3 space-y-2">
      {!mode && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setMode('approve')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-400/10 text-emerald-400 border border-emerald-400/30 text-xs font-medium hover:bg-emerald-400/20 transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Approve Variance
          </button>
          <button
            onClick={() => setMode('adjust')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-400/10 text-blue-400 border border-blue-400/30 text-xs font-medium hover:bg-blue-400/20 transition-colors"
          >
            <Wrench className="w-3.5 h-3.5" /> Adjust Figure
          </button>
          <button
            onClick={() => setMode('flag')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-400/10 text-red-400 border border-red-400/30 text-xs font-medium hover:bg-red-400/20 transition-colors"
          >
            <Flag className="w-3.5 h-3.5" /> Flag for Investigation
          </button>
        </div>
      )}

      {mode && (
        <div className="bg-muted/20 border border-border rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground capitalize">
              {mode === 'approve' ? '✓ Approve Minor Variance' : mode === 'adjust' ? '⚙ Adjust Figure' : '⚑ Flag for Investigation'}
            </p>
            <button onClick={() => { setMode(null); setComment(''); }} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {mode === 'adjust' && numericDiffs.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <select
                value={adjustField}
                onChange={e => {
                  setAdjustField(e.target.value);
                  const d = numericDiffs.find(d => d.db_field === e.target.value);
                  if (d) setAdjustValue(String(d.excel));
                }}
                className="bg-input border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring flex-1"
              >
                <option value="">Select field to adjust...</option>
                {numericDiffs.map((d, i) => (
                  <option key={i} value={d.db_field || d.field}>{d.field}</option>
                ))}
              </select>
              <input
                type="number"
                value={adjustValue}
                onChange={e => setAdjustValue(e.target.value)}
                placeholder="New value"
                className="bg-input border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-32"
              />
            </div>
          )}

          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Add a comment (optional)..."
            rows={2}
            className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />

          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setMode(null); setComment(''); }}
              className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || (mode === 'adjust' && (!adjustField || adjustValue === ''))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              {saving ? 'Saving...' : 'Apply'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}