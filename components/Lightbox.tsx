
import React, { useEffect, useState } from 'react';
import { X, Download, Loader2 } from 'lucide-react';
import { Attachment } from '../types';

interface LightboxProps {
  attachment: Attachment | null;
  onClose: () => void;
}

const Lightbox: React.FC<LightboxProps> = ({ attachment, onClose }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  // Reset loaded state when attachment changes
  useEffect(() => {
    if (attachment) {
      setIsLoaded(false);
    }
  }, [attachment]);

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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      
      {/* Top Bar Actions */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-end z-50 pointer-events-none">
        <button 
          onClick={onClose}
          className="pointer-events-auto p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors"
        >
          <X className="w-8 h-8" />
        </button>
      </div>

      <div 
        className="relative max-w-[95vw] max-h-[95vh] flex items-center justify-center w-full h-full p-6 pointer-events-none"
      >
        {/* Loading Spinner */}
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          </div>
        )}

        <img 
          src={attachment.url} 
          alt={attachment.name} 
          onLoad={() => setIsLoaded(true)}
          className={`
            max-w-full max-h-full object-contain rounded shadow-2xl pointer-events-auto transition-opacity duration-300
            ${isLoaded ? 'opacity-100' : 'opacity-0'}
          `}
          onClick={(e) => e.stopPropagation()}
        />
        
        {/* Bottom Actions Label */}
        {isLoaded && (
          <div 
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 px-5 py-2.5 bg-slate-900/80 backdrop-blur-md rounded-full border border-white/10 text-white shadow-xl pointer-events-auto animate-in zoom-in duration-300 delay-100"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-sm font-medium max-w-[200px] truncate opacity-90">{attachment.name}</span>
            <div className="w-px h-4 bg-white/20" />
            <a 
              href={attachment.url} 
              download 
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-wide"
            >
              <Download className="w-4 h-4" />
              Download
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default Lightbox;
