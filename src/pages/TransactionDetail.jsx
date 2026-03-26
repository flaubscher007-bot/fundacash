import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  ArrowLeft, Edit, FileText, Clock, CheckCircle2, AlertTriangle,
  XCircle, ExternalLink, Download
} from 'lucide-react';

const fmt = (n) => n != null && n !== '' ? `R ${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const APPROVED_STYLES = {
  YES: 'bg-emerald-400/15 text-emerald-400',
  PENDING: 'bg-amber-400/15 text-amber-400',
  NO: 'bg-red-400/15 text-red-400',
  CANCELLED: 'bg-muted text-muted-foreground',
};
const PAY_STYLES = {
  PAID: 'bg-emerald-400/15 text-emerald-400',
  PARTIAL: 'bg-amber-400/15 text-amber-400',
  OVERDUE: 'bg-red-400/15 text-red-400',
  PENDING: 'bg-muted text-muted-foreground',
};

export default function TransactionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [txn, setTxn] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('details');

  useEffect(() => {
    Promise.all([
      base44.entities.Transaction.filter({ id }),
      base44.entities.Document.filter({ transaction_id: id }, '-created_date', 200),
      base44.entities.AuditLog.filter({ transaction_id: id }, '-timestamp', 100),
    ]).then(([txns, docs, logs]) => {
      setTxn(txns[0] || null);
      setDocuments(docs);
      setAuditLogs(logs);
      setLoading(false);
    });
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!txn) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
      <XCircle className="w-8 h-8" />
      <p>Transaction not found.</p>
      <button onClick={() => navigate(-1)} className="text-primary hover:underline text-sm">Go back</button>
    </div>
  );

  const newCapital = Number(txn.new_capital_amount) || (Number(txn.drawdown_amount || 0) + Number(txn.funda_interest || 0));
  const amountPaid = Number(txn.amount_attorney_paid || 0);
  const shortfall = newCapital > 0 && amountPaid > 0 && amountPaid < newCapital ? newCapital - amountPaid : 0;
  const isSettled = amountPaid > 0 && amountPaid >= newCapital;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-space text-2xl font-bold text-foreground">{txn.client_name}</h1>
            <p className="text-muted-foreground text-sm font-mono mt-0.5">{txn.trace_no} · {txn.law_firm}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${APPROVED_STYLES[txn.approved] || 'bg-muted text-muted-foreground'}`}>{txn.approved || '—'}</span>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${PAY_STYLES[txn.payment_status] || 'bg-muted text-muted-foreground'}`}>{txn.payment_status || '—'}</span>
          <Link to={`/drawdown/${id}`} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors">
            <Edit className="w-4 h-4" /> Edit
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Draw-Down Amount" value={fmt(txn.drawdown_amount)} color="text-primary" />
        <KpiCard label="New Capital Balance" value={fmt(newCapital)} color="text-amber-400" />
        <KpiCard label="Amount Paid" value={fmt(amountPaid)} color={isSettled ? 'text-emerald-400' : 'text-foreground'} />
        <KpiCard
          label={isSettled ? 'Settled In Full' : shortfall > 0 ? 'Shortfall' : 'Outstanding'}
          value={isSettled ? '✓ SETTLED' : fmt(shortfall || Math.max(0, newCapital - amountPaid))}
          color={isSettled ? 'text-emerald-400' : 'text-red-400'}
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-border flex gap-0">
        {[['details', 'Details'], ['documents', `Documents (${documents.length})`], ['activity', `Activity (${auditLogs.length})`]].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >{label}</button>
        ))}
      </div>

      {/* Details Tab */}
      {tab === 'details' && (
        <div className="space-y-5">
          <Section title="Case Details">
            <Row label="Trace No" value={<span className="font-mono text-primary">{txn.trace_no}</span>} />
            <Row label="Attorney Ref No" value={txn.attorney_ref_no} />
            <Row label="Client Name" value={txn.client_name} />
            <Row label="Law Firm" value={txn.law_firm} />
            <Row label="Account Number" value={txn.account_number} />
            <Row label="Contact Person" value={txn.contact_person} />
          </Section>
          <Section title="Expert & Assessment">
            <Row label="Expert Name" value={txn.expert_name} />
            <Row label="Product" value={txn.product} />
            <Row label="Date of Assessment" value={fmtDate(txn.date_of_assessment)} />
            <Row label="Assessment Status" value={txn.assessment_status} />
            <Row label="Invoice No" value={txn.invoice_no} />
            <Row label="Invoice Date" value={fmtDate(txn.invoice_date)} />
            <Row label="Total Invoiced" value={fmt(txn.total_invoiced)} />
          </Section>
          <Section title="Draw-Down Details">
            <Row label="Draw No" value={txn.draw_no} />
            <Row label="Approved" value={<span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${APPROVED_STYLES[txn.approved] || ''}`}>{txn.approved}</span>} />
            <Row label="Draw-Down Amount" value={fmt(txn.drawdown_amount)} />
            <Row label="Draw-Down Date" value={fmtDate(txn.drawdown_date)} />
            <Row label="Potential Draw-Down" value={fmt(txn.potential_drawdown)} />
            <Row label="Budget Amount" value={fmt(txn.budget_amount)} />
            <Row label="MLF" value={txn.mlf} />
            {txn.approved === 'CANCELLED' && <>
              <Row label="Cancellation Reason" value={txn.cancellation_reason} />
              <Row label="Cancellation Notes" value={txn.cancellation_notes} />
            </>}
          </Section>
          <Section title="Interest & Repayment">
            <Row label="Interest Start Date" value={fmtDate(txn.attorney_interest_start_date)} />
            <Row label="Funda Interest" value={fmt(txn.funda_interest)} />
            <Row label="Attorney Interest" value={fmt(txn.attorney_interest)} />
            <Row label="Second Payment" value={fmt(txn.second_payment)} />
            <Row label="New Capital Amount" value={fmt(txn.new_capital_amount)} />
          </Section>
          <Section title="Settlement">
            <Row label="Payment Status" value={<span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${PAY_STYLES[txn.payment_status] || ''}`}>{txn.payment_status}</span>} />
            <Row label="Amount Attorney Paid" value={fmt(txn.amount_attorney_paid)} />
            <Row label="Settlement Payment Date" value={fmtDate(txn.settlement_payment_date)} />
            <Row label="Drawdown Payment Date" value={fmtDate(txn.drawdown_payment_date)} />
          </Section>
          {txn.notes && (
            <div className="bg-card border border-border rounded-xl p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Notes</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{txn.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Documents Tab */}
      {tab === 'documents' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {documents.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3 text-muted-foreground">
              <FileText className="w-10 h-10 opacity-30" />
              <p>No documents uploaded for this transaction.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {documents.map(doc => (
                <div key={doc.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors">
                  <FileText className="w-8 h-8 text-primary/60 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground">{doc.document_type} · {fmtDate(doc.upload_date || doc.created_date)}</p>
                    {doc.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{doc.description}</p>}
                  </div>
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors flex-shrink-0">
                    <Download className="w-3.5 h-3.5" /> Open
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Activity Tab */}
      {tab === 'activity' && (
        <div className="space-y-3">
          {auditLogs.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3 text-muted-foreground bg-card border border-border rounded-xl">
              <Clock className="w-10 h-10 opacity-30" />
              <p>No activity recorded yet.</p>
            </div>
          ) : auditLogs.map(log => (
            <div key={log.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <ActionIcon action={log.action} />
                  <span className="text-sm font-medium text-foreground capitalize">{log.action}</span>
                  {log.description && <span className="text-sm text-muted-foreground">— {log.description}</span>}
                </div>
                <div className="text-right text-xs text-muted-foreground flex-shrink-0">
                  <p>{log.user_email}</p>
                  <p>{fmtDateTime(log.timestamp || log.created_date)}</p>
                </div>
              </div>
              {log.changes?.length > 0 && (
                <div className="mt-3 space-y-1">
                  {log.changes.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs bg-muted/30 rounded-lg px-3 py-2">
                      <span className="text-muted-foreground font-mono flex-shrink-0">{c.field}</span>
                      <span className="text-red-400 line-through flex-shrink-0">{c.old_value || '—'}</span>
                      <span className="text-muted-foreground flex-shrink-0">→</span>
                      <span className="text-emerald-400">{c.new_value || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, color }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className={`mt-1 text-lg font-space font-bold ${color}`}>{value}</p>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-border">
        <h3 className="font-space font-semibold text-sm text-foreground">{title}</h3>
      </div>
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
        {children}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <span className="text-xs text-muted-foreground flex-shrink-0">{label}</span>
      <span className="text-sm text-foreground text-right">{value || '—'}</span>
    </div>
  );
}

function ActionIcon({ action }) {
  const icons = {
    created: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    updated: <Edit className="w-4 h-4 text-primary" />,
    deleted: <XCircle className="w-4 h-4 text-red-400" />,
    interest_calculated: <AlertTriangle className="w-4 h-4 text-amber-400" />,
  };
  return icons[action] || <Clock className="w-4 h-4 text-muted-foreground" />;
}