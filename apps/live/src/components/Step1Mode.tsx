import React, { useRef } from 'react';
import { MapPin, Globe, Check, ArrowRight } from 'lucide-react';
import { BookingMode } from '../types';

interface Step1ModeProps {
  selectedMode: BookingMode;
  onSelectMode: (mode: BookingMode) => void;
  onNext: () => void;
}

export const Step1Mode: React.FC<Step1ModeProps> = ({ selectedMode, onSelectMode, onNext }) => {
  const continueBtnRef = useRef<HTMLButtonElement>(null);

  const handleSelect = (mode: BookingMode) => {
    onSelectMode(mode);
    setTimeout(() => {
      continueBtnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      continueBtnRef.current?.focus();
    }, 120);
  };

  return (
    <div className="space-y-8">
      {/* Studio Banner & High-intent SEO Header - Clean Verticality of H1 */}
      <div className="border border-[#2c2c44] bg-[#0d0d14] p-6 shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="min-w-0 lg:col-span-8 space-y-3">
            <h1 className="break-words text-2xl md:text-3xl font-bold text-white leading-tight">Réservez votre live au studio OCD Live</h1>

            <p className="text-sm text-[#dde4f0] leading-relaxed max-w-2xl">
              Présentez vos articles et affichez votre numéro WhatsApp en direct sur TikTok et Facebook.
              <strong className="text-white"> « Le marketing avant la vente. »</strong>
            </p>

            <div className="pt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#dde4f0]">
              <span className="flex min-w-0 items-start gap-1.5 font-semibold text-white">
                <span className="text-[#00ffcc]">■</span> Un seul live à la fois, sans chevauchement de créneau.
              </span>
              <span className="flex min-w-0 items-start gap-1.5 font-semibold text-white">
                <span className="text-[#00ffcc]">■</span> L'équipe du studio affiche votre numéro WhatsApp pendant tout le live.
              </span>
            </div>
          </div>

          {/* Photo du studio OCD Live */}
          <div className="lg:col-span-4 border border-[#2c2c44] bg-[#14141f] p-2">
            <div className="relative aspect-[9/12] max-h-56 w-full overflow-hidden bg-black">
              <img
                src={`${import.meta.env.BASE_URL}assets/aistudio/WhatsApp_Image_2026-11-07_at_19.57.14_0a412c55.jpeg`}
                alt="Studio OCD Live Lomé House of Challenge tournage en direct"
                className="w-full h-full object-cover object-top"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2 text-white">
                <p className="text-[11px] font-bold">Studio OCD Live Lomé</p>
                <p className="text-[10px] text-[#dde4f0]">« De la créativité dans la simplicité »</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Choice Section - Clean Verticality of H2 */}
      <div className="bg-[#0d0d14] border border-[#2c2c44] p-6 shadow-xs">
        <div className="border-b border-[#2c2c44] pb-4 mb-6">
          <h2 className="text-xl font-bold text-white ">Choisissez comment vous passez en direct</h2>
          <p className="text-xs text-[#dde4f0] mt-1">Venez au studio à Lomé, ou intervenez à distance depuis votre boutique ou votre atelier.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Option 1: Présentiel à Lomé */}
          <div
            onClick={() => handleSelect('presentiel')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') handleSelect('presentiel');
            }}
            className={`border-2 p-6 cursor-pointer transition-all flex flex-col justify-between ${
              selectedMode === 'presentiel' ? 'border-[#00ffcc] bg-[rgba(0,255,204,0.08)] ring-1 ring-[#00ffcc]' : 'border-[#2c2c44] bg-[#0d0d14] hover:border-[#2c2c44]'
            }`}
          >
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="border border-[#2c2c44] bg-[#0d0d14] p-3">
                  <MapPin className="w-6 h-6 text-[#00ffcc]" />
                </div>
                {selectedMode === 'presentiel' && (
                  <span className="border border-[#00ffcc] bg-[#00ffcc] text-[#050508] px-2.5 py-1 text-xs font-bold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Sélectionné
                  </span>
                )}
              </div>

              <h3 className="text-lg font-bold text-white mb-2">En présentiel au studio de Lomé</h3>

              <p className="text-xs text-[#dde4f0] leading-relaxed mb-4">Vous venez au studio de Lomé avec vos produits, vos tenues ou vos plats.</p>

              <ul className="space-y-2 text-xs text-[#dde4f0] border-t border-[#2c2c44] pt-4">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-[#00ffcc] shrink-0 mt-0.5" />
                  <span>Vous passez en direct sur un plateau éclairé aux couleurs d'OCD Live.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-[#00ffcc] shrink-0 mt-0.5" />
                  <span>Un cadreur et un technicien son et image vous accompagnent pendant toute la session.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-[#00ffcc] shrink-0 mt-0.5" />
                  <span>Ce choix convient aux commerçants, créateurs de mode et restaurateurs du Grand Lomé.</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 pt-4 border-t border-[#2c2c44]">
              <span className="text-xs font-bold text-white">Lieu : Lomé, Togo</span>
            </div>
          </div>

          {/* Option 2: À distance */}
          <div
            onClick={() => handleSelect('distance')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') handleSelect('distance');
            }}
            className={`border-2 p-6 cursor-pointer transition-all flex flex-col justify-between ${
              selectedMode === 'distance' ? 'border-[#00ffcc] bg-[rgba(0,255,204,0.08)] ring-1 ring-[#00ffcc]' : 'border-[#2c2c44] bg-[#0d0d14] hover:border-[#2c2c44]'
            }`}
          >
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="border border-[#2c2c44] bg-[#0d0d14] p-3">
                  <Globe className="w-6 h-6 text-[#00ffcc]" />
                </div>
                {selectedMode === 'distance' && (
                  <span className="border border-[#00ffcc] bg-[#00ffcc] text-[#050508] px-2.5 py-1 text-xs font-bold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Sélectionné
                  </span>
                )}
              </div>

              <h3 className="text-lg font-bold text-white mb-2">À distance depuis chez vous</h3>

              <p className="text-xs text-[#dde4f0] leading-relaxed mb-4">
                Vous restez dans votre boutique, votre atelier ou chez vous. Une animatrice au studio de Lomé présente vos offres en direct.
              </p>

              <ul className="space-y-2 text-xs text-[#dde4f0] border-t border-[#2c2c44] pt-4">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-[#00ffcc] shrink-0 mt-0.5" />
                  <span>Une animatrice du studio présente vos produits avec vous.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-[#00ffcc] shrink-0 mt-0.5" />
                  <span>Vous vous connectez avec votre smartphone en 4G ou en Wifi.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-[#00ffcc] shrink-0 mt-0.5" />
                  <span>Ce choix convient si vous êtes hors du Togo, par exemple en Côte d'Ivoire, au Bénin ou en France.</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 pt-4 border-t border-[#2c2c44]">
              <span className="text-xs font-bold text-white">Lieu : où vous voulez</span>
            </div>
          </div>
        </div>

        {/* Action Button - Automatically targeted on selection */}
        <div className="mt-8 pt-6 border-t border-[#2c2c44] flex justify-end">
          <button
            ref={continueBtnRef}
            type="button"
            onClick={onNext}
            className="flex items-center gap-2 border border-[#00ffcc] bg-[#00ffcc] px-6 py-3.5 text-sm font-bold text-[#050508] hover:bg-[#00ffcc] active:bg-[#00d9ad] focus:ring-2 focus:ring-[#00ffcc] transition-all cursor-pointer shadow-sm"
          >
            <span>Choisir mon pack</span>
            <ArrowRight className="w-4 h-4 text-[#00ffcc]" />
          </button>
        </div>
      </div>
    </div>
  );
};
