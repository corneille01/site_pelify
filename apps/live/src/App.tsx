import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowUp, Loader2 } from 'lucide-react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { StepProgressBar } from './components/StepProgressBar';
import { Step1Mode } from './components/Step1Mode';
import { Step2Pack } from './components/Step2Pack';
import { Step3Date } from './components/Step3Date';
import { Step4Slot } from './components/Step4Slot';
import { Step5Activity, ActivityFormData } from './components/Step5Activity';
import { Step6Payment } from './components/Step6Payment';
import { Step7Confirmation } from './components/Step7Confirmation';
import { AuthPrefill, AuthView, ClientAccountModal } from './components/ClientAccountModal';
import { RegieDashboard } from './components/RegieDashboard';
import { LegalModal } from './components/LegalModal';
import { CookieBanner } from './components/CookieBanner';
import { NotificationsViewerModal } from './components/NotificationsViewerModal';
import { PassageSheetModal } from './components/PassageSheetModal';
import { ClientDashboard } from './components/ClientDashboard';
import { Booking, BookingMode, NotificationLog, PackId, PaymentMethod, UserAccount } from './types';
import { PACKS } from './data/packs';
import { getCookieConsent, setCookieConsent } from './utils/storage';
import { api, ApiError, Busy, ServerConfig } from './utils/api';

type Tab = 'booking' | 'regie' | 'account' | 'legal';
type LegalTab = 'mentions' | 'cgv' | 'privacy' | 'cookies' | 'accessibility' | 'sitemap';

const STEP_TITLES: Record<number, string> = {
  2: 'Choisir la formule',
  3: 'Choisir la date',
  4: "Choisir l'heure",
  5: 'Votre activité',
  6: 'Vérifier et réserver',
};

const EMPTY_ACTIVITY: ActivityFormData = {
  fullName: '',
  phone: '',
  countryCode: '+228',
  email: '',
  businessName: '',
  sector: 'autre',
  productsDescription: '',
  country: 'Togo',
  onScreenPhone: '',
  liveGoal: '',
};

const errorText = (e: unknown) => (e instanceof ApiError ? e.message : 'Une erreur est survenue. Réessayez.');

