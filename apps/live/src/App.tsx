import React, { useCallback, useEffect, useState } from 'react';
import type { AppNotification, UserAccount } from './types';
import { api, ServerConfig } from './utils/api';
import { go, usePath } from './lib';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { AuthModal } from './components/AuthModal';
import { Discover } from './components/Discover';
import { EventDetail } from './components/EventDetail';
import { EventForm } from './components/EventForm';
import { Dashboard } from './components/Dashboard';
import { AdminPanel } from './components/AdminPanel';
import { NotificationsPanel } from './components/NotificationsPanel';
import { Link, btnPrimary } from './components/Ui';

export default function App() {
  const path = usePath();
  const [user, setUser] = useState<UserAccount | null>(null);
  const [ready, setReady] = useState(false);
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [auth, setAuth] = useState<false | 'login' | 'register'>(false);
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);

  useEffect(() => {
    api.me().then((r) => setUser(r.user), () => setUser(null)).finally(() => setReady(true));
    api.config().then(setConfig, () => setConfig(null));
  }, []);

  const loadNotifs = useCallback(() => api.notifications().then(setNotifs, () => undefined), []);
  useEffect(() => {
    if (!user) { setNotifs([]); return; }
    loadNotifs();
    const t = setInterval(loadNotifs, 30_000); // la cloche se met à jour sans recharger la page
    return () => clearInterval(t);
  }, [user, loadNotifs]);

  const read = (id?: string) => {
    setNotifs((l) => l.map((n) => (!id || n.id === id ? { ...n, read: true } : n)));
    api.markRead(id).catch(() => undefined);
  };
  const logout = async () => { await api.logout().catch(() => undefined); setUser(null); go('/'); };
  const needAuth = () => setAuth('login');

  const page = () => {
    const evt = path.match(/^\/e\/([A-Za-z0-9-]+)$/);
    const edit = path.match(/^\/modifier\/([A-Za-z0-9-]+)$/);
    if (path === '/') return <Discover />;
    if (evt) return <EventDetail id={evt[1]} loggedIn={Boolean(user)} onNeedAuth={needAuth} />;
    if (path === '/creer') return <EventForm loggedIn={Boolean(user)} onNeedAuth={needAuth} />;
    if (edit) return user ? <EventForm editId={edit[1]} loggedIn onNeedAuth={needAuth} /> : <Gate onAuth={needAuth} />;
    if (path === '/mon-espace') return user ? <Dashboard user={user} onUser={setUser} onDeleted={() => { setUser(null); go('/'); }} /> : <Gate onAuth={needAuth} />;
    if (path === '/admin') return user?.role === 'admin' ? <AdminPanel /> : <Gate onAuth={needAuth} />;
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center space-y-4">
        <h1 className="text-3xl font-extrabold text-white">Page introuvable</h1>
        <Link to="/" className={btnPrimary}>Retour aux événements</Link>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] bg-[#00ffcc] text-[#050508] px-4 py-2 font-bold">Aller au contenu</a>
      <Header path={path} user={user} unread={notifs.filter((n) => !n.read).length} onOpenAuth={() => setAuth('login')} onLogout={logout} onOpenNotifications={() => setShowNotifs(true)} />
      <main id="contenu" className="grow">{ready ? page() : null}</main>
      <Footer />
      {auth && <AuthModal initialView={auth} config={config} onAuthenticated={(u) => { setUser(u); setAuth(false); }} onClose={() => setAuth(false)} />}
      {showNotifs && <NotificationsPanel list={notifs} onClose={() => setShowNotifs(false)} onRead={read} />}
    </div>
  );
}

const Gate: React.FC<{ onAuth: () => void }> = ({ onAuth }) => (
  <div className="mx-auto max-w-xl px-4 py-20 text-center space-y-4">
    <h1 className="text-3xl font-extrabold text-white">Connexion requise</h1>
    <p className="text-[#dde4f0]">Connectez-vous pour accéder à cette page.</p>
    <button type="button" className={btnPrimary} onClick={onAuth}>Se connecter</button>
  </div>
);
