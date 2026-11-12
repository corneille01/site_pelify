import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Search } from 'lucide-react';
import { ArenaEventView, EVENT_FORMATS, EVENT_TYPES, STATUS_LABEL } from '../types';
import { api, ApiError } from '../utils/api';
import { EventCard } from './EventCard';
import { Alert, Link, btnGhost, btnPrimary, field } from './Ui';

const PAGE = 9;
type Sort = 'start' | 'recent' | 'places';

export const Discover: React.FC = () => {
  const [events, setEvents] = useState<ArenaEventView[] | null>(null);
  const [error, setError] = useState('');
  const initial = new URLSearchParams(window.location.search);
  const [q, setQ] = useState('');
  const [game, setGame] = useState('');
  const [type, setType] = useState(initial.get('type') || '');
  const [status, setStatus] = useState('upcoming');
  const [format, setFormat] = useState('');
  const [seats, setSeats] = useState(false);
  const [sort, setSort] = useState<Sort>('start');
  const [page, setPage] = useState(1);

  const load = () =>
    api.events().then(setEvents, (e) => setError(e instanceof ApiError ? e.message : 'Chargement impossible.'));
  useEffect(() => {
    load();
    const t = setInterval(load, 45_000); // actualisation sans rechargement de la page
    return () => clearInterval(t);
  }, []);
  useEffect(() => setPage(1), [q, game, type, status, format, seats, sort]);

  const games = useMemo(() => [...new Set((events || []).map((e) => e.game))].sort((a, b) => a.localeCompare(b)), [events]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = (events || []).filter((e) => {
      if (needle && !`${e.title} ${e.game} ${e.ownerPseudo}`.toLowerCase().includes(needle)) return false;
      if (game && e.game !== game) return false;
      if (type && e.type !== type) return false;
      if (format && e.format !== format) return false;
      if (seats && !(e.status === 'open' && e.taken < e.maxPlayers)) return false;
      if (status === 'upcoming') return ['open', 'full', 'closed', 'live'].includes(e.status);
      if (status) return e.status === status;
      return true;
    });
    out.sort((a, b) =>
      sort === 'recent' ? (a.createdAt < b.createdAt ? 1 : -1) : sort === 'places' ? b.maxPlayers - b.taken - (a.maxPlayers - a.taken) : a.startsAt < b.startsAt ? -1 : 1,
    );
    return out;
  }, [events, q, game, type, status, format, seats, sort]);

  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const shown = list.slice((page - 1) * PAGE, page * PAGE);
  const reset = () => { setQ(''); setGame(''); setType(''); setStatus('upcoming'); setFormat(''); setSeats(false); setSort('start'); };

  return (
    <>
      <section className="relative overflow-hidden border-b border-[#2c2c44]">
        <img src="/img/photos/arena-joueurs.jpg" alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050508] via-[#050508]/85 to-[#050508]/40" />
        <div className="relative mx-auto max-w-6xl px-4 py-14 md:py-20">
          <p className="text-sm font-bold text-[#00ffcc] mb-3">PELIFY ARENA</p>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white leading-tight max-w-3xl">Trouvez un adversaire. Lancez un défi. Organisez votre tournoi.</h1>
          <p className="mt-4 text-[#dde4f0] max-w-2xl leading-relaxed">
            Un seul endroit pour réunir les joueurs. C’est gratuit, sans pari ni paiement. Les parties se jouent sur votre plateforme et se diffusent sur Twitch, YouTube, Kick ou Discord.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/creer" className={btnPrimary}>
              <Plus className="w-4 h-4" /> Créer un événement
            </Link>
            <a href="#evenements" className={btnGhost}>
              Découvrir les événements
            </a>
          </div>
          {events && (
            <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-3 text-sm">
              <div><dt className="text-[#aab3c5]">Ouverts aux inscriptions</dt><dd className="text-2xl font-extrabold text-[#00ffcc] tabular-nums">{events.filter((e) => e.status === 'open').length}</dd></div>
              <div><dt className="text-[#aab3c5]">En cours</dt><dd className="text-2xl font-extrabold text-[#ff7ab3] tabular-nums">{events.filter((e) => e.status === 'live').length}</dd></div>
              <div><dt className="text-[#aab3c5]">Jeux représentés</dt><dd className="text-2xl font-extrabold text-white tabular-nums">{games.length}</dd></div>
            </dl>
          )}
        </div>
      </section>

      <section id="evenements" className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="text-2xl font-extrabold text-white mb-5">Tous les événements</h2>

        <form className="border border-[#2c2c44] bg-[#0d0d14] p-4 grid gap-3 md:grid-cols-4" role="search" aria-label="Filtrer les événements" onSubmit={(e) => e.preventDefault()}>
          <div className="md:col-span-2 relative">
            <label htmlFor="f-q" className="sr-only">Rechercher</label>
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#aab3c5]" aria-hidden="true" />
            <input id="f-q" className={`${field} pl-9`} placeholder="Titre, jeu ou organisateur" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div>
            <label htmlFor="f-game" className="sr-only">Jeu</label>
            <select id="f-game" className={field} value={game} onChange={(e) => setGame(e.target.value)}>
              <option value="">Tous les jeux</option>
              {games.map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="f-type" className="sr-only">Type</label>
            <select id="f-type" className={field} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Tous les types</option>
              {EVENT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="f-status" className="sr-only">Statut</label>
            <select id="f-status" className={field} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="upcoming">À venir et en cours</option>
              <option value="">Tous les statuts</option>
              {(['open', 'full', 'live', 'finished', 'cancelled'] as const).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="f-format" className="sr-only">Format</label>
            <select id="f-format" className={field} value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="">Tous les formats</option>
              {EVENT_FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="f-sort" className="sr-only">Tri</label>
            <select id="f-sort" className={field} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="start">Date de début</option>
              <option value="recent">Publiés récemment</option>
              <option value="places">Plus de places libres</option>
            </select>
          </div>
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-white cursor-pointer min-h-[44px]">
              <input type="checkbox" checked={seats} onChange={(e) => setSeats(e.target.checked)} className="w-5 h-5 accent-[#00ffcc]" /> Places disponibles
            </label>
            <button type="button" onClick={reset} className="text-sm underline text-[#aab3c5] hover:text-[#00ffcc] min-h-[44px]">Réinitialiser</button>
          </div>
        </form>

        <div className="mt-6" aria-live="polite">
          {error && <Alert>{error}</Alert>}
          {!events && !error && <p className="flex items-center gap-2 text-[#dde4f0]"><Loader2 className="w-4 h-4 animate-spin" /> Chargement des événements…</p>}
          {events && list.length === 0 && (
            <div className="border border-dashed border-[#2c2c44] p-10 text-center">
              <p className="text-lg font-bold text-white">{events.length === 0 ? 'Aucun événement pour le moment.' : 'Aucun événement ne correspond à ces filtres.'}</p>
              <p className="text-[#dde4f0] mt-2">{events.length === 0 ? 'Soyez le premier à lancer un défi ou un tournoi.' : 'Modifiez les filtres ou créez le vôtre.'}</p>
              <div className="mt-5 flex justify-center gap-3 flex-wrap">
                <Link to="/creer" className={btnPrimary}><Plus className="w-4 h-4" /> Créer un événement</Link>
                {events.length > 0 && <button type="button" onClick={reset} className={btnGhost}>Réinitialiser les filtres</button>}
              </div>
            </div>
          )}
          {shown.length > 0 && (
            <>
              <p className="text-sm text-[#aab3c5] mb-3">{list.length} {list.length > 1 ? 'événements' : 'événement'}</p>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{shown.map((e) => <EventCard key={e.id} e={e} />)}</div>
            </>
          )}
        </div>

        {pages > 1 && (
          <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Pagination">
            <button type="button" className={btnGhost} disabled={page <= 1} onClick={() => setPage(page - 1)}>Précédent</button>
            <span className="text-sm text-[#dde4f0] tabular-nums">Page {page} sur {pages}</span>
            <button type="button" className={btnGhost} disabled={page >= pages} onClick={() => setPage(page + 1)}>Suivant</button>
          </nav>
        )}
      </section>
    </>
  );
};
