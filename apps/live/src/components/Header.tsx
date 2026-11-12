import React, { useEffect, useState } from 'react';
import { Bell, LogOut, Menu, Plus, ShieldCheck, User, X, Trophy, Swords } from 'lucide-react';
import type { UserAccount } from '../types';
import { Link, btnPrimary } from './Ui';

interface Props {
  path: string;
  user: UserAccount | null;
  unread: number;
  onOpenAuth: () => void;
  onLogout: () => void;
  onOpenNotifications: () => void;
}

export const Header: React.FC<Props> = ({ path, user, unread, onOpenAuth, onLogout, onOpenNotifications }) => {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const item = (active: boolean) =>
    `flex items-center gap-2 px-3 py-3 md:py-2 text-sm font-semibold min-h-[44px] w-full md:w-auto text-left border-b-2 ${
      active ? 'border-[#00ffcc] text-[#00ffcc]' : 'border-transparent text-white hover:text-[#00ffcc]'
    }`;

  return (
    <header className="bg-[#0d0d14] border-b border-[#2c2c44] sticky top-0 z-40">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <a href="/" className="flex items-center gap-2 shrink-0" aria-label="PELIFY, tous les univers">
            <img src="/img/logo-mark.svg" alt="" width={32} height={32} className="w-8 h-8" />
            <span className="text-base font-extrabold text-white">PELIFY</span>
          </a>
          <span className="text-[#aab3c5]" aria-hidden="true">/</span>
          <a href="/arena/" className="text-sm font-bold text-[#00ffcc] truncate min-h-[44px] inline-flex items-center">
            ARENA
          </a>
        </div>

        <nav className="hidden md:flex items-center gap-1" aria-label="Menu principal">
          <Link to="/" className={item(path === '/')}>
            <Swords className="w-4 h-4" /> Événements
          </Link>
          <Link to="/?type=defi" className={item(false)}>
            <Trophy className="w-4 h-4" /> Défis
          </Link>
          {user ? (
            <>
              <Link to="/mon-espace" className={item(path === '/mon-espace')}>
                <User className="w-4 h-4" /> {user.pseudo}
              </Link>
              {user.role === 'admin' && (
                <Link to="/admin" className={item(path === '/admin')}>
                  <ShieldCheck className="w-4 h-4" /> Modération
                </Link>
              )}
              <button type="button" className={`${item(false)} relative`} onClick={onOpenNotifications} aria-label={`Notifications${unread ? `, ${unread} non lues` : ''}`}>
                <Bell className="w-4 h-4" />
                {unread > 0 && <span className="bg-[#ff007f] text-white text-[11px] px-1.5 tabular-nums font-bold">{unread}</span>}
              </button>
              <button type="button" className={item(false)} onClick={onLogout}>
                <LogOut className="w-4 h-4" /> Déconnexion
              </button>
            </>
          ) : (
            <button type="button" className={item(false)} onClick={onOpenAuth}>
              <User className="w-4 h-4" /> Se connecter
            </button>
          )}
          <Link to="/creer" className={`${btnPrimary} ml-2`}>
            <Plus className="w-4 h-4" /> Créer un événement
          </Link>
        </nav>

        <div className="md:hidden flex items-center">
          {user && (
            <button type="button" onClick={onOpenNotifications} className="relative p-2 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label={`Notifications${unread ? `, ${unread} non lues` : ''}`}>
              <Bell className="w-5 h-5" />
              {unread > 0 && <span className="absolute top-1 right-0 bg-[#ff007f] text-white text-[10px] px-1 font-bold tabular-nums">{unread}</span>}
            </button>
          )}
          <button
            type="button"
            className="p-2 -mr-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
          >
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-menu" className="md:hidden absolute left-0 right-0 top-full bg-[#0d0d14] border-b border-[#2c2c44] px-4 pb-3 max-h-[calc(100vh-56px)] overflow-y-auto" aria-label="Menu principal">
          <Link to="/" className={item(path === '/')}>
            <Swords className="w-4 h-4" /> Événements
          </Link>
          <Link to="/?type=defi" className={item(false)}>
            <Trophy className="w-4 h-4" /> Défis
          </Link>
          <Link to="/creer" className={item(path === '/creer')}>
            <Plus className="w-4 h-4" /> Créer un événement
          </Link>
          {user ? (
            <>
              <Link to="/mon-espace" className={item(path === '/mon-espace')}>
                <User className="w-4 h-4" /> Mon espace
              </Link>
              {user.role === 'admin' && (
                <Link to="/admin" className={item(path === '/admin')}>
                  <ShieldCheck className="w-4 h-4" /> Modération
                </Link>
              )}
              <button type="button" className={item(false)} onClick={onLogout}>
                <LogOut className="w-4 h-4" /> Déconnexion
              </button>
            </>
          ) : (
            <button type="button" className={item(false)} onClick={onOpenAuth}>
              <User className="w-4 h-4" /> Se connecter
            </button>
          )}
        </nav>
      )}
    </header>
  );
};
