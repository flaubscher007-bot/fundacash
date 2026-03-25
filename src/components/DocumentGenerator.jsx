import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { FileText, Download } from 'lucide-react';
import { toast } from 'sonner';

export default function DocumentGenerator({ transactionId, traceNo }) {
  const [loading, setLoading] = useState(null);

  const handleGeneratePDF = async (type) => {
    if (!transactionId) {
      toast.error('Transaction ID is required');
      return;
    }
    setLoading(type);
    try {
      const response = await base44.functions.invoke(
        type === 'agreement' ? 'generateDrawdownAgreement' : 'generateInterestStatement',
        { transaction_id: transactionId }
      );

      if (response.status === 200 && response.data) {
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${type === 'agreement' ? 'drawdown-agreement' : 'interest-statement'}-${traceNo}.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);
        toast.success(`${type === 'agreement' ? 'Drawdown Agreement' : 'Interest Statement'} downloaded`);
      } else {
        toast.error('Failed to generate PDF');
      }
    } catch (err) {
      toast.error(err.message || 'Error generating PDF');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-primary" />
          <h3 className="font-space font-semibold text-foreground">Generate Documents</h3>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Automatically create PDFs pre-filled with agreement parameters</p>
      </div>

      <div className="p-6 space-y-3">
        <button
          onClick={() => handleGeneratePDF('agreement')}
          disabled={loading !== null}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 font-medium transition-colors disabled:opacity-60"
        >
          <Download className="w-4 h-4" />
          {loading === 'agreement' ? 'Generating...' : 'Drawdown Agreement'}
        </button>

        <button
          onClick={() => handleGeneratePDF('statement')}
          disabled={loading !== null}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-400/10 border border-emerald-400/30 text-emerald-400 hover:bg-emerald-400/20 font-medium transition-colors disabled:opacity-60"
        >
          <Download className="w-4 h-4" />
          {loading === 'statement' ? 'Generating...' : 'Interest Statement'}
        </button>

        <p className="text-xs text-muted-foreground pt-2">
          Both documents use the firm's agreement parameters and current transaction data. Download instantly or share with stakeholders.
        </p>
      </div>
    </div>
  );
}