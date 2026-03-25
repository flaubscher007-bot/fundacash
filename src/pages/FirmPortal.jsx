import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Building2, Upload, ExternalLink, ChevronDown, ChevronUp, CheckCircle2, Clock, AlertTriangle, Download } from 'lucide-react';
import { exportTransactionsCsv } from '../utils/exportCsv';

const fmt = (n) => n ? `R ${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 0 })}` : '—';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function FirmPortal() {
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [uploading, setUploading] = useState({});

  useEffect(() => {
    base44.auth.me().then(async (me) => {
      setUser(me);
      if (me?.assigned_firm) {
        const [txns, docs] = await Promise.all([
          base44.entities.Transaction.filter({ law_firm: me.assigned_firm }, '-drawdown_date', 2000),
          base44.entities.Document.filter({ firm_name: me.assigned_firm }, '-created_date', 1000),
        ]);
        setTransactions(txns);
        setDocuments(docs);
      }
      setLoading(false);
    });
  }, []);

  const stats = useMemo(() => {
    const drawdown = transactions.reduce((s, t) => s + (t.drawdown_amount || 0), 0);
    const outstanding = transactions
      .filter(t => t.payment_status !== 'PAID')
      .reduce((s, t) => s + Math.max(0, (Number(t.new_capital_amount) || Number(t.drawdown_amount) || 0) - (t.amount_attorney_paid || 0)), 0);
    const paid = transactions.reduce((s, t) => s + (t.amount_attorney_paid || 0), 0);
    const settled = transactions.filter(t => t.payment_status === 'PAID').length;
    return { drawdown, outstanding, paid, settled };
  }, [transactions]);

  const handleUpload = async (txn, file, paymentAmount) => {
    setUploading(p => ({ ...p, [txn.id]: true }));
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const doc = await base44.entities.Document.create({
      firm_name: txn.law_firm,
      transaction_id: txn.id,
      trace_no: txn.trace_no,
      client_name: txn.client_name,
      document_type: 'Proof of Payment - Part Payment (Attorney Email)',
      file_url,
      file_name: file.name,
      upload_date: new Date().toISOString().split('T')[0],
      review_status: 'PENDING_REVIEW',
      payment_amount: paymentAmount ? Number(paymentAmount) : undefined,
    });
    setDocuments(prev => [doc, ...prev]);
    setUploading(p => ({ ...p, [txn.id]: false }));
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!user?.assigned_firm) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
      <Building2 className="w-10 h-10 text-muted-foreground" />
      <p className="text-foreground font-semibold">No firm assigned</p>
      <p className="text-muted-foreground text-sm">Please contact your administrator to assign you to a law firm.</p>
    </div>
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Building2 className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="font-space text-2xl font-bold text-foreground">{user.assigned_firm}</h1>
          <p className="text-muted-foreground text-sm">Firm Portal · {transactions.length} transactions</p>
        </div>
      </div>

      {/* Export button */}
      <div className="flex justify-end">
        <button
          onClick={() => exportTransactionsCsv(transactions, `${user.assigned_firm.replace(/\s+/g, '_').toLowerCase()}_transactions.csv`)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Advanced', value: fmt(stats.drawdown), color: 'text-primary' },
          { label: 'Outstanding Balance', value: fmt(stats.outstanding), color: 'text-amber-400' },
          { label: 'Total Repaid', value: fmt(stats.paid), color: 'text-emerald-400' },
          { label: 'Settled Matters', value: stats.settled, color: 'text-blue-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className={`mt-1 text-xl font-space font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Transactions list */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-space font-semibold text-foreground">Transactions</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Click a row to expand details and upload proof of payment</p>
        </div>

        <div className="divide-y divide-border/60">
          {transactions.length === 0 && (
            <p className="text-center py-12 text-muted-foreground text-sm">No transactions found.</p>
          )}
          {transactions.map(t => {
            const isOpen = expandedId === t.id;
            const outstanding = Math.max(0, (Number(t.new_capital_amount) || Number(t.drawdown_amount) || 0) - (t.amount_attorney_paid || 0));
            const txnDocs = documents.filter(d => d.transaction_id === t.id);
            const isUploading = uploading[t.id];

            return (
              <div key={t.id}>
                {/* Row */}
                <button
                  onClick={() => setExpandedId(isOpen ? null : t.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1">
                    <div>
                      <p className="text-xs text-muted-foreground">Trace No</p>
                      <p className="text-sm font-mono text-primary font-medium">{t.trace_no}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Client</p>
                      <p className="text-sm text-foreground truncate">{t.client_name}</p>
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-xs text-muted-foreground">Draw-Down</p>
                      <p className="text-sm font-medium text-foreground">{fmt(t.drawdown_amount)}</p>
                    </div>
                    <div className="hidden sm:flex items-center gap-2">
                      <PayStatusBadge status={t.payment_status} />
                      {t.payment_status !== 'PAID' && (
                        <span className="text-sm font-semibold text-amber-400">{fmt(outstanding)}</span>
                      )}
                    </div>
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="px-5 pb-5 bg-muted/10 border-t border-border/40 space-y-4">
                    {/* Detail grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 pt-4">
                      {[
                        { label: 'Draw No', val: t.draw_no },
                        { label: 'Drawdown Date', val: fmtDate(t.drawdown_date) },
                        { label: 'Interest Start', val: fmtDate(t.attorney_interest_start_date) },
                        { label: 'Invoice No', val: t.invoice_no },
                        { label: 'Total Invoiced', val: fmt(t.total_invoiced) },
                        { label: 'Funda Interest', val: fmt(t.funda_interest) },
                        { label: 'Attorney Interest', val: fmt(t.attorney_interest) },
                        { label: 'New Capital Balance', val: fmt(t.new_capital_amount || (Number(t.drawdown_amount || 0) + Number(t.funda_interest || 0))) },
                        { label: 'Amount Paid', val: fmt(t.amount_attorney_paid) },
                        { label: 'Settlement Date', val: fmtDate(t.settlement_payment_date) },
                        { label: 'Outstanding', val: fmt(outstanding) },
                      ].map(({ label, val }) => (
                        <div key={label}>
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className="text-sm font-medium text-foreground">{val || '—'}</p>
                        </div>
                      ))}
                    </div>

                    {/* Proof of payment upload */}
                    {t.payment_status !== 'PAID' && (
                      <UploadProofForm txn={t} isUploading={isUploading} onUpload={handleUpload} />
                    )}

                    {/* Existing docs */}
                    {txnDocs.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Uploaded Documents</p>
                        <div className="space-y-1.5">
                          {txnDocs.map(doc => {
                              const rs = doc.review_status || 'PENDING_REVIEW';
                              const rsStyle = { PENDING_REVIEW: 'text-amber-400', APPROVED: 'text-emerald-400', REJECTED: 'text-red-400' }[rs];
                              return (
                                <div key={doc.id} className="flex items-center gap-3 bg-card border border-border/60 rounded-lg px-3 py-2">
                                  <span className="text-xs text-foreground flex-1 truncate">{doc.file_name}</span>
                                  <span className={`text-xs font-medium whitespace-nowrap ${rsStyle}`}>{rs.replace('_', ' ')}</span>
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(doc.upload_date)}</span>
                                  {doc.admin_comments && <span className="text-xs text-muted-foreground italic truncate max-w-[100px]" title={doc.admin_comments}>"{doc.admin_comments}"</span>}
                                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function UploadProofForm({ txn, isUploading, onUpload }) {
  const [amount, setAmount] = useState('');
  const [file, setFile] = useState(null);

  const handleSubmit = () => {
    if (!file) return;
    onUpload(txn, file, amount);
    setFile(null);
    setAmount('');
  };

  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <p className="text-sm font-semibold text-foreground">Upload Proof of Payment</p>
      <p className="text-xs text-muted-foreground">Your proof will be submitted for admin review before being applied to your balance.</p>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground font-medium block mb-1">Payment Amount (R)</label>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="e.g. 15000"
            className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-muted-foreground font-medium block mb-1">Proof Document</label>
          <label className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors ${isUploading ? 'opacity-60 pointer-events-none' : ''}`}>
            <Upload className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{file ? file.name : 'Choose PDF / JPG / PNG'}</span>
            <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files[0] || null)} />
          </label>
        </div>
      </div>
      {file && (
        <button
          onClick={handleSubmit}
          disabled={isUploading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          <Upload className="w-4 h-4" />
          {isUploading ? 'Uploading...' : 'Submit for Review'}
        </button>
      )}
    </div>
  );
}

function PayStatusBadge({ status }) {
  const map = {
    'PAID': 'bg-emerald-400/15 text-emerald-400',
    'PARTIAL': 'bg-amber-400/15 text-amber-400',
    'OVERDUE': 'bg-red-400/15 text-red-400',
    'PENDING': 'bg-muted text-muted-foreground',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${map[status] || 'bg-muted text-muted-foreground'}`}>
      {status || '—'}
    </span>
  );
}