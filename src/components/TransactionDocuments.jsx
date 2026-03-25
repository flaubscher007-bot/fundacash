import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, FileText, ExternalLink, Trash2, ChevronDown, ChevronUp, Paperclip } from 'lucide-react';

const DOCUMENT_TYPES = [
  { value: 'Instruction Letter', label: 'Instruction Letter' },
  { value: 'Report', label: 'Report' },
  { value: 'Proof of Payment - Part Payment (Attorney Email)', label: 'Proof of Payment — Part Payment (Attorney Email)' },
  { value: 'Proof of Payment - Part Payment (MLF Confirmation)', label: 'Proof of Payment — Part Payment (MLF Confirmation)' },
  { value: 'Proof of Payment - Settlement (Attorney Email)', label: 'Proof of Payment — Settlement (Attorney Email)' },
  { value: 'Proof of Payment - Settlement (MLF Confirmation)', label: 'Proof of Payment — Settlement (MLF Confirmation)' },
  { value: 'Invoice', label: 'Invoice' },
  { value: 'Expert Report', label: 'Expert Report' },
  { value: 'Agreement', label: 'Agreement' },
  { value: 'Statement', label: 'Statement' },
  { value: 'Medical Records', label: 'Medical Records' },
  { value: 'Other', label: 'Other' },
];

const TYPE_COLORS = {
  'Instruction Letter': 'bg-blue-400/15 text-blue-400',
  'Report': 'bg-purple-400/15 text-purple-400',
  'Proof of Payment - Part Payment (Attorney Email)': 'bg-amber-400/15 text-amber-400',
  'Proof of Payment - Part Payment (MLF Confirmation)': 'bg-amber-400/15 text-amber-400',
  'Proof of Payment - Settlement (Attorney Email)': 'bg-emerald-400/15 text-emerald-400',
  'Proof of Payment - Settlement (MLF Confirmation)': 'bg-emerald-400/15 text-emerald-400',
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

export default function TransactionDocuments({ transactionId, firmName, traceNo, clientName }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState('Instruction Letter');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!transactionId || transactionId === 'new') { setLoading(false); return; }
    base44.entities.Document.filter({ transaction_id: transactionId }).then(docs => {
      setDocuments(docs);
      setLoading(false);
    });
  }, [transactionId]);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const doc = await base44.entities.Document.create({
      transaction_id: transactionId,
      firm_name: firmName,
      trace_no: traceNo,
      client_name: clientName,
      document_type: selectedType,
      description,
      file_url,
      file_name: file.name,
      upload_date: new Date().toISOString().split('T')[0],
    });
    setDocuments(prev => [...prev, doc]);
    setDescription('');
    setUploading(false);
    e.target.value = '';
  };

  const handleDelete = async (docId) => {
    if (!confirm('Delete this document?')) return;
    await base44.entities.Document.delete(docId);
    setDocuments(prev => prev.filter(d => d.id !== docId));
  };

  if (!transactionId || transactionId === 'new') return null;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header — toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Paperclip className="w-4 h-4 text-primary" />
          <h2 className="font-space font-semibold text-foreground">Supporting Documents</h2>
          {documents.length > 0 && (
            <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium">{documents.length}</span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border p-6 space-y-5">
          {/* Upload controls */}
          <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">Upload New Document</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Document Type</label>
                <select
                  value={selectedType}
                  onChange={e => setSelectedType(e.target.value)}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {DOCUMENT_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Description (optional)</label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Add a note..."
                  className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
            <label className={`inline-flex items-center gap-2 cursor-pointer bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
              <Upload className="w-4 h-4" />
              {uploading ? 'Uploading...' : 'Choose File & Upload'}
              <input type="file" className="hidden" onChange={handleUpload} />
            </label>
          </div>

          {/* Documents list */}
          {loading ? (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : documents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No documents attached yet.</p>
          ) : (
            <div className="space-y-2">
              {documents.map(doc => (
                <div key={doc.id} className="flex items-start gap-3 p-3 bg-muted/20 border border-border/60 rounded-lg">
                  <FileText className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[doc.document_type] || 'bg-muted text-muted-foreground'}`}>
                        {doc.document_type}
                      </span>
                      <span className="text-xs text-muted-foreground">{fmtDate(doc.upload_date)}</span>
                    </div>
                    <p className="text-sm text-foreground truncate">{doc.file_name}</p>
                    {doc.description && <p className="text-xs text-muted-foreground mt-0.5">{doc.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button onClick={() => handleDelete(doc.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}