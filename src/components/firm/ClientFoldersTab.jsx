import { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, ChevronDown, ChevronRight, Upload, FileText, Trash2, ExternalLink, Folder } from 'lucide-react';
import { Link } from 'react-router-dom';

const fmt = (n) => n ? `R ${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 0 })}` : '—';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-ZA') : '—';

export default function ClientFoldersTab({ firmName, transactions, documents, onDocumentAdded, onDocumentDeleted }) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({});
  const [uploading, setUploading] = useState({});

  const filtered = useMemo(() => {
    if (!search.trim()) return transactions;
    const q = search.toLowerCase();
    return transactions.filter(t =>
      t.client_name?.toLowerCase().includes(q) ||
      t.trace_no?.toLowerCase().includes(q) ||
      t.attorney_ref_no?.toLowerCase().includes(q)
    );
  }, [transactions, search]);

  const docsByTransaction = useMemo(() => {
    const map = {};
    for (const doc of documents) {
      if (!doc.transaction_id) continue;
      if (!map[doc.transaction_id]) map[doc.transaction_id] = [];
      map[doc.transaction_id].push(doc);
    }
    return map;
  }, [documents]);

  const toggleExpand = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  const handleUpload = async (txn, docType, e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(p => ({ ...p, [txn.id + docType]: true }));
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const doc = await base44.entities.Document.create({
      firm_name: firmName,
      transaction_id: txn.id,
      trace_no: txn.trace_no,
      client_name: txn.client_name,
      document_type: docType,
      file_url,
      file_name: file.name,
      upload_date: new Date().toISOString().split('T')[0],
    });
    onDocumentAdded(doc);
    setUploading(p => ({ ...p, [txn.id + docType]: false }));
    e.target.value = '';
  };

  const handleDelete = async (docId) => {
    if (!confirm('Delete this document?')) return;
    await base44.entities.Document.delete(docId);
    onDocumentDeleted(docId);
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search client, trace no, ref no..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-input border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} client folders</p>

      {/* Client Folders */}
      <div className="space-y-2">
        {filtered.map(txn => {
          const txnDocs = docsByTransaction[txn.id] || [];
          const isOpen = expanded[txn.id];
          return (
            <div key={txn.id} className="bg-card border border-border rounded-xl overflow-hidden">
              {/* Row header */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
                onClick={() => toggleExpand(txn.id)}
              >
                <Folder className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-0.5">
                  <div>
                    <p className="text-xs text-muted-foreground">Client</p>
                    <p className="text-sm text-foreground font-medium truncate">{txn.client_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Trace No</p>
                    <p className="text-xs font-mono text-primary">{txn.trace_no}</p>
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-xs text-muted-foreground">Draw-Down</p>
                    <p className="text-sm text-foreground">{fmt(txn.drawdown_amount)}</p>
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-xs text-muted-foreground">Documents</p>
                    <p className="text-sm text-foreground">{txnDocs.length} file{txnDocs.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <Link
                    to={`/drawdown/${txn.id}`}
                    onClick={e => e.stopPropagation()}
                    className="text-xs text-primary hover:underline whitespace-nowrap"
                  >
                    View
                  </Link>
                  {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>

              {/* Expanded content */}
              {isOpen && (
                <div className="border-t border-border px-4 py-4 space-y-4">
                  {/* Existing docs */}
                  {txnDocs.length > 0 && (
                    <div className="space-y-2">
                      {txnDocs.map(doc => (
                        <div key={doc.id} className="flex items-center gap-3 p-2.5 bg-muted/20 rounded-lg">
                          <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground truncate">{doc.file_name}</p>
                            <p className="text-xs text-muted-foreground">{doc.document_type} · {fmtDate(doc.upload_date)}</p>
                          </div>
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <button onClick={() => handleDelete(doc.id)} className="p-1.5 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload buttons */}
                  <div className="flex flex-wrap gap-2">
                    {['Invoice', 'Expert Report', 'Medical Records', 'Other'].map(docType => (
                      <label
                        key={docType}
                        className={`inline-flex items-center gap-1.5 cursor-pointer bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-secondary/80 transition-colors ${uploading[txn.id + docType] ? 'opacity-60 pointer-events-none' : ''}`}
                      >
                        <Upload className="w-3 h-3" />
                        {uploading[txn.id + docType] ? 'Uploading...' : `+ ${docType}`}
                        <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => handleUpload(txn, docType, e)} />
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">No clients found.</div>
        )}
      </div>
    </div>
  );
}