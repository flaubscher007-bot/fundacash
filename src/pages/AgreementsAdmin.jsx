import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Save, Edit2, ChevronDown, ChevronUp } from 'lucide-react';

const FIRMS = [
  'S STEYN INCORPORATED',
  'LHL ATTORNEYS',
  'DBVS ATTORNEYS',
  'RH LAWYERS',
  'A WOLMARANS INCORPORATED',
];

const EMPTY = {
  funda_interest_rate: '',
  attorney_interest_rate: '',
  interest_basis: '365 days',
  interest_start_trigger: 'drawdown_date',
  payment_terms_days: '',
  capital_limit: '',
  admin_fee_rate: '',
  admin_fee_fixed: '',
  agreement_date: '',
  notes: '',
};

export default function AgreementsAdmin() {
  const [agreements, setAgreements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [forms, setForms] = useState({});
  const [saving, setSaving] = useState({});

  useEffect(() => {
    base44.entities.FirmAgreement.list().then(data => {
      setAgreements(data);
      setLoading(false);
    });
  }, []);

  const getAgreement = (firm) => agreements.find(a => a.firm_name === firm) || null;

  const initForm = (firm) => {
    const ag = getAgreement(firm);
    setForms(prev => ({ ...prev, [firm]: ag ? { ...ag } : { ...EMPTY, firm_name: firm } }));
    setExpanded(firm);
  };

  const setField = (firm, field, value) => {
    setForms(prev => ({ ...prev, [firm]: { ...prev[firm], [field]: value } }));
  };

  const handleSave = async (firm) => {
    setSaving(prev => ({ ...prev, [firm]: true }));
    const data = forms[firm];
    const existing = getAgreement(firm);
    let saved;
    if (existing) {
      saved = await base44.entities.FirmAgreement.update(existing.id, data);
      setAgreements(prev => prev.map(a => a.id === existing.id ? { ...a, ...data } : a));
    } else {
      saved = await base44.entities.FirmAgreement.create({ ...data, firm_name: firm });
      setAgreements(prev => [...prev, saved]);
    }
    setSaving(prev => ({ ...prev, [firm]: false }));
    setExpanded(null);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="font-space text-2xl font-bold text-foreground">Firm Agreement Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure interest rates, capital limits, and fee structures per firm. The daily interest calculation uses these values automatically.</p>
      </div>

      <div className="space-y-3">
        {FIRMS.map(firm => {
          const ag = getAgreement(firm);
          const isOpen = expanded === firm;
          const form = forms[firm];
          const isSaving = saving[firm];

          return (
            <div key={firm} className="bg-card border border-border rounded-xl overflow-hidden">
              {/* Header row */}
              <button
                onClick={() => isOpen ? setExpanded(null) : initForm(firm)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm">{firm}</p>
                  {ag ? (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Funda: {ag.funda_interest_rate ?? '—'}% · Attorney: {ag.attorney_interest_rate ?? '—'}% · {ag.payment_terms_days ?? '—'} day terms
                    </p>
                  ) : (
                    <p className="text-xs text-amber-400 mt-0.5">No agreement configured</p>
                  )}
                </div>
                <span className="text-xs text-primary font-medium flex items-center gap-1">
                  {ag ? <Edit2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  {ag ? 'Edit' : 'Add'}
                  {isOpen ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
                </span>
              </button>

              {/* Form */}
              {isOpen && form && (
                <div className="px-5 pb-5 border-t border-border space-y-4 pt-4">
                  {/* Interest Rates */}
                  <div className="pb-1">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Interest Rates</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField label="Funda Interest Rate (% per month)">
                        <input type="number" step="0.01" value={form.funda_interest_rate} onChange={e => setField(firm, 'funda_interest_rate', e.target.value)} placeholder="e.g. 3.5" />
                      </FormField>
                      <FormField label="Attorney Interest Rate (% per month)">
                        <input type="number" step="0.01" value={form.attorney_interest_rate} onChange={e => setField(firm, 'attorney_interest_rate', e.target.value)} placeholder="e.g. 2.0" />
                      </FormField>
                      <FormField label="Interest Day-Count Basis">
                        <select value={form.interest_basis} onChange={e => setField(firm, 'interest_basis', e.target.value)}>
                          <option value="365 days">365 days (Actual/365)</option>
                          <option value="30/360">30/360</option>
                          <option value="Actual/360">Actual/360</option>
                        </select>
                      </FormField>
                      <FormField label="Interest Starts From">
                        <select value={form.interest_start_trigger} onChange={e => setField(firm, 'interest_start_trigger', e.target.value)}>
                          <option value="drawdown_date">Draw-Down Date</option>
                          <option value="invoice_date">Invoice Date</option>
                          <option value="assessment_date">Assessment Date</option>
                        </select>
                      </FormField>
                    </div>
                  </div>

                  {/* Capital & Fees */}
                  <div className="pb-1">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Capital Limits & Fee Structure</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField label="Max Capital Limit per Transaction (R)">
                        <input type="number" value={form.capital_limit} onChange={e => setField(firm, 'capital_limit', e.target.value)} placeholder="e.g. 500000" />
                      </FormField>
                      <FormField label="Payment Terms (days)">
                        <input type="number" value={form.payment_terms_days} onChange={e => setField(firm, 'payment_terms_days', e.target.value)} placeholder="e.g. 90" />
                      </FormField>
                      <FormField label="Admin Fee (% of drawdown)">
                        <input type="number" step="0.01" value={form.admin_fee_rate} onChange={e => setField(firm, 'admin_fee_rate', e.target.value)} placeholder="e.g. 1.5" />
                      </FormField>
                      <FormField label="Admin Fee – Fixed Amount (R)">
                        <input type="number" value={form.admin_fee_fixed} onChange={e => setField(firm, 'admin_fee_fixed', e.target.value)} placeholder="Leave blank if using % fee" />
                      </FormField>
                      <FormField label="Agreement Date">
                        <input type="date" value={form.agreement_date} onChange={e => setField(firm, 'agreement_date', e.target.value)} />
                      </FormField>
                    </div>
                  </div>

                  <FormField label="Notes">
                    <textarea value={form.notes} onChange={e => setField(firm, 'notes', e.target.value)} rows={2} placeholder="Optional notes..." className="resize-none" />
                  </FormField>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setExpanded(null)} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
                      Cancel
                    </button>
                    <button onClick={() => handleSave(firm)} disabled={isSaving} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
                      <Save className="w-4 h-4" />
                      {isSaving ? 'Saving...' : 'Save Agreement'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="[&>input]:w-full [&>input]:bg-input [&>input]:border [&>input]:border-border [&>input]:rounded-lg [&>input]:px-3 [&>input]:py-2 [&>input]:text-sm [&>input]:text-foreground [&>input]:focus:outline-none [&>input]:focus:ring-1 [&>input]:focus:ring-ring [&>select]:w-full [&>select]:bg-input [&>select]:border [&>select]:border-border [&>select]:rounded-lg [&>select]:px-3 [&>select]:py-2 [&>select]:text-sm [&>select]:text-foreground [&>select]:focus:outline-none [&>select]:focus:ring-1 [&>select]:focus:ring-ring [&>textarea]:w-full [&>textarea]:bg-input [&>textarea]:border [&>textarea]:border-border [&>textarea]:rounded-lg [&>textarea]:px-3 [&>textarea]:py-2 [&>textarea]:text-sm [&>textarea]:text-foreground [&>textarea]:focus:outline-none [&>textarea]:focus:ring-1 [&>textarea]:focus:ring-ring">
        {children}
      </div>
    </div>
  );
}