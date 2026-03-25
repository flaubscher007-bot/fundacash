import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Save, Upload, Trash2, FileText, ExternalLink } from 'lucide-react';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-ZA') : '—';

export default function AgreementsTab({ firmName, agreement, onSaved, documents, onDocumentAdded, onDocumentDeleted }) {
  const [form, setForm] = useState({
    funda_interest_rate: agreement?.funda_interest_rate || '',
    attorney_interest_rate: agreement?.attorney_interest_rate || '',
    interest_basis: agreement?.interest_basis || '365 days',
    interest_start_trigger: agreement?.interest_start_trigger || 'drawdown_date',
    payment_terms_days: agreement?.payment_terms_days || '',
    agreement_date: agreement?.agreement_date || '',
    notes: agreement?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const data = {
      ...form,
      firm_name: firmName,
      funda_interest_rate: Number(form.funda_interest_rate) || null,
      attorney_interest_rate: Number(form.attorney_interest_rate) || null,
      payment_terms_days: Number(form.payment_terms_days) || null,
    };
    let saved;
    if (agreement?.id) {
      saved = await base44.entities.FirmAgreement.update(agreement.id, data);
    } else {
      saved = await base44.entities.FirmAgreement.create(data);
    }
    onSaved(saved);
    setSaving(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const doc = await base44.entities.Document.create({
      firm_name: firmName,
      document_type: 'Agreement',
      file_url,
      file_name: file.name,
      upload_date: new Date().toISOString().split('T')[0],
    });
    onDocumentAdded(doc);
    setUploading(false);
    e.target.value = '';
  };

  const handleDelete = async (docId) => {
    if (!confirm('Delete this document?')) return;
    await base44.entities.Document.delete(docId);
    onDocumentDeleted(docId);
  };

  const f = (key) => ({
    value: form[key],
    onChange: (e) => setForm(p => ({ ...p, [key]: e.target.value })),
  });

  return (
    <div className="space-y-8">
      {/* Agreement Terms */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-5">
        <h3 className="font-space font-semibold text-foreground">Interest & Payment Terms</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Fundamedical Interest Rate (% p.a.)">
            <input type="number" step="0.01" {...f('funda_interest_rate')} className={inputCls} placeholder="e.g. 18" />
          </Field>
          <Field label="Law Firm Interest Rate (% p.a.)">
            <input type="number" step="0.01" {...f('attorney_interest_rate')} className={inputCls} placeholder="e.g. 5" />
          </Field>
          <Field label="Interest Basis">
            <select {...f('interest_basis')} className={inputCls}>
              <option>365 days</option>
              <option>30/360</option>
              <option>Actual/360</option>
            </select>
          </Field>
          <Field label="Interest Starts From">
            <select {...f('interest_start_trigger')} className={inputCls}>
              <option value="drawdown_date">Draw-Down Date</option>
              <option value="invoice_date">Invoice Date</option>
              <option value="assessment_date">Assessment Date</option>
            </select>
          </Field>
          <Field label="Payment Terms (days)">
            <input type="number" {...f('payment_terms_days')} className={inputCls} />
          </Field>
          <Field label="Agreement Date">
            <input type="date" {...f('agreement_date')} className={inputCls} />
          </Field>
        </div>

        <Field label="Notes">
          <textarea {...f('notes')} rows={3} className={inputCls} />
        </Field>

        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Agreement Terms'}
        </button>
      </div>

      {/* Agreement Documents */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-space font-semibold text-foreground">Agreement Documents</h3>
          <label className={`inline-flex items-center gap-2 cursor-pointer bg-secondary text-secondary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
            <Upload className="w-4 h-4" />
            {uploading ? 'Uploading...' : 'Upload Agreement'}
            <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleFileUpload} />
          </label>
        </div>

        {documents.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4 text-center">No agreement documents uploaded yet.</p>
        ) : (
          <div className="space-y-2">
            {documents.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{doc.file_name}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(doc.upload_date)}</p>
                </div>
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button onClick={() => handleDelete(doc.id)} className="p-1.5 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls = 'w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring';

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}