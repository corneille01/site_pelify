import React, { useRef } from 'react';
import { Check, ArrowRight, ArrowLeft, Star, Clock } from 'lucide-react';
import { PACKS } from '../data/packs';
import { PackId, BookingMode } from '../types';
import { formatFcfa, formatEur } from '../utils/formatters';

interface Step2PackProps {
  mode: BookingMode;
  selectedPackId: PackId;
  onSelectPack: (packId: PackId) => void;
  onNext: () => void;
  onPrev: () => void;
}

export const Step2Pack: React.FC<Step2PackProps> = ({ mode, selectedPackId, onSelectPack, onNext, onPrev }) => {
  const continueBtnRef = useRef<HTMLButtonElement>(null);

  const handleSelect = (packId: PackId) => {
    onSelectPack(packId);
    setTimeout(() => {
      continueBtnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      continueBtnRef.current?.focus();
    }, 120);
  };

  return (
    <div className="space-y-6">
      {/* Step Header - Clean Verticality of H2 */}
      <div className="bg-[#0d0d14] border border-[#2c2c44] p-6 shadow-xs">
        <div className="border-b border-[#2c2c44] pb-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold text-white">Choisissez votre pack</h2>
            </div>
            <div className="border border-[#2c2c44] bg-[#14141f] px-3 py-1.5 text-xs">
              <span className="text-[#aab3c5]">Votre choix :</span>{' '}
              <strong className="text-white">{mode === 'presentiel' ? 'Au studio de Lomé' : 'À distance'}</strong>
            </div>
          </div>
          <p className="text-xs text-[#dde4f0] mt-2">Les prix sont en FCFA, avec l'équivalent en euros. Choisissez la durée qui convient à vos produits.</p>
        </div>

        {/* 6 Packs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PACKS.map((pack) => {
            const isSelected = pack.id === selectedPackId;

            return (
              <div
                key={pack.id}
                onClick={() => handleSelect(pack.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') handleSelect(pack.id);
                }}
                className={`border-2 p-5 cursor-pointer transition-all flex flex-col justify-between relative ${
                  isSelected ? 'border-[#00ffcc] bg-[rgba(0,255,204,0.08)] shadow-sm ring-1 ring-[#00ffcc]' : 'border-[#2c2c44] bg-[#0d0d14] hover:border-[#2c2c44]'
                }`}
              >
                {/* Recommended tag if applicable */}
                {pack.recommended && (
                  <div className="absolute -top-3 right-4 border border-[#00ffcc] bg-[#00ffcc] px-2 py-0.5 text-[10px] font-bold text-[#050508] flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current" />
                    <span>Recommandé</span>
                  </div>
                )}

                <div>
                  {/* Header pack info */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-base font-bold text-white">{pack.name}</h3>
                    <div className="flex items-center gap-1 text-[11px] font-bold text-[#dde4f0] border border-[#2c2c44] bg-[#14141f] px-2 py-0.5">
                      <Clock className="w-3 h-3 text-[#00ffcc]" />
                      <span>{pack.durationLabel}</span>
                    </div>
                  </div>

                  {/* Pricing */}
                  <div className="my-3 pb-3 border-b border-[#2c2c44]">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-[#1A1A1A] tabular-nums">{formatFcfa(pack.priceFcfa)}</span>
                    </div>
                    <span className="text-xs text-[#aab3c5] tabular-nums">Environ {formatEur(pack.priceEur)} (1 € = 655,957 FCFA)</span>
                  </div>

                  {/* Headline & Description */}
                  <p className="text-xs font-semibold text-[#00ffcc] mb-1">{pack.headline}</p>
                  <p className="text-xs text-[#dde4f0] mb-4 leading-relaxed">{pack.description}</p>

                  {/* Features List */}
                  <ul className="space-y-2 text-xs text-[#dde4f0] border-t border-[#2c2c44] pt-3">
                    {pack.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-[#00ffcc] shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Card Selection Action */}
                <div className="mt-6 pt-4 border-t border-[#2c2c44] flex items-center justify-between">
                  <span className={`text-xs font-bold ${isSelected ? 'text-[#00ffcc]' : 'text-[#aab3c5]'}`}>
                    {isSelected ? 'Pack choisi' : 'Toucher pour choisir'}
                  </span>
                  <div
                    className={`h-4 w-4 border-2 flex items-center justify-center ${
                      isSelected ? 'border-[#00ffcc] bg-[#00ffcc]' : 'border-[#2c2c44] bg-[#0d0d14]'
                    }`}
                  >
                    {isSelected && <div className="h-1.5 w-1.5 bg-[#0d0d14]" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Buttons Row with direct redirection target */}
        <div className="mt-8 pt-6 border-t border-[#2c2c44] flex items-center justify-between">
          <button
            type="button"
            onClick={onPrev}
            className="flex items-center gap-2 border border-[#2c2c44] bg-[#0d0d14] px-5 py-2.5 text-xs font-bold text-[#dde4f0] hover:bg-[#14141f] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#aab3c5]" />
            <span>Retour</span>
          </button>

          <button
            ref={continueBtnRef}
            type="button"
            onClick={onNext}
            className="flex items-center gap-2 border border-[#00ffcc] bg-[#00ffcc] px-6 py-3.5 text-xs font-bold text-[#050508] hover:bg-[#00ffcc] focus:ring-2 focus:ring-[#00ffcc] transition-all cursor-pointer shadow-sm"
          >
            <span>Choisir la date</span>
            <ArrowRight className="w-4 h-4 text-[#D96528]" />
          </button>
        </div>
      </div>
    </div>
  );
};
