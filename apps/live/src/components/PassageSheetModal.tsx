import React from 'react';
import { Printer } from 'lucide-react';
import { Booking } from '../types';
import { PACKS } from '../data/packs';
import { formatFcfa, formatDateFr, formatEur } from '../utils/formatters';

interface PassageSheetModalProps {
  booking: Booking | null;
  onClose: () => void;
}

export const PassageSheetModal: React.FC<PassageSheetModalProps> = ({ booking, onClose }) => {
  if (!booking) return null;
  const pack = PACKS.find((p) => p.id === booking.packId) || PACKS[0];

  const statusLabel =
    booking.status === 'confirmed'
      ? 'Créneau confirmé'
      : booking.status === 'completed'
        ? 'Live réalisé'
        : booking.status === 'cancelled'
          ? 'Réservation annulée'
          : 'En attente de validation';

  const paymentLabel =
    booking.paymentStatus === 'completed' ? 'Paiement reçu' : booking.paymentStatus === 'failed' ? 'Paiement refusé' : 'Paiement en cours de vérification';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 p-3 sm:p-4 pt-14 sm:pt-20 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div onClick={(e) => e.stopPropagation()} className="bg-[#0d0d14] border-2 border-[#5b5b7a] w-full max-w-2xl mb-12 p-4 sm:p-6 shadow-2xl relative">
        {/* Modal Controls (No Print) */}
        <div className="no-print flex flex-wrap items-center justify-between pb-4 border-b border-[#2c2c44] mb-6 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold bg-[#00ffcc] text-[#050508] px-2 py-0.5">Fiche de passage</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 border border-[#00ffcc] bg-[#00ffcc] px-3 py-1.5 text-xs font-bold text-[#050508] hover:bg-[#00ffcc] cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-white" />
              <span>Imprimer</span>
            </button>
            <button
              onClick={onClose}
              className="border-2 border-[#5b5b7a] bg-[#14141f] hover:bg-[#1b1b2b] px-3.5 py-1.5 text-xs font-bold text-white cursor-pointer transition-colors"
              title="Fermer la fiche"
            >
              Fermer
            </button>
          </div>
        </div>

        {/* PRINTABLE CONTENT */}
        <div className="p-4 border-2 border-[#5b5b7a] bg-[#0d0d14] space-y-6 text-xs text-white">
          {/* Header sheet */}
          <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-[#5b5b7a] pb-4">
            <div className="space-y-1 min-w-0">
              <div className="border border-[#00ffcc] bg-black inline-block px-3 py-1 mb-1">
                <span className="font-bold text-[#00ffcc] text-lg">OCD</span>
                <span className="ml-1 text-xs font-bold text-white">Live</span>
              </div>
              <h1 className="text-base font-bold">Studio House of Challenge, Lomé</h1>
              <p className="text-[11px] text-[#dde4f0]">Fiche de passage pour votre live TikTok et Facebook</p>
            </div>

            <div className="text-left sm:text-right border border-[#5b5b7a] p-2 bg-[#0d0d14] min-w-0">
              <span className="text-xs text-[#aab3c5] block font-bold">Référence</span>
              <span className="text-sm tabular-nums font-bold break-all">{booking.reference}</span>
              <span className="text-xs text-white block font-bold mt-0.5">{statusLabel}</span>
            </div>
          </div>

          {/* Core Slot Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border border-[#2c2c44] p-3 bg-[#0d0d14]">
            <div className="min-w-0">
              <span className="text-xs text-[#aab3c5] block font-bold">Date et heure (Lomé)</span>
              <p className="text-sm font-bold capitalize">{formatDateFr(booking.date)}</p>
              <p className="tabular-nums text-xs">
                {booking.slotTime} à {booking.slotEndTime} GMT
              </p>
            </div>

            <div className="min-w-0">
              <span className="text-xs text-[#aab3c5] block font-bold">Formule</span>
              <p className="text-sm font-bold">
                {pack.name} ({pack.durationLabel})
              </p>
              <p className="text-xs">{booking.mode === 'presentiel' ? 'Au studio de Lomé' : `À distance (${booking.country || 'Monde'})`}</p>
            </div>
          </div>

          {/* On-screen contact highlight */}
          <div className="border-2 border-[#00ffcc] bg-[rgba(0,255,204,0.08)] p-3 text-center">
            <span className="text-xs text-[#00d9ad] font-bold block mb-0.5">Numéro WhatsApp affiché à l'écran pendant le live</span>
            <span className="text-xl tabular-nums font-bold text-white break-all">{booking.onScreenPhone}</span>
          </div>

          {/* Merchant & Business info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1 min-w-0">
              <span className="text-xs text-[#aab3c5] font-bold block">Commerce</span>
              <p className="font-bold text-white text-sm">{booking.businessName}</p>
              <p className="text-[#dde4f0]">Secteur : {booking.sector}</p>
              <p className="text-[#dde4f0]">Pays : {booking.country || 'Togo'}</p>
            </div>

            <div className="space-y-1 min-w-0">
              <span className="text-xs text-[#aab3c5] font-bold block">Contact</span>
              <p className="font-bold text-white">{booking.fullName}</p>
              <p className="tabular-nums text-[#dde4f0]">
                {booking.countryCode} {booking.phone}
              </p>
              <p className="text-[#dde4f0] break-all">{booking.email}</p>
            </div>
          </div>

          {/* Products to feature */}
          <div className="border border-[#2c2c44] p-3">
            <span className="text-xs text-[#aab3c5] font-bold block mb-1">Produits à présenter</span>
            <p className="text-xs text-white leading-relaxed break-words">{booking.productsDescription}</p>
            {booking.liveGoal && <p className="text-xs text-[#dde4f0] mt-2">Objectif : {booking.liveGoal}</p>}
          </div>

          {/* Payment receipt confirmation */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#2c2c44] pt-3 text-xs text-[#dde4f0]">
            <div className="min-w-0 break-words">
              <p>
                Montant : <strong>{formatFcfa(booking.totalFcfa)}</strong>
              </p>
              <p>
                Paiement : {booking.paymentMethod.toUpperCase()}, référence <span className="tabular-nums">{booking.paymentReference}</span>
              </p>
              <p>{paymentLabel}</p>
            </div>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-4 border-t-2 border-[#5b5b7a] text-xs text-[#dde4f0]">
            <div>
              <p className="font-bold mb-8">Signature du commerçant</p>
              <div className="border-b border-[#2c2c44]"></div>
            </div>
            <div>
              <p className="font-bold mb-8">Signature du studio</p>
              <div className="border-b border-[#2c2c44]"></div>
            </div>
          </div>
        </div>

        {/* Bottom Close Affordance (No Print) */}
        <div className="no-print mt-4 pt-3 border-t border-[#2c2c44] flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-[#aab3c5]">Cliquez en dehors de la fiche pour la fermer</span>
          <button
            onClick={onClose}
            className="border-2 border-[#00ffcc] bg-[#00ffcc] text-[#050508] hover:bg-[#00ffcc] px-5 py-2 text-xs font-bold transition-colors cursor-pointer"
          >
            Fermer la fiche
          </button>
        </div>
      </div>
    </div>
  );
};
