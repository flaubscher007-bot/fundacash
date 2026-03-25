import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, CheckCircle2, AlertTriangle, Upload, FilePlus } from 'lucide-react';
import BulkImportDrawdown from '../components/BulkImportDrawdown';

const FIRMS = ['S STEYN INCORPORATED', 'LHL ATTORNEYS', 'DBVS ATTORNEYS', 'RH LAWYERS', 'A WOLMARANS INCORPORATED'];

const EMPTY = {
  trace_no: '', attorney_ref_no: '', client_name: '', approved: 'PENDING',
  potential_drawdown: '', budget_amount: '', drawn_down: '',
  drawdown_amount: '', drawdown_date: '', mlf: 'YES', law_firm: 'S STEYN INCORPORATED',
  account_number: '', contact_person: '', expert_name: '', product: '',
  date_of_assessment: '', assessment_status: 'SEEN', invoice_date: '', invoice_no: '',
  total_invoiced: '', draw_no: '', payment_status: 'PENDING', attorney_interest_start_date: '',
  second_payment: '', attorney_interest: '', funda_interest: '',
  drawdown_payment_date: '', settlement_payment_date: '', amount_attorney_paid: '', new_capital_amount: '', notes: ''
};

export default function DrawDownForm() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const id = window.location.pathname.split('/drawdown/')[1];
  const isNew = !id || id === 'new';

  const [mode, setMode] = useState('single'); // 'single' | 'bulk'
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  // Settlement calculations
  // New Capital Balance = Drawdown Amount + Fundamedical Interest
  const newCapitalBalance = Number(form.new_capital_amount) || (Number(form.drawdown_amount) + Number(form.funda_interest) || 0);
  const amountPaid = Number(form.amount_attorney_paid) || 0;
  const isSettled = amountPaid > 0 && amountPaid >= newCapitalBalance;
  const shortfall = newCapitalBalance > 0 && amountPaid > 0 && amountPaid < newCapitalBalance ? newCapitalBalance - amountPaid : 0;
  const fmt = (n) => `R ${Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleSave = async () => {
    setSaving(true);
    const payload = { ...form };
    // Convert numeric fields
    ['potential_drawdown','budget_amount','drawdown_amount','total_invoiced','second_payment','attorney_interest','funda_interest','amount_attorney_paid','new_capital_amount'].forEach(k => {
      if (payload[k] !== '' && payload[k] !== null) payload[k] = Number(payload[k]) || 0;
    });
    if (isNew) {
      await base44.entities.Transaction.create(payload);
    } else {
      await base44.entities.Transaction.update(id, payload);
    }
    setSaving(false);
    navigate('/transactions');
  };

  const handleDelete = async () => {
    if (!confirm('Delete this transaction?')) return;
    await base44.entities.Transaction.delete(id);
    navigate('/transactions');
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-space text-2xl font-bold text-foreground">{isNew ? 'New Draw-Down' : 'Edit Transaction'}</h1>
            {!isNew && <p className="text-muted-foreground text-sm mt-0.5">{form.trace_no}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          {isNew && (
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button onClick={() => setMode('single')} className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${mode === 'single' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                <FilePlus className="w-4 h-4" /> Single
              </button>
              <button onClick={() => setMode('bulk')} className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${mode === 'bulk' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                <Upload className="w-4 h-4" /> Bulk Import
              </button>
            </div>
          )}
          {!isNew && (
            <button onClick={handleDelete} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 text-sm transition-colors">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          )}
          {mode === 'single' && (
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors disabled:opacity-60">
              <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>
      </div>

      {/* Bulk Import Mode */}
      {isNew && mode === 'bulk' && (
        <div className="bg-card border border-border rounded-xl p-6">
          <BulkImportDrawdown
            defaultFirm={form.law_firm}
            onImported={(count) => { alert(`${count} transactions imported successfully!`); navigate('/transactions'); }}
            onCancel={() => setMode('single')}
          />
        </div>
      )}

      {/* Single mode content below — hidden when bulk */}
      {mode !== 'bulk' && (<>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h2 className="font-space font-semibold text-foreground">{title}</h2>
      </div>
      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {children}
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-muted-foreground">
        {label}{required && <span className="text-destructive ml-1">*</span>}
      </label>
      <div className="[&>input]:w-full [&>input]:bg-input [&>input]:border [&>input]:border-border [&>input]:rounded-lg [&>input]:px-3 [&>input]:py-2.5 [&>input]:text-sm [&>input]:text-foreground [&>input]:placeholder:text-muted-foreground [&>input]:focus:outline-none [&>input]:focus:ring-1 [&>input]:focus:ring-ring [&>select]:w-full [&>select]:bg-input [&>select]:border [&>select]:border-border [&>select]:rounded-lg [&>select]:px-3 [&>select]:py-2.5 [&>select]:text-sm [&>select]:text-foreground [&>select]:focus:outline-none [&>select]:focus:ring-1 [&>select]:focus:ring-ring">
        {children}
      </div>
    </div>
  );
}