export default function App() {
  const [currentTab, setCurrentTab] = useState<Tab>('booking');
  const [currentStep, setCurrentStep] = useState(1);

  const [selectedMode, setSelectedMode] = useState<BookingMode>('presentiel');
  const [selectedPackId, setSelectedPackId] = useState<PackId>('express');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlotTime, setSelectedSlotTime] = useState('');
  const [selectedSlotEndTime, setSelectedSlotEndTime] = useState('');
  const [activityData, setActivityData] = useState<ActivityFormData>(EMPTY_ACTIVITY);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);

  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [busy, setBusy] = useState<Busy[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [cookieConsent, setCookieConsentState] = useState<boolean | null>(() => getCookieConsent());
  const [pageError, setPageError] = useState('');

  const [auth, setAuth] = useState<{ view: AuthView; prefill?: AuthPrefill; then?: () => void } | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [passageBooking, setPassageBooking] = useState<Booking | null>(null);
  const [legal, setLegal] = useState<{ tab: LegalTab } | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const isAdmin = currentUser?.role === 'regie_admin';

  /* Chargement des données du serveur */
  const refreshAvailability = useCallback(async () => {
    try {
      setBusy((await api.availability()).busy);
    } catch {
      /* les créneaux seront revérifiés par le serveur à la réservation */
    }
  }, []);

  const refreshPrivate = useCallback(async () => {
    try {
      const [b, n] = await Promise.all([api.bookings(), api.notifications()]);
      setBookings(b);
      setNotifications(n);
    } catch (e) {
      setPageError(errorText(e));
    }
  }, []);

  useEffect(() => {
    api
      .config()
      .then(setConfig)
      .catch(() => undefined);
    refreshAvailability();
    api
      .me()
      .then((r) => setCurrentUser(r.user))
      .catch(() => undefined)
      .finally(() => setSessionChecked(true));
  }, [refreshAvailability]);

  useEffect(() => {
    if (currentUser) refreshPrivate();
    else {
      setBookings([]);
      setNotifications([]);
    }
  }, [currentUser, refreshPrivate]);

  useEffect(() => {
    if (currentStep === 3 || currentStep === 4) refreshAvailability();
  }, [currentStep, refreshAvailability]);

  /* Préremplissage depuis le compte */
  useEffect(() => {
    if (!currentUser) return;
    setActivityData((prev) => ({
      ...prev,
      fullName: currentUser.fullName,
      phone: currentUser.phone,
      countryCode: currentUser.countryCode,
      email: currentUser.email,
      businessName: prev.businessName || currentUser.businessName,
      sector: prev.sector !== 'autre' ? prev.sector : currentUser.sector,
      onScreenPhone: prev.onScreenPhone || currentUser.onScreenPhone,
      country: prev.country || currentUser.country,
    }));
  }, [currentUser]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [currentStep, currentTab]);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const currentPack = useMemo(() => PACKS.find((p) => p.id === selectedPackId) || PACKS[0], [selectedPackId]);

  const activityComplete = Boolean(
    activityData.fullName && activityData.phone && activityData.email && activityData.businessName && activityData.onScreenPhone,
  );
  const canNavigateTo = (step: number) => {
    if (step <= 2) return true;
    if (step === 3) return Boolean(selectedPackId);
    if (step === 4) return Boolean(selectedDate);
    if (step === 5) return Boolean(selectedDate && selectedSlotTime);
    if (step === 6) return Boolean(selectedDate && selectedSlotTime && activityComplete && currentUser);
    if (step === 7) return Boolean(confirmedBooking);
    return false;
  };

  /* Compte */
  const openAuth = (view: AuthView = 'login', prefill?: AuthPrefill, then?: () => void) => setAuth({ view, prefill, then });

  const handleAuthenticated = (user: UserAccount) => {
    const then = auth?.then;
    setCurrentUser(user);
    setAuth(null);
    if (then) then();
    else setCurrentTab(user.role === 'regie_admin' ? 'regie' : 'account');
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      /* le cookie expire de toute façon */
    }
    setCurrentUser(null);
    setCurrentTab('booking');
    setCurrentStep(1);
    setConfirmedBooking(null);
    setActivityData(EMPTY_ACTIVITY);
  };

  /* Étape 5 : le compte est créé (ou retrouvé) avant la réservation */
  const handleActivitySubmit = (data: ActivityFormData) => {
    setActivityData(data);
    if (currentUser) {
      setCurrentStep(6);
      return;
    }
    openAuth(
      'register',
      {
        fullName: data.fullName,
        businessName: data.businessName,
        email: data.email,
        phone: data.phone,
        countryCode: data.countryCode,
        sector: data.sector,
        country: data.country,
        onScreenPhone: data.onScreenPhone,
      },
      () => setCurrentStep(6),
    );
  };

  /* Étape 6 : le serveur contrôle tout (prix, créneau, consentements) */
  const handleSubmitBooking = async (paymentMethod: PaymentMethod, consents: { cgv: boolean; data: boolean; image: boolean }): Promise<string | null> => {
    try {
      const { booking } = await api.createBooking({
        mode: selectedMode,
        packId: selectedPackId,
        date: selectedDate,
        slotTime: selectedSlotTime,
        activity: {
          businessName: activityData.businessName,
          sector: activityData.sector,
          productsDescription: activityData.productsDescription,
          country: selectedMode === 'presentiel' ? 'Togo' : activityData.country,
          onScreenPhone: activityData.onScreenPhone,
          liveGoal: activityData.liveGoal,
        },
        paymentMethod,
        consents,
      });
      setConfirmedBooking(booking);
      setCurrentStep(7);
      refreshPrivate();
      refreshAvailability();
      return null;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setCurrentUser(null);
        return 'Votre session a expiré. Reconnectez-vous puis réservez à nouveau.';
      }
      if (e instanceof ApiError && e.code === 'slot_taken') {
        refreshAvailability();
        setSelectedSlotTime('');
        setSelectedSlotEndTime('');
        setCurrentStep(4);
      }
      return errorText(e);
    }
  };

  const resetBooking = () => {
    setConfirmedBooking(null);
    setSelectedDate('');
    setSelectedSlotTime('');
    setSelectedSlotEndTime('');
    setCurrentStep(1);
  };

  const handleBookFromAccount = () => {
    resetBooking();
    setCurrentTab('booking');
    setCurrentStep(2);
  };

  const handleCancel = async (id: string): Promise<string | null> => {
    try {
      await api.cancelBooking(id);
      await refreshPrivate();
      refreshAvailability();
      return null;
    } catch (e) {
      return errorText(e);
    }
  };

  const handleUpdateStatus = async (id: string, status: Booking['status'], notes?: string) => {
    try {
      await api.patchBooking(id, { status, regieNotes: notes, ...(status === 'confirmed' ? { paymentStatus: 'completed' } : {}) });
      await refreshPrivate();
      refreshAvailability();
    } catch (e) {
      setPageError(errorText(e));
    }
  };

  const goStep = (step: number) => canNavigateTo(step) && setCurrentStep(step);
  const openLegal = (tab: LegalTab) => setLegal({ tab });

  const showBar = currentTab === 'booking';

  return (
    <div className="min-h-screen flex flex-col bg-[#0d0d14] text-white">
      {/* En-tête, étapes et bouton Précédent restent visibles en permanence */}
      <div className="sticky top-0 z-40 bg-[#0d0d14] shadow-sm">
        <Header
          currentTab={currentTab}
          onNavigate={(tab) => (tab === 'account' && !currentUser ? openAuth('login') : setCurrentTab(tab))}
          currentUser={currentUser}
          onOpenAuth={() => openAuth('login')}
          onLogout={handleLogout}
          onOpenNotifications={() => setShowNotifications(true)}
          notificationCount={notifications.length}
        />
        {showBar && <StepProgressBar currentStep={currentStep} onGoToStep={goStep} canNavigateTo={canNavigateTo} />}
        {showBar && currentStep > 1 && currentStep < 7 && (
          <div className="bg-[#0d0d14] border-b border-[#2c2c44]">
            <div className="mx-auto max-w-6xl px-3 sm:px-4 py-1.5 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
                className="inline-flex items-center gap-1.5 border border-[#2c2c44] px-3 text-sm font-semibold text-white hover:bg-[#14141f] min-h-[44px]"
              >
                <ArrowLeft className="w-4 h-4 text-[#00ffcc]" />
                <span>Étape précédente</span>
              </button>
              <p className="text-sm text-[#dde4f0] text-right">
                <span className="font-bold text-[#00ffcc] tabular-nums">Étape {currentStep} sur 7</span>
                <span className="hidden sm:inline">, {STEP_TITLES[currentStep]}</span>
              </p>
            </div>
          </div>
        )}
      </div>

      <main className="flex-1">
        {pageError && (
          <div role="alert" className="mx-auto max-w-6xl px-4 pt-4">
            <div className="flex items-start justify-between gap-3 border border-[#ff007f] bg-[rgba(255,0,127,0.12)] text-[#ff7ab3] text-sm p-3">
              <span>{pageError}</span>
              <button type="button" onClick={() => setPageError('')} className="underline shrink-0">
                Fermer
              </button>
            </div>
          </div>
        )}

        {currentTab === 'booking' && (
          <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
            {currentStep === 1 && <Step1Mode selectedMode={selectedMode} onSelectMode={setSelectedMode} onNext={() => setCurrentStep(2)} />}
            {currentStep === 2 && (
              <Step2Pack
                mode={selectedMode}
                selectedPackId={selectedPackId}
                onSelectPack={setSelectedPackId}
                onNext={() => setCurrentStep(3)}
                onPrev={() => setCurrentStep(1)}
              />
            )}
            {currentStep === 3 && (
              <Step3Date
                selectedDate={selectedDate}
                onSelectDate={(d) => {
                  setSelectedDate(d);
                  setSelectedSlotTime('');
                  setSelectedSlotEndTime('');
                }}
                onNext={() => setCurrentStep(4)}
                onPrev={() => setCurrentStep(2)}
                busy={busy}
              />
            )}
            {currentStep === 4 && (
              <Step4Slot
                packId={selectedPackId}
                date={selectedDate}
                selectedSlotTime={selectedSlotTime}
                onSelectSlot={(t, e) => {
                  setSelectedSlotTime(t);
                  setSelectedSlotEndTime(e);
                }}
                onNext={() => setCurrentStep(5)}
                onPrev={() => setCurrentStep(3)}
                busy={busy}
              />
            )}
            {currentStep === 5 && (
              <Step5Activity
                mode={selectedMode}
                initialData={activityData}
                onSubmitData={handleActivitySubmit}
                onPrev={() => setCurrentStep(4)}
                currentUser={currentUser}
              />
            )}
            {currentStep === 6 && currentUser && (
              <Step6Payment
                pack={currentPack}
                mode={selectedMode}
                date={selectedDate}
                slotTime={selectedSlotTime}
                slotEndTime={selectedSlotEndTime}
                activityData={activityData}
                onSubmit={handleSubmitBooking}
                onPrev={() => setCurrentStep(5)}
                onOpenLegal={openLegal}
              />
            )}
            {currentStep === 7 && confirmedBooking && (
              <Step7Confirmation
                booking={confirmedBooking}
                onOpenPassageSheet={setPassageBooking}
                onGoToAccount={() => setCurrentTab('account')}
                onNewBooking={resetBooking}
              />
            )}
          </div>
        )}

        {currentTab === 'regie' && (
          <div className="mx-auto max-w-6xl px-4 py-8">
            {isAdmin ? (
              <RegieDashboard
                bookings={bookings}
                onUpdateStatus={handleUpdateStatus}
                onOpenPassageSheet={setPassageBooking}
                onOpenNotifications={() => setShowNotifications(true)}
                onLogout={handleLogout}
              />
            ) : !sessionChecked ? (
              <Loader2 className="w-6 h-6 animate-spin text-[#00ffcc] mx-auto" aria-label="Chargement" />
            ) : (
              <div className="border border-[#2c2c44] p-6 text-center space-y-3">
                <p className="font-bold">Cet espace est réservé au studio.</p>
                <button type="button" className="bg-[#00ffcc] text-[#050508] px-5 py-3 font-bold min-h-[48px]" onClick={() => openAuth('login')}>
                  Se connecter
                </button>
              </div>
            )}
          </div>
        )}

        {currentTab === 'account' && currentUser && (
          <div className="mx-auto max-w-6xl px-4 py-8">
            <ClientDashboard
              currentUser={currentUser}
              allBookings={bookings}
              onLogin={setCurrentUser}
              onLogout={handleLogout}
              onBookNewSlot={handleBookFromAccount}
              onOpenPassageSheet={setPassageBooking}
              onCancelBooking={handleCancel}
            />
          </div>
        )}
      </main>

      <Footer onOpenLegal={openLegal} />

      {auth && (
        <ClientAccountModal
          initialView={auth.view}
          prefill={auth.prefill}
          config={config}
          onAuthenticated={handleAuthenticated}
          onClose={() => setAuth(null)}
        />
      )}
      {showNotifications && <NotificationsViewerModal notifications={notifications} currentUser={currentUser} onClose={() => setShowNotifications(false)} />}
      {passageBooking && <PassageSheetModal booking={passageBooking} onClose={() => setPassageBooking(null)} />}
      {legal && <LegalModal initialTab={legal.tab} onClose={() => setLegal(null)} />}

      {cookieConsent === null && (
        <CookieBanner
          onAccept={() => {
            setCookieConsent(true);
            setCookieConsentState(true);
          }}
          onDecline={() => {
            setCookieConsent(false);
            setCookieConsentState(false);
          }}
          onCustomize={() => openLegal('cookies')}
        />
      )}

      {showScrollTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-4 right-4 z-30 bg-[#00ffcc] hover:bg-[#00d9ad] text-[#050508] p-3 min-w-[48px] min-h-[48px] flex items-center justify-center"
          aria-label="Remonter en haut de la page"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
