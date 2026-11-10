import React from 'react';
import { Cookie } from 'lucide-react';

interface CookieBannerProps {
  onAccept: () => void;
  onDecline: () => void;
  onCustomize: () => void;
}

export const CookieBanner: React.FC<CookieBannerProps> = ({ onAccept, onDecline, onCustomize }) => {
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 border-t-2 border-[#5b5b7a] bg-[#161616] text-white px-4 pt-4 pb-[env(safe-area-inset-bottom)] shadow-2xl">
      <div className="mx-auto max-w-6xl flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-xs pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Cookie className="w-4 h-4 text-[#00ffcc]" aria-hidden="true" />
            <span className="font-bold text-[#dde4f0]">Vos choix sur les cookies</span>
          </div>
          <p className="text-[#dde4f0] max-w-2xl leading-relaxed">
            Nous utilisons des cookies techniques pour traiter votre réservation. Vous pouvez refuser tous les autres cookies.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onDecline}
            className="border border-white bg-[#0d0d14] px-5 py-2 text-xs font-bold text-white hover:bg-[#1b1b2b] transition-colors"
          >
            Tout refuser
          </button>

          <button
            type="button"
            onClick={onCustomize}
            className="border border-[#5b5b7a] bg-transparent px-4 py-2 text-xs font-bold text-[#dde4f0] hover:bg-[#00ffcc] transition-colors"
          >
            Personnaliser
          </button>

          <button
            type="button"
            onClick={onAccept}
            className="border border-white bg-[#0d0d14] px-5 py-2 text-xs font-bold text-white hover:bg-[#1b1b2b] transition-colors"
          >
            Tout accepter
          </button>
        </div>
      </div>
    </div>
  );
};
