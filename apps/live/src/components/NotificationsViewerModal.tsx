import React from 'react';
import { Bell, MessageSquare, Mail } from 'lucide-react';
import { NotificationLog, UserAccount } from '../types';

interface NotificationsViewerModalProps {
  notifications: NotificationLog[];
  currentUser?: UserAccount | null;
  onClose: () => void;
}

export const NotificationsViewerModal: React.FC<NotificationsViewerModalProps> = ({ notifications, currentUser, onClose }) => {
  // Filter notifications specifically for the current user if not regie admin
  const isRegieAdmin = currentUser?.role === 'regie_admin';

  const userNotifications =
    currentUser && !isRegieAdmin
      ? notifications.filter((n) => {
          const cleanRecip = n.recipient.toLowerCase();
          const userEmail = (currentUser.email || '').toLowerCase();
          const userPhone = currentUser.phone || '';
          return (userEmail && cleanRecip.includes(userEmail)) || (userPhone && cleanRecip.includes(userPhone)) || n.subject.includes(currentUser.businessName);
        })
      : notifications;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 p-3 sm:p-4 pt-14 sm:pt-20 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div onClick={(e) => e.stopPropagation()} className="bg-[#0d0d14] border-2 border-[#5b5b7a] w-full max-w-3xl mb-12 p-4 sm:p-6 shadow-2xl relative">
        <div className="flex items-center justify-between pb-4 border-b border-[#2c2c44] mb-6 gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="border border-[#00ffcc] bg-[rgba(0,255,204,0.08)] p-2 text-[#00ffcc] shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white">Messages envoyés ({userNotifications.length})</h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="border-2 border-[#5b5b7a] bg-[#0d0d14] hover:bg-[#14141f] px-3.5 py-1.5 text-xs font-bold text-white cursor-pointer transition-colors shrink-0"
          >
            Fermer
          </button>
        </div>

        {userNotifications.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#dde4f0]">Aucun message pour le moment. Vos messages apparaîtront ici après une réservation.</div>
        ) : (
          <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1">
            {userNotifications.map((n) => (
              <div key={n.id} className="border border-[#2c2c44] bg-[#0d0d14] p-4 space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2c2c44] pb-2">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    {n.channel === 'whatsapp' ? (
                      <span className="flex items-center gap-1 border border-[#00ffcc] bg-[rgba(0,255,204,0.08)] text-[#00d9ad] px-2 py-0.5 font-bold text-[10px]">
                        <MessageSquare className="w-3 h-3 text-[#00ffcc]" /> WhatsApp
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 border border-[#2c2c44] bg-[#0d0d14] text-white px-2 py-0.5 font-bold text-[10px]">
                        <Mail className="w-3 h-3 text-[#dde4f0]" /> E-mail
                      </span>
                    )}
                    <span className="tabular-nums text-white font-bold break-all">{n.recipient}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[#aab3c5] text-[11px] tabular-nums">
                    <span>Réservation {n.bookingRef}</span>
                    <span>{new Date(n.timestamp).toLocaleTimeString('fr-FR')}</span>
                  </div>
                </div>

                <div>
                  <strong className="text-white block mb-1">{n.subject}</strong>
                  <pre className="border border-[#2c2c44] bg-[#0d0d14] p-3 tabular-nums text-[11px] text-white whitespace-pre-wrap break-words leading-relaxed max-h-48 overflow-y-auto">
                    {n.content}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bottom footer close action */}
        <div className="mt-6 pt-4 border-t border-[#2c2c44] flex flex-wrap items-center justify-between gap-2 text-xs text-[#dde4f0]">
          <span>OCD Live, Lomé</span>
          <button
            type="button"
            onClick={onClose}
            className="border border-[#5b5b7a] bg-[#0d0d14] hover:bg-[#14141f] text-white px-4 py-1.5 font-bold text-xs cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
