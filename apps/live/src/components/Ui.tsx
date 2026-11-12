import React from 'react';
import { go, href } from '../lib';

export const field =
  'w-full border border-[#2c2c44] bg-[#0d0d14] px-3 py-3 text-base text-white focus:outline-none focus:border-[#00ffcc] focus:ring-2 focus:ring-[#00ffcc]/30 min-h-[48px]';
export const label = 'block text-sm font-semibold text-white mb-1';
export const btnPrimary =
  'inline-flex items-center justify-center gap-2 bg-[#00ffcc] hover:bg-[#00d9ad] disabled:bg-[#aab3c5] disabled:cursor-not-allowed text-[#050508] font-bold px-5 py-3 text-sm min-h-[44px]';
export const btnGhost =
  'inline-flex items-center justify-center gap-2 border border-[#5b5b7a] hover:border-[#00ffcc] hover:text-[#00ffcc] text-white font-semibold px-4 py-2 text-sm min-h-[44px] disabled:opacity-40';
export const btnDanger =
  'inline-flex items-center justify-center gap-2 border border-[#ff007f] text-[#ff7ab3] hover:bg-[rgba(255,0,127,0.2)] font-semibold px-4 py-2 text-sm min-h-[44px] disabled:opacity-40';

/** Lien interne sans rechargement. */
export const Link: React.FC<{ to: string; className?: string; children: React.ReactNode; 'aria-label'?: string }> = ({ to, className, children, ...rest }) => (
  <a
    href={href(to)}
    className={className}
    aria-label={rest['aria-label']}
    onClick={(e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      go(to);
    }}
  >
    {children}
  </a>
);

export const Alert: React.FC<{ kind?: 'error' | 'ok'; children: React.ReactNode }> = ({ kind = 'error', children }) => (
  <p
    role={kind === 'error' ? 'alert' : 'status'}
    className={`text-sm p-3 border ${kind === 'error' ? 'border-[#ff007f] bg-[rgba(255,0,127,0.12)] text-[#ff7ab3]' : 'border-[#00ffcc] bg-[rgba(0,255,204,0.08)] text-white'}`}
  >
    {children}
  </p>
);

export const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-stretch sm:items-center justify-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="bg-[#0d0d14] w-full sm:max-w-md max-h-full overflow-y-auto border border-[#2c2c44]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2c2c44] sticky top-0 bg-[#0d0d14]">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="p-2 -mr-2 min-w-[44px] min-h-[44px] text-xl leading-none">
            ×
          </button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
      </div>
    </div>
  );
};
