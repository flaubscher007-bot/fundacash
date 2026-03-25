import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, XCircle, ExternalLink, Clock, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmt = (n) => n ? `R ${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : '—';

const STATUS_STYLES = {
  PENDING_REVIEW: 'bg-amber-400/15 text-amber-400',
  APPROVED: 'bg-emerald-400/15 text-emerald-400',
  REJECTED: 'bg-red-400/15 text-red-400',
};

export default function ProofReview() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING_REVIEW');
  const [expanded, setExpanded] = useState(null);
  const [comments, setComments] = useState({});
  const [processing, setProcessing] = useState({});

  useEffect(() => {
    base44.entities.Document.list('-created_date', 500).then(data => {
      // Only show proof of payment documents
      setDocs(data.filter(d => d.document_type?.toLowerCase().includes('proof of payment')));
      setLoading(false);
    });
  }, []);

  const filtered = docs.filter(d => filter === 'ALL' ? true : (d.review_status || 'PENDING_REVIEW') === filter);

  const handleAction = async (doc, action) => {
    setProcessing(p => ({ ...p, [doc.id]: action }));
    const user = await base44.auth.me();
    const today = new Date().toISOString().split('T')[0];

    const updatePayload = {
      review_status: action,
      admin_comments: comments[doc.id] || '',
      reviewed_by: user?.email || '',
      reviewed_date: today,
    };
    await base44.entities.Document.update(doc.id, updatePayload);

    // On APPROVED: update transaction amount_attorney_paid
    if (action === 'APPROVED' && doc.transaction_id && doc.payment_amount) {
      const txns = await base44.entities.Transaction.filter({ id: doc.transaction_id });
      if (txns[0]) {
        const txn = txns[0];
        const existingPaid = Number(txn.amount_attorney_paid) || 0;
        const newPaid = existingPaid + Number(doc.payment_amount);
        await base44.entities.Transaction.update(txn.id, { amount_attorney_paid: newPaid });
      }
    }

    // Send notifications (email + in-app)
    await base44.functions.invoke('notifyPaymentEvent', { action, doc: { ...doc, admin_comments: comments[doc.id] || doc.admin_comments || '' } });

    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, ...updatePayload } : d));
    setExpanded(null);
    setProcessing(p => ({ ...p, [doc.id]: null }));
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  const pendingCount = docs.filter(d => (d.review_status || 'PENDING_REVIEW') === 'PENDING_REVIEW').length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-space text-2xl font-bold text-foreground">Proof of Payment Review</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {pendingCount > 0 ? (
              <span className="text-amber-400 font-medium">{pendingCount} pending review</span>
            ) : 'All proofs reviewed'}
          </p>
        </div>
        {/* Filter tabs */}
        <div className="flex rounded-lg border border-border overflow-hidden text-sm">
          {['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ALL'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-2 font-medium transition-colors ${filter === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
            >
              {s === 'PENDING_REVIEW' ? 'Pending' : s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-sm">
          <Clock className="w-8 h-8 mb-3 opacity-40" />
          No {filter === 'ALL' ? '' : filter.toLowerCase().replace('_', ' ')} documents.
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(doc => {
          const isOpen = expanded === doc.id;
          const status = doc.review_status || 'PENDING_REVIEW';
          const isProcessing = processing[doc.id];

          return (
            <div key={doc.id} className="bg-card border border-border rounded-xl overflow-hidden">
              {/* Row */}
              <button
                onClick={() => setExpanded(isOpen ? null : doc.id)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors text-left"
              >
                <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-0.5">
                  <div>
                    <p className="text-xs text-muted-foreground">Firm</p>
                    <p className="text-sm font-medium text-foreground truncate">{doc.firm_name?.split(' ')[0]}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Client / Trace</p>
                    <p className="text-sm text-foreground truncate">{doc.client_name || doc.trace_no || '—'}</p>
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-xs text-muted-foreground">Payment Amount</p>
                    <p className="text-sm font-semibold text-foreground">{fmt(doc.payment_amount)}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status]}`}>
                      {status.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-muted-foreground">{fmtDate(doc.upload_date)}</span>
                  </div>
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
              </button>

              {/* Expanded */}
              {isOpen && (
                <div className="px-5 pb-5 pt-4 border-t border-border/40 space-y-4 bg-muted/10">
                  {/* Detail grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {[
                      { label: 'Trace No', val: doc.trace_no },
                      { label: 'Document Type', val: doc.document_type },
                      { label: 'Payment Amount', val: fmt(doc.payment_amount) },
                      { label: 'Upload Date', val: fmtDate(doc.upload_date) },
                      { label: 'Reviewed By', val: doc.reviewed_by || '—' },
                      { label: 'Reviewed Date', val: fmtDate(doc.reviewed_date) },
                    ].map(({ label, val }) => (
                      <div key={label}>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-sm font-medium text-foreground">{val}</p>
                      </div>
                    ))}
                  </div>

                  {/* File link */}
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-primary hover:bg-muted transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View Document: {doc.file_name}
                  </a>

                  {/* Admin comments */}
                  {status === 'PENDING_REVIEW' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5" /> Admin Comments (optional)
                      </label>
                      <textarea
                        value={comments[doc.id] || ''}
                        onChange={e => setComments(p => ({ ...p, [doc.id]: e.target.value }))}
                        rows={2}
                        placeholder="Add reason for rejection or approval notes..."
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                      />
                    </div>
                  )}

                  {/* Existing comments */}
                  {status !== 'PENDING_REVIEW' && doc.admin_comments && (
                    <div className="px-3 py-2 bg-muted/30 rounded-lg text-sm text-muted-foreground italic">
                      "{doc.admin_comments}"
                    </div>
                  )}

                  {/* Action buttons */}
                  {status === 'PENDING_REVIEW' && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleAction(doc, 'APPROVED')}
                        disabled={!!isProcessing}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors disabled:opacity-60"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {isProcessing === 'APPROVED' ? 'Approving...' : 'Approve' + (doc.payment_amount ? ` & Apply ${fmt(doc.payment_amount)}` : '')}
                      </button>
                      <button
                        onClick={() => handleAction(doc, 'REJECTED')}
                        disabled={!!isProcessing}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-60"
                      >
                        <XCircle className="w-4 h-4" />
                        {isProcessing === 'REJECTED' ? 'Rejecting...' : 'Reject'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}