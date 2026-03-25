import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';

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

  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isNew) {
      base44.entities.Transaction.filter({ id }).then(data => {
        if (data[0]) setForm({ ...EMPTY, ...data[0] });
        setLoading(false);
      });
    }
  }, [id, isNew]);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

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
          {!isNew && (
            <button onClick={handleDelete} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 text-sm transition-colors">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          )}
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors disabled:opacity-60">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Form Sections */}
      <Section title="Case Details">
        <Field label="Trace No" required><input value={form.trace_no} onChange={set('trace_no')} placeholder="STE004-01234" /></Field>
        <Field label="Attorney Ref No"><input value={form.attorney_ref_no} onChange={set('attorney_ref_no')} /></Field>
        <Field label="Client Name" required><input value={form.client_name} onChange={set('client_name')} /></Field>
        <Field label="Law Firm" required>
          <select value={form.law_firm} onChange={set('law_firm')}>
            {FIRMS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </Field>
        <Field label="Account Number"><input value={form.account_number} onChange={set('account_number')} /></Field>
        <Field label="Contact Person"><input value={form.contact_person} onChange={set('contact_person')} /></Field>
      </Section>

      <Section title="Expert & Assessment">
        <Field label="Expert Name"><input value={form.expert_name} onChange={set('expert_name')} /></Field>
        <Field label="Product"><input value={form.product} onChange={set('product')} placeholder="MLR RAF, RAF 4, etc." /></Field>
        <Field label="Date of Assessment" type="date"><input type="date" value={form.date_of_assessment} onChange={set('date_of_assessment')} /></Field>
        <Field label="Assessment Status">
          <select value={form.assessment_status} onChange={set('assessment_status')}>
            {['SEEN', 'PENDING', 'CANCELLED'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Invoice No"><input value={form.invoice_no} onChange={set('invoice_no')} /></Field>
        <Field label="Invoice Date"><input type="date" value={form.invoice_date} onChange={set('invoice_date')} /></Field>
        <Field label="Total Invoiced (R)"><input type="number" value={form.total_invoiced} onChange={set('total_invoiced')} /></Field>
      </Section>

      <Section title="Draw-Down Details">
        <Field label="Draw No"><input value={form.draw_no} onChange={set('draw_no')} placeholder="DRAW 01" /></Field>
        <Field label="Approved">
          <select value={form.approved} onChange={set('approved')}>
            {['YES', 'NO', 'PENDING', 'CANCELLED'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Potential Draw-Down (R)"><input type="number" value={form.potential_drawdown} onChange={set('potential_drawdown')} /></Field>
        <Field label="Budget Amount (R)"><input type="number" value={form.budget_amount} onChange={set('budget_amount')} /></Field>
        <Field label="Draw-Down Amount (R)"><input type="number" value={form.drawdown_amount} onChange={set('drawdown_amount')} /></Field>
        <Field label="Draw-Down Date"><input type="date" value={form.drawdown_date} onChange={set('drawdown_date')} /></Field>
        <Field label="MLF">
          <select value={form.mlf} onChange={set('mlf')}>
            <option value="YES">YES</option>
            <option value="NO">NO</option>
          </select>
        </Field>
      </Section>

      <Section title="Interest & Repayment">
        <Field label="Interest Start Date"><input type="date" value={form.attorney_interest_start_date} onChange={set('attorney_interest_start_date')} /></Field>
        <Field label="Funda Interest (R)"><input type="number" value={form.funda_interest} onChange={set('funda_interest')} /></Field>
        <Field label="Attorney Interest (R)"><input type="number" value={form.attorney_interest} onChange={set('attorney_interest')} /></Field>
        <Field label="Second Payment (R)"><input type="number" value={form.second_payment} onChange={set('second_payment')} /></Field>
        <Field label="New Capital Amount (R)"><input type="number" value={form.new_capital_amount} onChange={set('new_capital_amount')} /></Field>
        <Field label="Amount Attorney Paid (R)"><input type="number" value={form.amount_attorney_paid} onChange={set('amount_attorney_paid')} /></Field>
        <Field label="Settlement Payment Date"><input type="date" value={form.settlement_payment_date} onChange={set('settlement_payment_date')} /></Field>
        <Field label="Payment Status">
          <select value={form.payment_status} onChange={set('payment_status')}>
            {['PENDING', 'PAID', 'PARTIAL', 'OVERDUE'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </Section>

      <Section title="Notes">
        <div className="col-span-2">
          <textarea value={form.notes} onChange={set('notes')} rows={3} className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none" placeholder="Additional notes..." />
        </div>
      </Section>
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