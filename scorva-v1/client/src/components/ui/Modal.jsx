import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, onClose, children, size = 'md' }) {
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`w-full ${widths[size]} bg-scorva-card border border-scorva-border rounded-xl shadow-2xl flex flex-col max-h-[90vh]`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-scorva-border shrink-0">
          <h2 className="text-sm font-semibold text-scorva-text">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-scorva-muted hover:text-scorva-text hover:bg-scorva-hover transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5">
          {children}
        </div>
      </div>
    </div>
  );
}
