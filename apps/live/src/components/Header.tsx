import React, { useEffect, useState } from 'react';
import { Menu, X, Video, User, LayoutDashboard, Bell, LogOut, Home } from 'lucide-react';
import { UserAccount } from '../types';

type Tab = 'booking' | 'regie' | 'account' | 'legal';

interface HeaderProps {
  currentTab: Tab;
  onNavigate: (tab: Tab) => void;
  currentUser: UserAccount | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  onOpenNotifications: () => void;
  notificationCount: number;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, onNavigate, currentUser, onOpenAuth, onLogout, onOpenNotifications, notificationCount }) => {
  const [open, setOpen] = useState(false);
  const isAdmin = currentUser?.role === 'regie_admin';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const go = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  const item = (active: boolean) =>
    `flex items-center gap-2 px-3 py-3 md:py-2 text-sm font-semibold min-h-[44px] w-full md:w-auto text-left border-b-2 ${
      active ? 'border-[#00ffcc] text-[#00ffcc]' : 'border-transparent text-white hover:text-[#00ffcc]'
    }`;

  return (
    <header className="bg-[#0d0d14] border-b border-[#2c2c44] relative">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <a href="/" className="flex items-center gap-2 shrink-0" aria-label="PELIFY, tous les univers">
            <img src="/img/logo-mark.svg" alt="" width={32} height={32} className="w-8 h-8" />
            <span className="text-base font-extrabold text-white">PELIFY</span>
          </a>
          <span className="text-[#aab3c5]" aria-hidden="true">/</span>
          <button type="button" onClick={go(() => onNavigate('booking'))} className="text-sm font-bold text-[#00ffcc] truncate min-h-[44px]" aria-label="Accueil, réserver un live">
            ARENA Live Lomé
          </button>
        </div>

        <nav className="hidden md:flex items-center gap-1" aria-label="Menu principal">
          <a href="/arena/" className={item(false)}>
            <Home className="w-4 h-4" /> Arena
          </a>
          <button type="button" className={item(currentTab === 'booking')} onClick={go(() => onNavigate('booking'))}>
            <Video className="w-4 h-4" /> Réserver
          </button>
          <button
            type="button"
            className={item(currentTab === 'account' || (currentTab === 'regie' && !isAdmin))}
            onClick={go(() => (currentUser ? onNavigate(isAdmin ? 'regie' : 'account') : onOpenAuth()))}
          >
            <User className="w-4 h-4" /> {currentUser ? currentUser.fullName.split(' ')[0] : 'Se connecter'}
          </button>
          {isAdmin && (
            <button type="button" className={item(currentTab === 'regie')} onClick={go(() => onNavigate('regie'))}>
              <LayoutDashboard className="w-4 h-4" /> Réservations du studio
            </button>
          )}
          {currentUser && (
            <button type="button" className={`${item(false)} relative`} onClick={go(onOpenNotifications)}>
              <Bell className="w-4 h-4" /> Messages
              {notificationCount > 0 && <span className="ml-1 bg-[#00ffcc] text-[#050508] text-[11px] px-1.5 tabular-nums">{notificationCount}</span>}
            </button>
          )}
          {currentUser && (
            <button type="button" className={item(false)} onClick={go(onLogout)}>
              <LogOut className="w-4 h-4" /> Déconnexion
            </button>
          )}
        </nav>

        <button
          type="button"
          className="md:hidden p-2 -mr-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
        >
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {open && (
        <nav
          id="mobile-menu"
          className="md:hidden absolute left-0 right-0 top-full bg-[#0d0d14] border-b border-[#2c2c44] shadow-lg px-4 pb-3 max-h-[calc(100vh-56px)] overflow-y-auto"
          aria-label="Menu principal"
        >
          <a href="/arena/" className={item(false)}>
            <Home className="w-4 h-4" /> PELIFY Arena
          </a>
          <button type="button" className={item(currentTab === 'booking')} onClick={go(() => onNavigate('booking'))}>
            <Video className="w-4 h-4" /> Réserver un live
          </button>
          <button
            type="button"
            className={item(currentTab === 'account')}
            onClick={go(() => (currentUser ? onNavigate(isAdmin ? 'regie' : 'account') : onOpenAuth()))}
          >
            <User className="w-4 h-4" /> {currentUser ? 'Mon espace' : 'Se connecter'}
          </button>
          {isAdmin && (
            <button type="button" className={item(currentTab === 'regie')} onClick={go(() => onNavigate('regie'))}>
              <LayoutDashboard className="w-4 h-4" /> Réservations du studio
            </button>
          )}
          {currentUser && (
            <button type="button" className={item(false)} onClick={go(onOpenNotifications)}>
              <Bell className="w-4 h-4" /> Messages envoyés{notificationCount > 0 ? ` (${notificationCount})` : ''}
            </button>
          )}
          {currentUser && (
            <button type="button" className={item(false)} onClick={go(onLogout)}>
              <LogOut className="w-4 h-4" /> Déconnexion
            </button>
          )}
        </nav>
      )}
    </header>
  );
};
