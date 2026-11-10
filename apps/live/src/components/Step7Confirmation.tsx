import React, { useState } from 'react';
import { CheckCircle2, Copy, Printer, ArrowRight, Check, Minus } from 'lucide-react';
import { Booking } from '../types';
import { PACKS } from '../data/packs';
import { formatFcfa, formatDateFr } from '../utils/formatters';

interface Step7ConfirmationProps {
  booking: Booking;
  onOpenPassageSheet: (booking: Booking) => void;
  onGoToAccount: () => void;
  onNewBooking: () => void;
}

export const Step7Confirmation: React.FC<Step7ConfirmationProps> = ({ booking, onOpenPassageSheet, onGoToAccount, onNewBooking }) => {
  const pack = PACKS.find((p) => p.id === booking.packId) || PACKS[0];
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard
      ?.writeText(booking.reference)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => undefined);
  };

  const sent = [
    { label: 'WhatsApp à vous', ok: booking.whatsappNotificationSentClient },
    { label: 'E-mail à vous', ok: booking.emailNotificationSentClient },
    { label: 'WhatsApp au studio', ok: booking.whatsappNotificationSentRegie },
    { label: 'E-mail au studio', ok: booking.emailNotificationSentRegie },
  ];
  const payLine =
    booking.paymentMethod === 'onsite'
      ? 'Vous réglez au studio le jour du live.'
      : "Le studio vous envoie la demande de paiement. Votre créneau est confirmé dès qu'il reçoit le règlement.";

  return (
    <div className="bg-[#0d0d14] border border-[#2c2c44] p-4 sm:p-6 space-y-6">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="w-8 h-8 text-[#00ffcc] shrink-0" />
        <div>
          <h2 className="text-xl font-bold text-white">Votre créneau est réservé</h2>
          <p className="text-sm text-[#dde4f0] mt-1">{payLine}</p>
        </div>
      </div>

      <div className="border-2 border-[#00ffcc] bg-[rgba(0,255,204,0.08)] p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-[#dde4f0]">Numéro de réservation</p>
          <p className="text-xl font-bold text-[#00ffcc] tabular-nums">{booking.reference}</p>
        </div>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-2 border border-[#2c2c44] bg-[#0d0d14] px-4 py-2 text-sm font-semibold min-h-[44px]"
        >
          {copied ? <Check className="w-4 h-4 text-[#00ffcc]" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copié' : 'Copier'}
        </button>
      </div>

      <dl className="border border-[#2c2c44] divide-y divide-[#2c2c44] text-sm">
        {[
          ['Formule', pack.name],
          ['Date', formatDateFr(booking.date)],
          ['Heure', `${booking.slotTime} à ${booking.slotEndTime}, heure de Lomé`],
          ['Lieu', booking.mode === 'presentiel' ? 'Studio de Lomé' : 'À distance'],
          ['Total', formatFcfa(booking.totalFcfa)],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-4 py-3">
            <dt className="text-[#aab3c5]">{k}</dt>
            <dd className="font-semibold text-white text-right">{v}</dd>
          </div>
        ))}
      </dl>

      <div>
        <h3 className="text-sm font-bold text-white mb-2">Messages envoyés</h3>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          {sent.map((s) => (
            <li key={s.label} className="flex items-center gap-2 border border-[#2c2c44] px-3 py-2">
              {s.ok ? <Check className="w-4 h-4 text-[#00ffcc]" /> : <Minus className="w-4 h-4 text-[#aab3c5]" />}
              <span className={s.ok ? 'text-white' : 'text-[#aab3c5]'}>
                {s.label}
                {s.ok ? '' : ', non envoyé'}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-[#aab3c5] mt-2">Si un message n'arrive pas, le studio vous contacte à partir de cette réservation.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[#2c2c44]">
        <button
          type="button"
          onClick={() => onOpenPassageSheet(booking)}
          className="inline-flex items-center justify-center gap-2 border border-[#2c2c44] px-5 py-3 text-sm font-semibold hover:bg-[#14141f] min-h-[48px]"
        >
          <Printer className="w-4 h-4" /> Fiche de passage
        </button>
        <button
          type="button"
          onClick={onGoToAccount}
          className="inline-flex items-center justify-center gap-2 bg-[#00ffcc] hover:bg-[#00d9ad] text-[#050508] px-5 py-3 text-sm font-bold min-h-[48px]"
        >
          Voir mon espace <ArrowRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onNewBooking}
          className="inline-flex items-center justify-center px-5 py-3 text-sm font-semibold underline text-white min-h-[48px]"
        >
          Faire une autre réservation
        </button>
      </div>
    </div>
  );
};
