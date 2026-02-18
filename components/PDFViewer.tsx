
import React, { useEffect } from 'react';
import { X, Download, FileText, Maximize2 } from 'lucide-react';
import { Attachment } from '../types';

interface PDFViewerProps {
  attachment: Attachment | null;
  onClose: () => void;
}

const PDFViewer: React.FC<PDFViewerProps> = ({ attachment, onClose }) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!attachment) return null;

  return (
    <div 
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div 
        className="flex flex-col w-[90vw] h-[90vh] bg-slate-900 rounded-xl border border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header Toolbar */}
        <div className="h-14 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded bg-red-500/20 flex items-center justify-center text-red-500 flex-shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-200 truncate">{attachment.name}</h3>
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">{attachment.size} • PDF Document</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a 
              href={attachment.url} 
              download={attachment.name}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-md text-xs font-bold transition-all border border-slate-700"
            >
              <Download className="w-4 h-4" />
              Download
            </a>
            <div className="w-px h-6 bg-slate-800 mx-2" />
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* PDF Content Area */}
        <div className="flex-1 bg-slate-800 relative">
          <iframe 
            src={`${attachment.url}#toolbar=0&navpanes=0`} 
            className="w-full h-full border-none"
            title={attachment.name}
          />
          {/* Subtle overlay for PDF protection/aesthetic if needed */}
          <div className="absolute top-4 right-4 pointer-events-none opacity-20">
             <Maximize2 className="w-12 h-12 text-white" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PDFViewer;
