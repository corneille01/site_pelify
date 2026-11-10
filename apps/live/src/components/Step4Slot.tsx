import React, { useRef } from 'react';
import { Clock, Check, ArrowRight, ArrowLeft, AlertCircle, ShieldCheck } from 'lucide-react';
import { PACKS, TIME_SLOTS_1H30, TIME_SLOTS_4H } from '../data/packs';
import { PackId } from '../types';
import type { Busy } from '../utils/api';
import { formatDateFr } from '../utils/formatters';

interface Step4SlotProps {
  packId: PackId;
  date: string;
  selectedSlotTime: string;
  onSelectSlot: (time: string, endTime: string) => void;
  onNext: () => void;
  onPrev: () => void;
  busy: Busy[];
}

export const Step4Slot: React.FC<Step4SlotProps> = ({ packId, date, selectedSlotTime, onSelectSlot, onNext, onPrev, busy }) => {
  const ctaButtonRef = useRef<HTMLButtonElement>(null);
  const currentPack = PACKS.find((p) => p.id === packId) || PACKS[0];
  const isMarathon = currentPack.isContinuousBlock;
  const availableSlotOptions = isMarathon ? TIME_SLOTS_4H : TIME_SLOTS_1H30;

  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  // Un créneau est pris dès qu'il chevauche une réservation existante, quelle que soit sa durée.
  const isSlotTaken = (start: string, end: string) =>
    busy.some((b) => b.date === date && toMinutes(start) < toMinutes(b.slotEndTime) && toMinutes(b.slotTime) < toMinutes(end));

  return (
    <div className="space-y-6">
      <div className="bg-[#0d0d14] border border-[#2c2c44] p-6 shadow-xs">
        {/* Header - Clean Verticality of H2 */}
        <div className="border-b border-[#2c2c44] pb-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold text-white ">Choisissez l'heure de votre live</h2>
            </div>
            <div className="border border-[#2c2c44] bg-[#14141f] px-3 py-1 text-xs">
              <span className="text-[#aab3c5]">Date :</span> <strong className="text-white capitalize">{formatDateFr(date)}</strong>
            </div>
          </div>
          <p className="text-xs text-[#dde4f0] mt-2">
            Les heures sont celles de Lomé (GMT). Le studio ne diffuse qu'un live à la fois, toute l'équipe est avec vous pendant votre passage.
          </p>
        </div>

        {/* Multi-sessions reminder if applicable */}
        {currentPack.sessionsCount > 1 && (
          <div className="border border-[#D96528] bg-[rgba(0,255,204,0.08)] p-4 mb-6 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[#00ffcc] shrink-0 mt-0.5" />
            <div className="text-xs text-white">
              <strong className="text-[#00ffcc] block mb-0.5">Formule de {currentPack.sessionsCount} lives</strong>
              Vous réservez ici le créneau de votre <strong>premier live</strong>. Vous fixerez les dates des autres lives avec l'équipe du studio, selon votre
              calendrier.
            </div>
          </div>
        )}

        {/* Slots List */}
        <div className="space-y-3 mb-6">
          {availableSlotOptions.map((slot) => {
            const taken = isSlotTaken(slot.time, slot.endTime);
            const isSelected = selectedSlotTime === slot.time;

            return (
              <div
                key={slot.time}
                onClick={() => {
                  if (!taken) {
                    onSelectSlot(slot.time, slot.endTime);
                    setTimeout(() => {
                      ctaButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 150);
                  }
                }}
                className={`border-2 p-4 transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
                  isSelected
                    ? 'border-[#00ffcc] bg-[rgba(0,255,204,0.08)] ring-1 ring-[#00ffcc]'
                    : !taken
                      ? 'border-[#2c2c44] bg-[#0d0d14] hover:border-[#00ffcc] hover:bg-[#0d0d14] cursor-pointer'
                      : 'border-[#2c2c44] bg-[#14141f] opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 border ${
                      isSelected
                        ? 'border-[#00ffcc] bg-[#00ffcc] text-[#050508]'
                        : !taken
                          ? 'border-[#2c2c44] bg-[#14141f] text-[#dde4f0]'
                          : 'border-[#2c2c44] bg-[#1b1b2b] text-[#aab3c5]'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold tabular-nums text-white">{slot.label}</span>
                      {isSelected && <span className="border border-[#00ffcc] bg-[#00ffcc] text-[#050508] px-2 py-0.5 text-[10px] font-bold ">Choisi</span>}
                    </div>
                    <p className="text-xs text-[#aab3c5]">Une équipe du studio vous accompagne</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {taken ? (
                    <div className="text-right">
                      <span className="border border-[#2c2c44] bg-[#1b1b2b] text-[#dde4f0] px-2.5 py-1 text-xs font-bold block">Déjà réservé</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${isSelected ? 'text-[#00ffcc]' : 'text-white'}`}>
                        {isSelected ? 'Créneau choisi' : 'Libre'}
                      </span>
                      <div
                        className={`h-4 w-4 border-2 flex items-center justify-center ${
                          isSelected ? 'border-[#00ffcc] bg-[#00ffcc]' : 'border-[#2c2c44] bg-[#0d0d14]'
                        }`}
                      >
                        {isSelected && <div className="h-1.5 w-1.5 bg-[#0d0d14]" />}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected slot feedback */}
        {selectedSlotTime ? (
          <div className="border border-[#00ffcc] bg-[rgba(0,255,204,0.08)] p-4 flex items-center justify-between text-xs">
            <div>
              <p className="text-[#dde4f0]">Créneau choisi</p>
              <p className="text-sm font-bold text-white tabular-nums">
                {selectedSlotTime} heure de Lomé, durée {currentPack.durationLabel}
              </p>
            </div>
            <span className="font-bold text-[#00ffcc] ">Prochaine étape : votre activité</span>
          </div>
        ) : (
          <div className="border border-[#2c2c44] bg-[#0d0d14] p-4 flex items-center gap-3 text-xs text-[#dde4f0]">
            <AlertCircle className="w-4 h-4 text-[#aab3c5] shrink-0" />
            <span>Choisissez une heure libre pour continuer.</span>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="mt-8 pt-6 border-t border-[#2c2c44] flex items-center justify-between">
          <button
            type="button"
            onClick={onPrev}
            className="flex items-center gap-2 border border-[#2c2c44] bg-[#0d0d14] px-5 py-2.5 text-xs font-bold text-[#dde4f0] hover:bg-[#14141f] transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-[#aab3c5]" />
            <span>Changer la date</span>
          </button>

          <button
            ref={ctaButtonRef}
            type="button"
            disabled={!selectedSlotTime}
            onClick={onNext}
            className={`flex items-center gap-2 border px-6 py-3 text-xs font-bold transition-colors ${
              selectedSlotTime
                ? 'border-[#00ffcc] bg-[#00ffcc] text-[#050508] hover:bg-[#00ffcc]'
                : 'border-[#2c2c44] bg-[#1b1b2b] text-[#aab3c5] cursor-not-allowed'
            }`}
          >
            <span>Continuer</span>
            <ArrowRight className="w-4 h-4 text-[#D96528]" />
          </button>
        </div>
      </div>
    </div>
  );
};
