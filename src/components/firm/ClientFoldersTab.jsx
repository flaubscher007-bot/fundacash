import { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, ChevronDown, ChevronRight, Upload, FileText, Trash2, ExternalLink, Folder, FolderOpen, FolderPlus, User } from 'lucide-react';
import { Link } from 'react-router-dom';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-ZA') : '—';

const CLAIMANT_DOC_TYPES = ['Instruction Letter', 'Report', 'Invoice'];

const DOC_TYPE_COLORS = {
  'Instruction Letter': 'text-blue-400',
  'Report': 'text-purple-400',
  'Invoice': 'text-amber-400',
};

export default function ClientFoldersTab({ firmName, transactions, documents, onDocumentAdded, onDocumentDeleted }) {
  const [search, setSearch] = useState('');
  const [expandedDraws, setExpandedDraws] = useState({});
  const [expandedClaimants, setExpandedClaimants] = useState({});
  const [uploading, setUploading] = useState({});

  // Group transactions by draw_no
  const drawGroups = useMemo(() => {
    const groups = {};
    for (const txn of transactions) {
      const draw = txn.draw_no || '(No Draw No)';
      if (!groups[draw]) groups[draw] = [];
      groups[draw].push(txn);
    }
    // Sort draw keys
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [transactions]);

  // Filter draw groups by search
  const filteredDrawGroups = useMemo(() => {
    if (!search.trim()) return drawGroups;
    const q = search.toLowerCase();
    return drawGroups.map(([draw, txns]) => [
      draw,
      txns.filter(t =>
        t.client_name?.toLowerCase().includes(q) ||
        t.trace_no?.toLowerCase().includes(q) ||
        t.attorney_ref_no?.toLowerCase().includes(q) ||
        draw.toLowerCase().includes(q)
      )
    ]).filter(([, txns]) => txns.length > 0);
  }, [drawGroups, search]);

  // Documents keyed by transaction_id + document_type
  const docsByTxnAndType = useMemo(() => {
    const map = {};
    for (const doc of documents) {
      if (!doc.transaction_id) continue;
      const key = `${doc.transaction_id}__${doc.document_type}`;
      if (!map[key]) map[key] = [];
      map[key].push(doc);
    }
    return map;
  }, [documents]);

  const toggleDraw = (draw) => setExpandedDraws(p => ({ ...p, [draw]: !p[draw] }));
  const toggleClaimant = (txnId) => setExpandedClaimants(p => ({ ...p, [txnId]: !p[txnId] }));

  const handleUpload = async (txn, docType, e) => {
    const file = e.target.files[0];
    if (!file) return;
    const key = txn.id + docType;
    setUploading(p => ({ ...p, [key]: true }));
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
    setUploading(p => ({ ...p, [key]: false }));
    e.target.value = '';
  };

  const handleDelete = async (docId) => {
    if (!confirm('Delete this document?')) return;
    await base44.entities.Document.delete(docId);
    onDocumentDeleted(docId);
  };

  const totalClaimants = filteredDrawGroups.reduce((s, [, txns]) => s + txns.length, 0);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search draw no, client, trace no..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-input border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <p className="text-xs text-muted-foreground">{filteredDrawGroups.length} draw folder{filteredDrawGroups.length !== 1 ? 's' : ''} · {totalClaimants} claimant{totalClaimants !== 1 ? 's' : ''}</p>

      {/* Draw Folders — Level 1 */}
      <div className="space-y-3">
        {filteredDrawGroups.map(([draw, txns]) => {
          const isDrawOpen = expandedDraws[draw];
          const confirmedCount = txns.filter(t => t.approved === 'YES').length;
          const totalDocs = txns.reduce((s, t) => s + (documents.filter(d => d.transaction_id === t.id).length), 0);

          return (
            <div key={draw} className="bg-card border border-border rounded-xl overflow-hidden">
              {/* Draw folder header */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
                onClick={() => toggleDraw(draw)}
              >
                {isDrawOpen
                  ? <FolderOpen className="w-5 h-5 text-primary flex-shrink-0" />
                  : <Folder className="w-5 h-5 text-primary flex-shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-space font-semibold text-foreground">{draw}</span>
                    {confirmedCount > 0 && (
                      <span className="text-xs bg-emerald-400/15 text-emerald-400 px-2 py-0.5 rounded-full font-medium">
                        {confirmedCount} confirmed
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">{txns.length} claimant{txns.length !== 1 ? 's' : ''}</span>
                    {totalDocs > 0 && (
                      <span className="text-xs text-muted-foreground">· {totalDocs} doc{totalDocs !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
                {isDrawOpen
                  ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                }
              </div>

              {/* Claimant folders — Level 2 */}
              {isDrawOpen && (
                <div className="border-t border-border divide-y divide-border/60">
                  {txns.map(txn => {
                    const isClaimantOpen = expandedClaimants[txn.id];
                    const isConfirmed = txn.approved === 'YES';
                    const txnDocs = documents.filter(d => d.transaction_id === txn.id);

                    return (
                      <div key={txn.id} className="bg-background/40">
                        {/* Claimant row */}
                        <div
                          className="flex items-center gap-3 px-5 py-2.5 cursor-pointer hover:bg-muted/20 transition-colors"
                          onClick={() => toggleClaimant(txn.id)}
                        >
                          <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-4 gap-y-0.5">
                            <span className="text-sm font-medium text-foreground truncate">{txn.client_name}</span>
                            <span className="text-xs font-mono text-primary">{txn.trace_no}</span>
                            {isConfirmed && (
                              <span className="text-xs bg-emerald-400/15 text-emerald-400 px-1.5 py-0.5 rounded font-medium">✓ Confirmed</span>
                            )}
                            {txnDocs.length > 0 && (
                              <span className="text-xs text-muted-foreground">{txnDocs.length} doc{txnDocs.length !== 1 ? 's' : ''}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/drawdown/${txn.id}`}
                              onClick={e => e.stopPropagation()}
                              className="text-xs text-primary hover:underline whitespace-nowrap"
                            >
                              View
                            </Link>
                            {isClaimantOpen
                              ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                              : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                            }
                          </div>
                        </div>

                        {/* Document slots — Level 3 (auto-open for confirmed) */}
                        {(isClaimantOpen || isConfirmed) && (
                          <div className="px-5 pb-4 pt-2 bg-muted/10 space-y-2">
                            {!isConfirmed && (
                              <p className="text-xs text-amber-400/80 mb-2">
                                ⚠ Folders are auto-created once the draw-down is confirmed (Approved = YES)
                              </p>
                            )}
                            {CLAIMANT_DOC_TYPES.map(docType => {
                              const typeDocs = docsByTxnAndType[`${txn.id}__${docType}`] || [];
                              const uploadKey = txn.id + docType;
                              const isUploading = uploading[uploadKey];

                              return (
                                <div key={docType} className="flex items-start gap-3 p-3 bg-card border border-border/60 rounded-lg">
                                  <div className="flex-shrink-0 mt-0.5">
                                    <Folder className={`w-4 h-4 ${DOC_TYPE_COLORS[docType] || 'text-muted-foreground'}`} />
                                  </div>
                                  <div className="flex-1 min-w-0 space-y-1.5">
                                    <p className={`text-xs font-semibold uppercase tracking-wide ${DOC_TYPE_COLORS[docType] || 'text-muted-foreground'}`}>{docType}</p>
                                    {/* Uploaded files */}
                                    {typeDocs.map(doc => (
                                      <div key={doc.id} className="flex items-center gap-2 bg-muted/30 rounded px-2 py-1">
                                        <FileText className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                        <span className="text-xs text-foreground truncate flex-1">{doc.file_name}</span>
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(doc.upload_date)}</span>
                                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="p-0.5 hover:text-foreground text-muted-foreground transition-colors">
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                        <button onClick={() => handleDelete(doc.id)} className="p-0.5 hover:text-destructive text-muted-foreground transition-colors">
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    ))}
                                    {/* Upload button */}
                                    <label className={`inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium px-2.5 py-1 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors ${isUploading ? 'opacity-60 pointer-events-none' : ''}`}>
                                      <Upload className="w-3 h-3" />
                                      {isUploading ? 'Uploading...' : `Upload ${docType}`}
                                      <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => handleUpload(txn, docType, e)} />
                                    </label>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {filteredDrawGroups.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">No draw folders found.</div>
        )}
      </div>
    </div>
  );
}