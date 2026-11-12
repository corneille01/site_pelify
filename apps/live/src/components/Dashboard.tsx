import React, { useEffect, useState } from 'react';
import { Download, Loader2, Trash2 } from 'lucide-react';
import { ArenaEventView, PART_LABEL, UserAccount } from '../types';
import { api, ApiError } from '../utils/api';
import { GAME_SUGGESTIONS } from '../data/games';
import { EventCard } from './EventCard';
import { Alert, Link, btnDanger, btnGhost, btnPrimary, field, label } from './Ui';

type Tab = 'created' | 'joined' | 'settings';
const upcoming = (e: ArenaEventView) => ['open', 'full', 'closed', 'live'].includes(e.status);

export const Dashboard: React.FC<{ user: UserAccount; onUser: (u: UserAccount) => void; onDeleted: () => void }> = ({ user, onUser, onDeleted }) => {
  const [tab, setTab] = useState<Tab>('created');
  const [data, setData] = useState<{ created: ArenaEventView[]; joined: ArenaEventView[] } | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [pseudo, setPseudo] = useState(user.pseudo);
  const [games, setGames] = useState(user.games.join(', '));
  const [mails, setMails] = useState(user.emailNotifications);
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [delPwd, setDelPwd] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.myEvents().then(setData, (e) => setError(e instanceof ApiError ? e.message : 'Chargement impossible.')); }, []);
  const run = async (fn: () => Promise<void>, ok: string) => {
    setError(''); setMsg(''); setBusy(true);
    try { await fn(); setMsg(ok); } catch (e) { setError(e instanceof ApiError ? e.message : 'Une erreur est survenue.'); } finally { setBusy(false); }
  };

  const exportData = () => run(async () => {
    const blob = new Blob([JSON.stringify(await api.exportMe(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mes-donnees-pelify-arena.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }, 'Export téléchargé.');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'created', label: `Mes événements${data ? ` (${data.created.length})` : ''}` },
    { id: 'joined', label: `Mes participations${data ? ` (${data.joined.filter((e) => e.mine !== 'withdrawn').length})` : ''}` },
    { id: 'settings', label: 'Paramètres' },
  ];

  const group = (list: ArenaEventView[], title: string, empty: string) => (
    <section className="space-y-3">
      <h3 className="text-lg font-bold text-white">{title}</h3>
      {list.length === 0 ? <p className="text-[#aab3c5] text-sm">{empty}</p> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{list.map((e) => <div key={e.id}><EventCard e={e} />{e.mine && <p className="text-xs text-[#aab3c5] mt-1">Statut : {PART_LABEL[e.mine]}</p>}</div>)}</div>}
    </section>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-extrabold text-white">Mon espace</h1>
      <p className="text-[#dde4f0] mt-1 mb-6">Connecté en tant que <strong className="text-[#00ffcc]">{user.pseudo}</strong>.</p>
      <div role="tablist" aria-label="Sections" className="flex flex-wrap gap-1 border-b border-[#2c2c44] mb-6">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} type="button" onClick={() => setTab(t.id)} className={`px-4 py-3 text-sm font-semibold min-h-[44px] border-b-2 ${tab === t.id ? 'border-[#00ffcc] text-[#00ffcc]' : 'border-transparent text-white hover:text-[#00ffcc]'}`}>{t.label}</button>
        ))}
      </div>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      {msg && <div className="mb-4"><Alert kind="ok">{msg}</Alert></div>}
      {!data && tab !== 'settings' && !error && <p className="flex items-center gap-2 text-[#dde4f0]"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</p>}

      {data && tab === 'created' && (
        <div className="space-y-8">
          <Link to="/creer" className={btnPrimary}>Créer un événement</Link>
          {group(data.created.filter(upcoming), 'À venir', 'Aucun événement à venir. Créez le premier.')}
          {group(data.created.filter((e) => !upcoming(e)), 'Terminés ou annulés', 'Rien pour le moment.')}
        </div>
      )}
      {data && tab === 'joined' && (
        <div className="space-y-8">
          {group(data.joined.filter((e) => e.mine !== 'withdrawn' && upcoming(e)), 'À venir', 'Vous ne participez à aucun événement à venir.')}
          {group(data.joined.filter((e) => e.mine !== 'withdrawn' && !upcoming(e)), 'Terminés ou annulés', 'Rien pour le moment.')}
        </div>
      )}

      {tab === 'settings' && (
        <div className="grid gap-10 lg:grid-cols-2">
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await api.updateMe({ pseudo, games: games.split(',').map((g) => g.trim()).filter(Boolean), emailNotifications: mails }); onUser(r.user); }, 'Profil enregistré.'); }}>
            <h2 className="text-xl font-bold text-white">Profil gaming</h2>
            <div><label className={label} htmlFor="s-pseudo">Pseudonyme</label><input id="s-pseudo" className={field} maxLength={24} value={pseudo} onChange={(e) => setPseudo(e.target.value)} /></div>
            <div>
              <label className={label} htmlFor="s-games">Jeux auxquels je joue <span className="font-normal text-[#aab3c5]">(séparés par une virgule)</span></label>
              <input id="s-games" className={field} list="s-games-list" value={games} onChange={(e) => setGames(e.target.value)} />
              <datalist id="s-games-list">{GAME_SUGGESTIONS.map((g) => <option key={g} value={g} />)}</datalist>
            </div>
            <label className="flex items-start gap-3 text-sm text-[#dde4f0] cursor-pointer"><input type="checkbox" className="mt-1 w-5 h-5 accent-[#00ffcc]" checked={mails} onChange={(e) => setMails(e.target.checked)} /><span>Recevoir mes notifications par e-mail, en plus de la cloche.</span></label>
            <button type="submit" disabled={busy} className={btnPrimary}>Enregistrer</button>
          </form>

          <div className="space-y-8">
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(async () => { await api.changePassword(cur, next); setCur(''); setNext(''); }, 'Mot de passe modifié.'); }}>
              <h2 className="text-xl font-bold text-white">Mot de passe</h2>
              <div><label className={label} htmlFor="s-cur">Mot de passe actuel</label><input id="s-cur" type="password" autoComplete="current-password" className={field} value={cur} onChange={(e) => setCur(e.target.value)} /></div>
              <div><label className={label} htmlFor="s-new">Nouveau (8 caractères minimum)</label><input id="s-new" type="password" autoComplete="new-password" className={field} value={next} onChange={(e) => setNext(e.target.value)} /></div>
              <button type="submit" disabled={busy || !cur || next.length < 8} className={btnGhost}>Changer le mot de passe</button>
            </form>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">Mes données</h2>
              <p className="text-sm text-[#dde4f0]">Vous pouvez récupérer vos données ou supprimer votre compte. Vos événements à venir sont alors annulés et les participants prévenus.</p>
              <button type="button" className={btnGhost} onClick={exportData}><Download className="w-4 h-4" /> Télécharger mes données</button>
              <div className="border border-[#ff007f]/50 p-4 space-y-3">
                <label className={label} htmlFor="s-del">Supprimer mon compte, confirmez avec votre mot de passe</label>
                <input id="s-del" type="password" autoComplete="current-password" className={field} value={delPwd} onChange={(e) => setDelPwd(e.target.value)} />
                <button type="button" disabled={busy || !delPwd} className={btnDanger} onClick={() => window.confirm('Supprimer définitivement votre compte ?') && run(async () => { await api.deleteMe(delPwd); onDeleted(); }, 'Compte supprimé.')}><Trash2 className="w-4 h-4" /> Supprimer mon compte</button>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
};
