import React, { useState } from 'react';
import { Search, Download, MessageSquare, Printer, LogOut } from 'lucide-react';
import { Booking, BookingStatus } from '../types';
import { PACKS } from '../data/packs';
import { formatFcfa, formatEur, formatDateFr } from '../utils/formatters';

interface RegieDashboardProps {
  bookings: Booking[];
  onUpdateStatus: (id: string, status: BookingStatus, notes?: string) => void;
  onOpenPassageSheet: (booking: Booking) => void;
  onOpenNotifications: () => void;
  onLogout?: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'À confirmer',
  confirmed: 'Confirmée',
  completed: 'Réalisée',
  cancelled: 'Annulée',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  tmoney: 'TMoney',
  flooz: 'Flooz',
  mtn_momo: 'MTN MoMo',
  card: 'Carte bancaire',
  wave_orange: 'Wave ou Orange Money',
  bank_transfer: 'Virement bancaire',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  completed: 'Payé',
  pending: 'Paiement en attente',
  failed: 'Paiement échoué',
};

export const RegieDashboard: React.FC<RegieDashboardProps> = ({ bookings, onUpdateStatus, onOpenPassageSheet, onOpenNotifications, onLogout }) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modeFilter, setModeFilter] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(bookings[0]?.id ?? null);
  const [regieNoteInput, setRegieNoteInput] = useState<string>(bookings[0]?.regieNotes || '');

  // Always read the live booking so status buttons reflect the latest props
  const selectedBooking = bookings.find((b) => b.id === selectedId) ?? null;

  // Statistiques calculées à partir des réservations reçues
  const activeBookings = bookings.filter((b) => b.status !== 'cancelled');
  const paidBookings = activeBookings.filter((b) => b.paymentStatus === 'completed');
  const unpaidBookings = activeBookings.filter((b) => b.paymentStatus !== 'completed');

  const paidFcfa = paidBookings.reduce((sum, b) => sum + b.totalFcfa, 0);
  const paidEur = paidBookings.reduce((sum, b) => sum + b.totalEur, 0);
  const unpaidFcfa = unpaidBookings.reduce((sum, b) => sum + b.totalFcfa, 0);

  const presentielCount = activeBookings.filter((b) => b.mode === 'presentiel').length;
  const distanceCount = activeBookings.filter((b) => b.mode === 'distance').length;
  const toConfirmCount = bookings.filter((b) => b.status === 'pending').length;
  const confirmedCount = bookings.filter((b) => b.status === 'confirmed').length;

  // Filtered bookings
  const filteredBookings = bookings.filter((b) => {
    const matchesSearch =
      b.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.phone.includes(searchTerm);

    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    const matchesMode = modeFilter === 'all' || b.mode === modeFilter;

    return matchesSearch && matchesStatus && matchesMode;
  });

  // Export CSV
  const handleExportCsv = () => {
    const headers = [
      'Reference',
      'Date',
      'Heure',
      'Mode',
      'Pack',
      'Commercant',
      'Boutique',
      'Secteur',
      'Telephone_Client',
      'Telephone_Ecran',
      'Pays',
      'Montant_FCFA',
      'Statut',
      'Paiement',
      'Statut_Paiement',
      'Reference_Paiement',
    ];

    const rows = bookings.map((b) => [
      b.reference,
      b.date,
      b.slotTime,
      b.mode,
      b.packId,
      `"${b.fullName}"`,
      `"${b.businessName}"`,
      b.sector,
      `"${b.countryCode} ${b.phone}"`,
      `"${b.onScreenPhone}"`,
      `"${b.country}"`,
      b.totalFcfa,
      b.status,
      b.paymentMethod,
      b.paymentStatus,
      `"${b.paymentReference}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `OCD_Live_Reservations_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveNotes = () => {
    if (!selectedBooking) return;
    onUpdateStatus(selectedBooking.id, selectedBooking.status, regieNoteInput);
  };

  const statusButtonBase = 'py-2 px-3 text-xs font-bold border transition-colors';
  const statusButtonIdle = 'border-[#2c2c44] bg-[#0d0d14] text-white hover:bg-[#14141f]';

  return (
    <div className="space-y-6">
      {/* En-tête et statistiques */}
      <div className="border border-[#2c2c44] bg-[#0d0d14] p-4 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#2c2c44] pb-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white ">Gestion des lives</h1>
            <p className="text-xs text-[#dde4f0] mt-1">Suivez les réservations, les paiements et les fiches de passage.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 border border-[#2c2c44] bg-[#0d0d14] px-3 py-2 text-xs font-bold text-white hover:bg-[#14141f]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exporter en CSV</span>
            </button>

            <button
              type="button"
              onClick={onOpenNotifications}
              className="flex items-center gap-1.5 border border-[#00ffcc] bg-[#00ffcc] px-3 py-2 text-xs font-bold text-[#050508] hover:bg-[#00ffcc]"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#00ffcc]" />
              <span>Journal des messages</span>
            </button>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-1.5 border border-[#ff007f] bg-[#0d0d14] hover:bg-[rgba(255,0,127,0.12)] text-[#ff7ab3] px-3 py-2 text-xs font-bold transition-colors cursor-pointer"
                title="Quitter la session du studio"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Se déconnecter</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border border-[#2c2c44] bg-[#0d0d14] p-4">
            <span className="text-xs text-[#dde4f0] font-bold block mb-1">Montant payé</span>
            <div className="text-2xl font-bold text-white tabular-nums">{formatFcfa(paidFcfa)}</div>
            <span className="text-xs text-[#dde4f0] tabular-nums">soit {formatEur(paidEur)}</span>
          </div>

          <div className="border border-[#2c2c44] bg-[#0d0d14] p-4">
            <span className="text-xs text-[#dde4f0] font-bold block mb-1">Paiements à vérifier</span>
            <div className="text-2xl font-bold text-white tabular-nums">{unpaidBookings.length}</div>
            <span className="text-xs text-[#dde4f0] tabular-nums">{formatFcfa(unpaidFcfa)} en attente</span>
          </div>

          <div className="border border-[#2c2c44] bg-[#0d0d14] p-4">
            <span className="text-xs text-[#dde4f0] font-bold block mb-1">Réservations actives</span>
            <div className="text-2xl font-bold text-white tabular-nums">{activeBookings.length}</div>
            <span className="text-xs text-[#dde4f0]">
              {presentielCount} en présentiel, {distanceCount} à distance
            </span>
          </div>

          <div className="border border-[#2c2c44] bg-[#0d0d14] p-4">
            <span className="text-xs text-[#dde4f0] font-bold block mb-1">À confirmer</span>
            <div className="text-2xl font-bold text-[#00ffcc] tabular-nums">{toConfirmCount}</div>
            <span className="text-xs text-[#dde4f0]">{confirmedCount} déjà confirmées</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Liste des réservations */}
        <div className="lg:col-span-7 bg-[#0d0d14] border border-[#2c2c44] p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-4 pb-4 border-b border-[#2c2c44]">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-4 h-4 absolute left-3 top-3 text-[#aab3c5]" aria-hidden="true" />
              <input
                type="text"
                aria-label="Rechercher une réservation"
                placeholder="Nom, boutique, référence ou téléphone"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-[#2c2c44] text-xs focus:border-[#00ffcc] focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                aria-label="Filtrer par statut"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-[#2c2c44] bg-[#0d0d14] px-2.5 py-2 text-xs font-bold text-[#dde4f0] focus:outline-none"
              >
                <option value="all">Tous les statuts</option>
                <option value="pending">À confirmer</option>
                <option value="confirmed">Confirmées</option>
                <option value="completed">Réalisées</option>
                <option value="cancelled">Annulées</option>
              </select>

              <select
                aria-label="Filtrer par mode"
                value={modeFilter}
                onChange={(e) => setModeFilter(e.target.value)}
                className="border border-[#2c2c44] bg-[#0d0d14] px-2.5 py-2 text-xs font-bold text-[#dde4f0] focus:outline-none"
              >
                <option value="all">Tous les modes</option>
                <option value="presentiel">Présentiel</option>
                <option value="distance">À distance</option>
              </select>
            </div>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredBookings.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#dde4f0]">Aucune réservation ne correspond à votre recherche.</div>
            ) : (
              filteredBookings.map((b) => {
                const isSelected = selectedBooking?.id === b.id;
                const isPaid = b.paymentStatus === 'completed';

                return (
                  <div
                    key={b.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedId(b.id);
                      setRegieNoteInput(b.regieNotes || '');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedId(b.id);
                        setRegieNoteInput(b.regieNotes || '');
                      }
                    }}
                    className={`border-2 p-3 cursor-pointer transition-all ${
                      isSelected ? 'border-[#00ffcc] bg-[rgba(0,255,204,0.08)]' : 'border-[#2c2c44] bg-[#0d0d14] hover:border-[#2c2c44]'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                      <div className="min-w-0">
                        <span className="font-bold text-xs text-white block tabular-nums break-words">
                          {b.reference}, {b.businessName}
                        </span>
                        <span className="text-[11px] text-[#dde4f0]">
                          {b.fullName} ({b.countryCode} {b.phone})
                        </span>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 border ${
                          b.status === 'confirmed'
                            ? 'border-[#00ffcc] bg-[rgba(0,255,204,0.08)] text-[#00d9ad]'
                            : b.status === 'pending'
                              ? 'border-[#2c2c44] bg-[#0d0d14] text-white'
                              : b.status === 'completed'
                                ? 'border-[#5b5b7a] bg-[#14141f] text-[#dde4f0]'
                                : 'border-[#ff007f] bg-[#0d0d14] text-[#ff7ab3]'
                        }`}
                      >
                        {STATUS_LABELS[b.status] ?? b.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs pt-2 border-t border-[#2c2c44] text-[#dde4f0]">
                      <span className="font-bold text-white tabular-nums">
                        {formatDateFr(b.date)} à {b.slotTime} (GMT)
                      </span>
                      <span>{b.mode === 'presentiel' ? 'Studio de Lomé' : `À distance (${b.country})`}</span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs pt-1 text-[#dde4f0]">
                      <span>
                        {PAYMENT_METHOD_LABELS[b.paymentMethod] ?? b.paymentMethod}
                        {' : '}
                        <span className={isPaid ? 'font-bold text-white' : 'font-bold text-[#00d9ad]'}>
                          {PAYMENT_STATUS_LABELS[b.paymentStatus] ?? 'Paiement à vérifier'}
                        </span>
                      </span>
                      <span className="font-bold text-white tabular-nums">{formatFcfa(b.totalFcfa)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Détail de la réservation */}
        <div className="lg:col-span-5 bg-[#0d0d14] border border-[#2c2c44] p-4 sm:p-5">
          {selectedBooking ? (
            <div className="space-y-5 text-xs">
              <div className="border-b border-[#2c2c44] pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <span className="font-bold text-sm text-white tabular-nums break-all">Dossier {selectedBooking.reference}</span>
                  <span className="text-[10px] font-bold text-[#00d9ad] bg-[rgba(0,255,204,0.08)] border border-[#00ffcc] px-1.5 py-0.5">
                    {selectedBooking.mode === 'presentiel' ? 'Présentiel à Lomé' : 'À distance'}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white">{selectedBooking.businessName}</h3>
                <p className="text-[#dde4f0]">
                  Responsable : {selectedBooking.fullName}, {selectedBooking.countryCode} {selectedBooking.phone}
                </p>
              </div>

              <div className="border border-[#2c2c44] bg-[#0d0d14] p-3 space-y-2">
                <div className="flex flex-wrap justify-between gap-x-3">
                  <span className="text-[#dde4f0]">Date de passage</span>
                  <strong className="text-white">{formatDateFr(selectedBooking.date)}</strong>
                </div>
                <div className="flex flex-wrap justify-between gap-x-3">
                  <span className="text-[#dde4f0]">Créneau</span>
                  <strong className="text-white tabular-nums">
                    {selectedBooking.slotTime} à {selectedBooking.slotEndTime} (GMT)
                  </strong>
                </div>
                <div className="flex flex-wrap justify-between gap-x-3">
                  <span className="text-[#dde4f0]">Pack</span>
                  <strong className="text-[#00d9ad]">{PACKS.find((p) => p.id === selectedBooking.packId)?.name ?? selectedBooking.packId}</strong>
                </div>
                <div className="flex flex-wrap justify-between gap-x-3">
                  <span className="text-[#dde4f0]">Numéro affiché à l'écran</span>
                  <strong className="text-white tabular-nums">{selectedBooking.onScreenPhone}</strong>
                </div>
              </div>

              {/* Paiement à vérifier */}
              <div className="border border-[#2c2c44] bg-[#0d0d14] p-3 space-y-2">
                <span className="text-white font-bold block">Paiement</span>
                <div className="flex flex-wrap justify-between gap-x-3">
                  <span className="text-[#dde4f0]">Mode de paiement</span>
                  <strong className="text-white">{PAYMENT_METHOD_LABELS[selectedBooking.paymentMethod] ?? selectedBooking.paymentMethod}</strong>
                </div>
                <div className="flex flex-wrap justify-between gap-x-3">
                  <span className="text-[#dde4f0]">Référence</span>
                  <strong className="text-white tabular-nums break-all">{selectedBooking.paymentReference || 'Non renseignée'}</strong>
                </div>
                <div className="flex flex-wrap justify-between gap-x-3">
                  <span className="text-[#dde4f0]">Montant</span>
                  <strong className="text-white tabular-nums">{formatFcfa(selectedBooking.totalFcfa)}</strong>
                </div>
                <div className="flex flex-wrap justify-between gap-x-3">
                  <span className="text-[#dde4f0]">État</span>
                  <strong className={selectedBooking.paymentStatus === 'completed' ? 'text-white' : 'text-[#00d9ad]'}>
                    {selectedBooking.paymentStatus === 'completed' ? 'Payé' : (PAYMENT_STATUS_LABELS[selectedBooking.paymentStatus] ?? 'À vérifier')}
                  </strong>
                </div>
                {selectedBooking.paymentStatus !== 'completed' && (
                  <p className="text-[#dde4f0]">Vérifiez la référence sur le compte Mobile Money du studio avant de confirmer.</p>
                )}
              </div>

              <div>
                <span className="text-white font-bold block mb-1">Produits présentés</span>
                <div className="border border-[#2c2c44] bg-[#0d0d14] p-2.5 text-white leading-relaxed">{selectedBooking.productsDescription}</div>
              </div>

              <div>
                <span className="text-white font-bold block mb-2">Changer le statut</span>
                <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onUpdateStatus(selectedBooking.id, 'confirmed')}
                    className={`${statusButtonBase} ${selectedBooking.status === 'confirmed' ? 'border-[#00ffcc] bg-[#00ffcc] text-[#050508]' : statusButtonIdle}`}
                  >
                    Confirmer
                  </button>

                  <button
                    type="button"
                    onClick={() => onUpdateStatus(selectedBooking.id, 'completed')}
                    className={`${statusButtonBase} ${
                      selectedBooking.status === 'completed' ? 'border-[#00ffcc] bg-[#00ffcc] text-[#050508]' : statusButtonIdle
                    }`}
                  >
                    Marquer comme réalisé
                  </button>

                  <button
                    type="button"
                    onClick={() => onUpdateStatus(selectedBooking.id, 'pending')}
                    className={`${statusButtonBase} ${
                      selectedBooking.status === 'pending' ? 'border-[#00ffcc] bg-[#00ffcc] text-[#050508]' : statusButtonIdle
                    }`}
                  >
                    Remettre en attente
                  </button>

                  <button
                    type="button"
                    onClick={() => onUpdateStatus(selectedBooking.id, 'cancelled')}
                    className={`${statusButtonBase} ${
                      selectedBooking.status === 'cancelled' ? 'border-[#ff007f] bg-[#c4005f] text-white' : 'border-[#ff007f] bg-[#0d0d14] text-[#ff7ab3] hover:bg-[rgba(255,0,127,0.12)]'
                    }`}
                  >
                    Annuler
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="studio-notes" className="text-white font-bold block mb-1">
                  Notes internes du studio
                </label>
                <textarea
                  id="studio-notes"
                  rows={2}
                  value={regieNoteInput}
                  onChange={(e) => setRegieNoteInput(e.target.value)}
                  placeholder="Exemple : échantillons reçus, liaison WhatsApp testée."
                  className="w-full p-2 border border-[#2c2c44] text-xs focus:border-[#00ffcc] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSaveNotes}
                  className="mt-1 border border-[#00ffcc] bg-[#00ffcc] px-3 py-1.5 text-[11px] font-bold text-[#050508] hover:bg-[#00ffcc]"
                >
                  Enregistrer les notes
                </button>
              </div>

              <div className="pt-3 border-t border-[#2c2c44] flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onOpenPassageSheet(selectedBooking)}
                  className="flex-1 flex items-center justify-center gap-1.5 border border-[#2c2c44] bg-[#0d0d14] py-2 font-bold text-white hover:bg-[#14141f]"
                >
                  <Printer className="w-3.5 h-3.5 text-[#00ffcc]" />
                  <span>Fiche de passage</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-[#dde4f0]">Choisissez une réservation dans la liste pour voir son détail.</div>
          )}
        </div>
      </div>
    </div>
  );
};
