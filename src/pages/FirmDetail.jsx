import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Building2 } from 'lucide-react';
import AgreementsTab from '../components/firm/AgreementsTab';
import ClientFoldersTab from '../components/firm/ClientFoldersTab';
import StatementTab from '../components/firm/StatementTab';
import FirmDashboard from '../components/firm/FirmDashboard';
import FirmPaymentsTab from '../components/firm/FirmPaymentsTab';

const FIRM_MAP = {
  'lhl': 'LHL ATTORNEYS',
  'dbvs': 'DBVS ATTORNEYS',
  'ssteyn': 'S STEYN INCORPORATED',
  'rhlawyers': 'RH LAWYERS',
  'wolmarans': 'A WOLMARANS INCORPORATED',
};

const TABS = ['Dashboard', 'Payments', 'Agreements', 'Client Folders', 'Monthly Statement'];

export default function FirmDetail() {
  const { slug } = useParams();
  const firmName = FIRM_MAP[slug];

  const [tab, setTab] = useState('Dashboard');
  const [transactions, setTransactions] = useState([]);
  const [agreement, setAgreement] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firmName) return;
    Promise.all([
      base44.entities.Transaction.filter({ law_firm: firmName }, '-created_date', 2000),
      base44.entities.FirmAgreement.filter({ firm_name: firmName }),
      base44.entities.Document.filter({ firm_name: firmName }, '-created_date', 500),
    ]).then(([txns, ags, docs]) => {
      setTransactions(txns);
      setAgreement(ags[0] || null);
      setDocuments(docs);
      setLoading(false);
    });
  }, [firmName]);

  if (!firmName) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Firm not found.
      </div>
    );
  }

  const totalDrawdown = transactions.reduce((s, t) => s + (t.drawdown_amount || 0), 0);
  const totalInterest = transactions.reduce((s, t) => s + (t.attorney_interest || 0), 0);
  const totalPaid = transactions.reduce((s, t) => s + (t.amount_attorney_paid || 0), 0);
  const outstanding = totalDrawdown + totalInterest - totalPaid;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to="/" className="mt-1 p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-space text-2xl font-bold text-foreground">{firmName}</h1>
              <p className="text-muted-foreground text-sm">{transactions.length} transactions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {!loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Capital Advanced', value: totalDrawdown },
            { label: 'Interest Accrued', value: totalInterest },
            { label: 'Amount Repaid', value: totalPaid },
            { label: 'Outstanding Balance', value: outstanding, highlight: true },
          ].map(({ label, value, highlight }) => (
            <div key={label} className={`bg-card border rounded-xl p-4 ${highlight ? 'border-primary/40' : 'border-border'}`}>
              <p className="text-xs text-muted-foreground font-medium">{label}</p>
              <p className={`mt-1 text-xl font-space font-semibold ${highlight ? 'text-primary' : 'text-foreground'}`}>
                R {Number(value || 0).toLocaleString('en-ZA', { minimumFractionDigits: 0 })}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-0">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {tab === 'Dashboard' && (
            <FirmDashboard
              firmName={firmName}
              transactions={transactions}
              agreement={agreement}
            />
          )}
          {tab === 'Payments' && (
            <FirmPaymentsTab
              firmName={firmName}
              transactions={transactions}
            />
          )}
          {tab === 'Agreements' && (
            <AgreementsTab
              firmName={firmName}
              agreement={agreement}
              onSaved={(ag) => setAgreement(ag)}
              documents={documents.filter(d => d.document_type === 'Agreement')}
              onDocumentAdded={(doc) => setDocuments(prev => [doc, ...prev])}
              onDocumentDeleted={(id) => setDocuments(prev => prev.filter(d => d.id !== id))}
            />
          )}
          {tab === 'Client Folders' && (
            <ClientFoldersTab
              firmName={firmName}
              transactions={transactions}
              documents={documents}
              onDocumentAdded={(doc) => setDocuments(prev => [doc, ...prev])}
              onDocumentDeleted={(id) => setDocuments(prev => prev.filter(d => d.id !== id))}
            />
          )}
          {tab === 'Monthly Statement' && (
            <StatementTab
              firmName={firmName}
              transactions={transactions}
              agreement={agreement}
            />
          )}
        </>
      )}
    </div>
  );
}