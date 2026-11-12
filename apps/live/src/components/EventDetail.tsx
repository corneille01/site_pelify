import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, Check, Clock, ExternalLink, Flag, Link2, Loader2, Users } from 'lucide-react';
import { ArenaEventView, EVENT_FORMATS, EVENT_TYPES, PART_LABEL, Participant, STATUS_LABEL } from '../types';
import { api, ApiError } from '../utils/api';
import { STATUS_STYLE, bannerOf, fmtDate } from '../lib';
import { Alert, Link, Modal, btnDanger, btnGhost, btnPrimary, field, label } from './Ui';

interface Props {
  id: string;
  loggedIn: boolean;
  onNeedAuth: () => void;
}

export const EventDetail: React.FC<Props> = ({ id, loggedIn, onNeedAuth }) => {
  const [data, setData] = useState<{ event: ArenaEventView; participants: Participant[] } | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(false);
  const [reason, setReason] = useState('');
  const [finish, setFinish] = useState(false);
  const [result, setResult] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => api.event(id).then(setData, (e) => setError(e instanceof ApiError ? e.message : 'Événement introuvable.')), [id]);
  useEffect(() => { setData(null); setError(''); load(); }, [load, loggedIn]);

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    setError(''); setMsg(''); setBusy(true);
    try { await fn(); if (ok) setMsg(ok); await load(); } catch (e) { setError(e instanceof ApiError ? e.message : 'Une erreur est survenue. Réessayez.'); } finally { setBusy(false); }
  };

  if (error && !data) return <div className="mx-auto max-w-3xl px-4 py-16 text-center space-y-4"><h1 className="text-2xl font-extrabold text-white">Événement introuvable</h1><p className="text-[#dde4f0]">{error}</p><Link to="/" className={btnPrimary}>Voir tous les événements</Link></div>;
  if (!data) return <p className="mx-auto max-w-3xl px-4 py-10 text-[#dde4f0] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</p>;

  const { event: e, participants } = data;
  const left = Math.max(0, e.maxPlayers - e.taken);
  const type = EVENT_TYPES.find((t) => t.id === e.type)?.label;
  const format = EVENT_FORMATS.find((t) => t.id === e.format)?.label;
  const joined = e.mine === 'accepted' || e.mine === 'pending';
  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}`;
    try {
      if (navigator.share) await navigator.share({ title: e.title, url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } catch { /* partage annulé */ }
  };

  return (
    <article className="mx-auto max-w-5xl px-4 py-8">
      <nav aria-label="Fil d’Ariane" className="text-sm text-[#aab3c5] mb-4"><Link to="/" className="hover:text-[#00ffcc] underline">Événements</Link> / <span className="text-white">{e.title}</span></nav>

      <div className="relative h-[260px] md:h-auto md:aspect-[21/9] overflow-hidden border border-[#2c2c44] bg-[#0d0d14]">
        <img src={bannerOf(e)} alt="" className="w-full h-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050508] via-transparent" />
        <div className="absolute bottom-0 p-5 md:p-8">
          <div className="flex flex-wrap gap-2 mb-3">
            <span className={`border px-2 py-0.5 text-xs font-bold bg-[#050508]/80 ${STATUS_STYLE[e.status]}`}>{STATUS_LABEL[e.status]}</span>
            <span className="border border-[#5b5b7a] px-2 py-0.5 text-xs font-semibold bg-[#050508]/80 text-white">{type}</span>
            {e.visibility === 'prive' && <span className="border border-[#5b5b7a] px-2 py-0.5 text-xs font-semibold bg-[#050508]/80 text-white">Privé</span>}
          </div>
          <h1 className="text-2xl md:text-4xl font-extrabold text-white">{e.title}</h1>
          <p className="text-[#dde4f0] mt-1">{e.game} sur {e.platform}, organisé par {e.ownerPseudo}</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3 mt-8">
        <div className="lg:col-span-2 space-y-8">
          {e.description && <section><h2 className="text-xl font-bold text-white mb-2">À propos</h2><p className="text-[#dde4f0] leading-relaxed whitespace-pre-line">{e.description}</p></section>}
          {e.rules && <section><h2 className="text-xl font-bold text-white mb-2">Règles</h2><p className="text-[#dde4f0] leading-relaxed whitespace-pre-line">{e.rules}</p></section>}
          {e.result && <section><h2 className="text-xl font-bold text-white mb-2">Résultat</h2><p className="text-[#00ffcc] font-semibold">{e.result}</p></section>}
          <section>
            <h2 className="text-xl font-bold text-white mb-3">Participants ({e.taken} / {e.maxPlayers})</h2>
            {participants.length === 0 ? <p className="text-[#dde4f0]">Personne n’est encore inscrit.</p> : (
              <ul className="grid sm:grid-cols-2 gap-2">
                {participants.map((p, i) => (
                  <li key={(p.userId || p.pseudo) + i} className="border border-[#2c2c44] bg-[#0d0d14] px-3 py-2 flex items-center justify-between gap-2 text-sm">
                    <span className="font-semibold text-white truncate">{p.pseudo}</span>
                    {e.isOwner || p.status !== 'accepted' ? <span className="text-xs text-[#aab3c5]">{PART_LABEL[p.status]}</span> : <Check className="w-4 h-4 text-[#00ffcc]" aria-label="Accepté" />}
                    {e.isOwner && p.userId && p.status === 'pending' && (
                      <span className="flex gap-1">
                        <button type="button" disabled={busy} className="text-xs font-bold text-[#00ffcc] underline min-h-[32px]" onClick={() => act(() => api.decide(e.id, p.userId!, 'accept'))}>Accepter</button>
                        <button type="button" disabled={busy} className="text-xs font-bold text-[#ff7ab3] underline min-h-[32px]" onClick={() => act(() => api.decide(e.id, p.userId!, 'refuse'))}>Refuser</button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <div className="border border-[#2c2c44] bg-[#0d0d14] p-5 space-y-4">
            <ul className="text-sm text-[#dde4f0] space-y-3">
              <li className="flex gap-3"><Calendar className="w-4 h-4 mt-0.5 text-[#00ffcc] shrink-0" aria-hidden="true" /><span><strong className="text-white">Début</strong><br />{fmtDate(e.startsAt)}</span></li>
              <li className="flex gap-3"><Clock className="w-4 h-4 mt-0.5 text-[#00ffcc] shrink-0" aria-hidden="true" /><span><strong className="text-white">Inscriptions jusqu’au</strong><br />{fmtDate(e.deadline)}</span></li>
              <li className="flex gap-3"><Users className="w-4 h-4 mt-0.5 text-[#00ffcc] shrink-0" aria-hidden="true" /><span><strong className="text-white">{format}</strong><br />{e.status === 'open' ? `${left} ${left > 1 ? 'places restantes' : 'place restante'}` : `${e.taken} sur ${e.maxPlayers} places prises`}</span></li>
            </ul>

            {msg && <Alert kind="ok">{msg}</Alert>}
            {error && <Alert>{error}</Alert>}

            {e.isOwner ? (
              <div className="space-y-2">
                <p className="text-xs font-bold text-[#00ffcc]">Vous organisez cet événement</p>
                {e.status !== 'cancelled' && e.status !== 'finished' && (
                  <>
                    <Link to={`/modifier/${e.id}`} className={`${btnGhost} w-full`}>Modifier</Link>
                    {(e.status === 'live' || e.status === 'closed' || e.status === 'full') && <button type="button" className={`${btnPrimary} w-full`} onClick={() => setFinish(true)}>Clôturer avec le résultat</button>}
                    <button type="button" disabled={busy} className={`${btnDanger} w-full`} onClick={() => window.confirm('Annuler cet événement ? Les participants seront prévenus.') && act(() => api.cancelEvent(e.id), 'Événement annulé.')}>Annuler l’événement</button>
                  </>
                )}
              </div>
            ) : joined ? (
              <div className="space-y-2">
                <p className="text-sm font-bold text-[#00ffcc]">{e.mine === 'pending' ? 'Demande envoyée, en attente de validation.' : 'Vous êtes inscrit.'}</p>
                {e.status !== 'live' && e.status !== 'finished' && e.status !== 'cancelled' && (
                  <button type="button" disabled={busy} className={`${btnGhost} w-full`} onClick={() => act(() => api.leave(e.id), 'Participation annulée.')}>Me désister</button>
                )}
              </div>
            ) : e.status === 'open' ? (
              <button type="button" disabled={busy} className={`${btnPrimary} w-full`} onClick={() => (loggedIn ? act(() => api.join(e.id).then((r) => setMsg(r.status === 'pending' ? 'Demande envoyée. L’organisateur doit la valider.' : 'Vous êtes inscrit.'))) : onNeedAuth())}>
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}{e.type === 'defi' ? 'Accepter le défi' : e.requireApproval ? 'Demander à participer' : 'Rejoindre'}
              </button>
            ) : (
              <p className="text-sm text-[#aab3c5]">{e.status === 'full' ? 'Cet événement est complet.' : e.status === 'closed' ? 'Les inscriptions sont closes.' : e.status === 'cancelled' ? 'Cet événement est annulé.' : 'Cet événement a commencé.'}</p>
            )}

            {e.link && (joined || e.isOwner || e.status === 'live') && e.status !== 'cancelled' && (
              <a href={e.link} target="_blank" rel="noopener noreferrer nofollow ugc" className={`${btnGhost} w-full`}>
                <ExternalLink className="w-4 h-4" /> Ouvrir le lien externe
              </a>
            )}
            {e.link && !(joined || e.isOwner || e.status === 'live') && <p className="text-xs text-[#aab3c5]">Le lien de diffusion apparaît après votre inscription. Il s’ouvre sur un site externe, avec ses propres cookies.</p>}
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnGhost} onClick={share}><Link2 className="w-4 h-4" /> {copied ? 'Lien copié' : 'Partager'}</button>
            {!e.isOwner && <button type="button" className={btnGhost} onClick={() => (loggedIn ? setReport(true) : onNeedAuth())}><Flag className="w-4 h-4" /> Signaler</button>}
          </div>
        </aside>
      </div>

      {report && (
        <Modal title="Signaler cet événement" onClose={() => setReport(false)}>
          <label className={label} htmlFor="r-reason">Que s’est-il passé ?</label>
          <textarea id="r-reason" rows={4} maxLength={500} className={field} value={reason} onChange={(ev) => setReason(ev.target.value)} />
          <button type="button" className={`${btnPrimary} w-full`} disabled={reason.trim().length < 5} onClick={() => api.report('event', e.id, reason).then(() => { setReport(false); setReason(''); setMsg('Merci, le signalement est transmis à la modération.'); }, (er) => setError(er instanceof ApiError ? er.message : 'Envoi impossible.'))}>Envoyer</button>
        </Modal>
      )}
      {finish && (
        <Modal title="Clôturer l’événement" onClose={() => setFinish(false)}>
          <label className={label} htmlFor="r-res">Résultat (facultatif)</label>
          <input id="r-res" className={field} maxLength={300} value={result} onChange={(ev) => setResult(ev.target.value)} placeholder="Victoire de Joueur1, 3 à 1" />
          <button type="button" className={`${btnPrimary} w-full`} onClick={() => { setFinish(false); act(() => api.finishEvent(e.id, result), 'Événement clôturé.'); }}>Clôturer</button>
        </Modal>
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'Event', name: e.title, startDate: e.startsAt, eventStatus: e.status === 'cancelled' ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode', location: { '@type': 'VirtualLocation', url: window.location.href }, organizer: { '@type': 'Person', name: e.ownerPseudo }, isAccessibleForFree: true }).replace(/</g, '\\u003c') }} />
    </article>
  );
};
