import React from 'react';
import { Message, Attachment } from '../types';
import { X, FileText, Image as ImageIcon, Download, ZoomIn, Eye } from 'lucide-react';

interface MediaGalleryProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  onImageClick: (attachment: Attachment) => void;
  onDocView?: (attachment: Attachment) => void;
}

const MediaGallery: React.FC<MediaGalleryProps> = ({ isOpen, onClose, messages, onImageClick, onDocView }) => {
  // Extract all attachments from all messages
  const allAttachments = React.useMemo(() => {
    return messages.flatMap(m => 
      (m.attachments || []).map(a => ({ ...a, messageDate: m.timestamp }))
    ).reverse(); // Newest first
  }, [messages]);

  const images = allAttachments.filter(a => a.type === 'image');
  const docs = allAttachments.filter(a => a.type === 'document');

  if (!isOpen) return null;

  return (
    <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col h-full flex-shrink-0 animate-in slide-in-from-right duration-200 shadow-2xl z-20">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-slate-800 flex-shrink-0">
        <span className="font-bold text-slate-200">Shared Media</span>
        <button 
          onClick={onClose}
          className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        
        {allAttachments.length === 0 && (
          <div className="text-center text-slate-500 py-10">
            <div className="inline-flex p-3 bg-slate-800/50 rounded-full mb-3">
              <FileText className="w-6 h-6 opacity-50" />
            </div>
            <p className="text-sm">No shared media yet</p>
          </div>
        )}

        {/* Images Section */}
        {images.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <ImageIcon className="w-3 h-3" />
              <span>Images ({images.length})</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {images.map(img => (
                <div 
                  key={img.id} 
                  className="aspect-square bg-slate-800 rounded border border-slate-700 overflow-hidden relative group"
                >
                  <img src={img.url} alt={img.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button 
                      onClick={() => onImageClick(img)}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all transform hover:scale-110"
                      title="Enlarge"
                    >
                      <ZoomIn className="w-5 h-5" />
                    </button>
                    <a 
                      href={img.url}
                      download={img.name}
                      className="p-2 bg-blue-600/80 hover:bg-blue-600 rounded-full text-white transition-all transform hover:scale-110"
                      title="Download"
                    >
                      <Download className="w-5 h-5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Docs Section */}
        {docs.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <FileText className="w-3 h-3" />
              <span>Documents ({docs.length})</span>
            </div>
            <div className="space-y-2">
              {docs.map(doc => (
                <div key={doc.id} className="flex items-center gap-3 p-2 rounded bg-slate-800/30 border border-slate-800 hover:border-slate-700 transition-colors group">
                  <div className="w-9 h-9 rounded bg-slate-800 flex items-center justify-center flex-shrink-0 text-amber-500">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-300 truncate font-medium">{doc.name}</div>
                    <div className="text-[10px] text-slate-500 flex justify-between">
                      <span>{doc.size}</span>
                      <span>{doc.messageDate.toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    {doc.name.toLowerCase().endsWith('.pdf') && onDocView && (
                      <button 
                        onClick={() => onDocView(doc)}
                        title={`View ${doc.name}`}
                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-slate-700 hover:text-blue-400 rounded text-slate-400 transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <a 
                      href={doc.url}
                      download={doc.name}
                      title={`Download ${doc.name}`}
                      className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-slate-700 hover:text-blue-400 rounded text-slate-400 transition-all transform"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaGallery;