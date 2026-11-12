import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ArenaEventView, EVENT_FORMATS, EVENT_TYPES, PLATFORMS } from '../types';
import { api, ApiError, EventInput } from '../utils/api';
import { GAME_SUGGESTIONS } from '../data/games';
import { BANNERS, go, toLocalInput } from '../lib';
import { Alert, btnGhost, btnPrimary, field, label } from './Ui';

interface Props {
  editId?: string;
  loggedIn: boolean;
  onNeedAuth: () => void;
}

const soon = (days: number, hour: number) => {
  const d = new Date(Date.now() + days * 86_400_000);
  d.setHours(hour, 0, 0, 0);
  return toLocalInput(d.toISOString());
};

export const EventForm: React.FC<Props> = ({ editId, loggedIn, onNeedAuth }) => {
  const [f, setF] = useState({
    title: '', game: '', platform: 'PC', type: 'tournoi', format: 'multi', maxPlayers: 8, description: '', rules: '', requireApproval: false,
    startsAt: soon(7, 20), deadline: soon(6, 20), link: '', visibility: 'public', banner: 'esport',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(editId));
  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!editId) return;
    api.event(editId).then(
      ({ event: e }: { event: ArenaEventView }) => {
        setF({
          title: e.title, game: e.game, platform: e.platform, type: e.type, format: e.format, maxPlayers: e.maxPlayers, description: e.description, rules: e.rules,
          requireApproval: e.requireApproval, startsAt: toLocalInput(e.startsAt), deadline: toLocalInput(e.deadline), link: e.link, visibility: e.visibility, banner: e.banner,
        });
        setLoading(false);
      },
      (err) => { setError(err instanceof ApiError ? err.message : 'Chargement impossible.'); setLoading(false); },
    );
  }, [editId]);

  const duel = f.type === 'defi' || f.format === '1v1';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loggedIn) return onNeedAuth();
    setError('');
    setBusy(true);
    try {
      const body: EventInput = { ...f, maxPlayers: duel ? 2 : Number(f.maxPlayers), startsAt: new Date(f.startsAt).toISOString(), deadline: new Date(f.deadline).toISOString() } as EventInput;
      const { event } = editId ? await api.updateEvent(editId, body) : await api.createEvent(body);
      go(`/e/${event.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue. Réessayez.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="mx-auto max-w-3xl px-4 py-10 text-[#dde4f0]">Chargement…</p>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-extrabold text-white">{editId ? 'Modifier l’événement' : 'Créer un événement'}</h1>
      <p className="text-[#dde4f0] mt-2 mb-6">Renseignez l’essentiel. Une adresse à partager est créée dès la publication.</p>
      {!loggedIn && (
        <div className="mb-6"><Alert kind="ok">Vous pouvez remplir le formulaire maintenant. Une connexion sera demandée pour publier.</Alert></div>
      )}
      <form onSubmit={submit} className="space-y-6" noValidate>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={label} htmlFor="e-title">Nom de l’événement</label>
            <input id="e-title" className={field} maxLength={90} value={f.title} onChange={(e) => set('title', e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="e-game">Jeu</label>
            <input id="e-game" className={field} list="games" maxLength={80} value={f.game} onChange={(e) => set('game', e.target.value)} />
            <datalist id="games">{GAME_SUGGESTIONS.map((g) => <option key={g} value={g} />)}</datalist>
          </div>
          <div>
            <label className={label} htmlFor="e-platform">Plateforme de jeu</label>
            <select id="e-platform" className={field} value={f.platform} onChange={(e) => set('platform', e.target.value)}>
              {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="e-type">Type d’événement</label>
            <select id="e-type" className={field} value={f.type} onChange={(e) => set('type', e.target.value)}>
              {EVENT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="e-format">Format</label>
            <select id="e-format" className={field} value={duel ? '1v1' : f.format} disabled={f.type === 'defi'} onChange={(e) => set('format', e.target.value)}>
              {EVENT_FORMATS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="e-max">Nombre maximum de participants</label>
            <input id="e-max" type="number" inputMode="numeric" min={2} max={500} className={field} disabled={duel} value={duel ? 2 : f.maxPlayers} onChange={(e) => set('maxPlayers', e.target.value)} />
            {duel && <p className="text-xs text-[#aab3c5] mt-1">Un duel se joue à deux.</p>}
          </div>
          <div>
            <label className={label} htmlFor="e-vis">Visibilité</label>
            <select id="e-vis" className={field} value={f.visibility} onChange={(e) => set('visibility', e.target.value)}>
              <option value="public">Public, visible dans la liste</option>
              <option value="prive">Privé, accessible uniquement avec le lien</option>
            </select>
          </div>
          <div>
            <label className={label} htmlFor="e-start">Début</label>
            <input id="e-start" type="datetime-local" className={field} value={f.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="e-dead">Date limite d’inscription</label>
            <input id="e-dead" type="datetime-local" className={field} value={f.deadline} onChange={(e) => set('deadline', e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className={label} htmlFor="e-link">Lien de diffusion ou de rencontre <span className="font-normal text-[#aab3c5]">(facultatif)</span></label>
            <input id="e-link" type="url" inputMode="url" className={field} placeholder="https://www.twitch.tv/votre-chaine" value={f.link} onChange={(e) => set('link', e.target.value)} />
            <p className="text-xs text-[#aab3c5] mt-1">Twitch, YouTube, Kick, Discord, TikTok, Facebook, Steam, start.gg ou Challonge, en https.</p>
          </div>
          <div className="md:col-span-2">
            <label className={label} htmlFor="e-desc">Description</label>
            <textarea id="e-desc" rows={4} maxLength={1500} className={field} value={f.description} onChange={(e) => set('description', e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className={label} htmlFor="e-rules">Règles et conditions de participation</label>
            <textarea id="e-rules" rows={4} maxLength={2000} className={field} value={f.rules} onChange={(e) => set('rules', e.target.value)} />
          </div>
        </div>

        <fieldset>
          <legend className={label}>Image de l’événement</legend>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {Object.entries(BANNERS).map(([id, b]) => (
              <label key={id} className={`cursor-pointer border-2 ${f.banner === id ? 'border-[#00ffcc]' : 'border-[#2c2c44] hover:border-[#5b5b7a]'}`}>
                <input type="radio" name="banner" className="sr-only" checked={f.banner === id} onChange={() => set('banner', id)} />
                <img src={b.src} alt={b.label} className="w-full aspect-[4/3] object-cover" />
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex items-start gap-3 text-sm text-[#dde4f0] cursor-pointer">
          <input type="checkbox" className="mt-1 w-5 h-5 accent-[#00ffcc]" checked={f.requireApproval} onChange={(e) => set('requireApproval', e.target.checked)} />
          <span>Je valide moi-même chaque demande de participation.</span>
        </label>

        {error && <Alert>{error}</Alert>}
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={busy} className={btnPrimary}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}{editId ? 'Enregistrer' : 'Publier l’événement'}</button>
          <button type="button" className={btnGhost} onClick={() => window.history.back()}>Annuler</button>
        </div>
      </form>
    </div>
  );
};
