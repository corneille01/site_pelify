import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { STATUS_LABEL } from '../types';
import { AdminOverview, api, ApiError } from '../utils/api';
import { fmtDate } from '../lib';
import { Alert, Link, btnDanger, btnGhost } from './Ui';

export const AdminPanel: React.FC = () => {
  const [d, setD] = useState<AdminOverview | null>(null);
  const [error, setError] = useState('');
  const load = () => api.admin().then(setD, (e) => setError(e instanceof ApiError ? e.message : 'Chargement impossible.'));
  useEffect(() => { load(); }, []);
  const run = (fn: () => Promise<unknown>) => fn().then(load, (e) => setError(e instanceof ApiError ? e.message : 'Action impossible.'));

  if (error && !d) return <div className="mx-auto max-w-3xl px-4 py-10"><Alert>{error}</Alert></div>;
  if (!d) return <p className="mx-auto max-w-3xl px-4 py-10 flex items-center gap-2 text-[#dde4f0]"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</p>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-10">
      <h1 className="text-3xl font-extrabold text-white">Modération</h1>
      {error && <Alert>{error}</Alert>}
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([['Comptes', d.stats.users], ['Événements', d.stats.events], ['Ouverts', d.stats.open], ['Signalements ouverts', d.stats.reports]] as const).map(([k, v]) => (
          <div key={k} className="border border-[#2c2c44] bg-[#0d0d14] p-4"><dt className="text-sm text-[#aab3c5]">{k}</dt><dd className="text-3xl font-extrabold text-[#00ffcc] tabular-nums">{v}</dd></div>
        ))}
      </dl>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">Signalements</h2>
        {d.reports.length === 0 ? <p className="text-[#aab3c5] text-sm">Aucun signalement.</p> : (
          <ul className="space-y-2">
            {d.reports.map((r) => (
              <li key={r.id} className="border border-[#2c2c44] bg-[#0d0d14] p-4 flex flex-wrap items-start justify-between gap-3">
                <div className="text-sm">
                  <p className="font-bold text-white">{r.targetType === 'event' ? <Link to={`/e/${r.targetId}`} className="underline hover:text-[#00ffcc]">{r.targetLabel}</Link> : r.targetLabel}</p>
                  <p className="text-[#dde4f0] mt-1">{r.reason}</p>
                  <p className="text-[#aab3c5] mt-1">Par {r.reporter}, {fmtDate(r.createdAt)}</p>
                </div>
                {r.status === 'open' ? <button type="button" className={btnGhost} onClick={() => run(() => api.resolveReport(r.id))}>Marquer comme traité</button> : <span className="text-xs text-[#aab3c5]">Traité</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">Événements récents</h2>
        <ul className="divide-y divide-[#2c2c44] border border-[#2c2c44] bg-[#0d0d14]">
          {d.events.slice(0, 30).map((e) => (
            <li key={e.id} className="p-3 flex flex-wrap items-center justify-between gap-3 text-sm">
              <span><Link to={`/e/${e.id}`} className="font-bold text-white hover:text-[#00ffcc] underline">{e.title}</Link> <span className="text-[#aab3c5]">par {e.ownerPseudo}, {STATUS_LABEL[e.status]}</span></span>
              {e.status !== 'cancelled' && e.status !== 'finished' && <button type="button" className={btnDanger} onClick={() => window.confirm('Annuler cet événement ?') && run(() => api.cancelEvent(e.id))}>Annuler</button>}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white mb-3">Comptes</h2>
        <ul className="divide-y divide-[#2c2c44] border border-[#2c2c44] bg-[#0d0d14]">
          {d.users.map((u) => (
            <li key={u.id} className="p-3 flex flex-wrap items-center justify-between gap-3 text-sm">
              <span><strong className="text-white">{u.pseudo}</strong> <span className="text-[#aab3c5]">{u.email}{u.verified ? '' : ', non vérifié'}{u.disabled ? ', suspendu' : ''}</span></span>
              <button type="button" className={u.disabled ? btnGhost : btnDanger} onClick={() => run(() => api.setUserDisabled(u.id, !u.disabled))}>{u.disabled ? 'Réactiver' : 'Suspendre'}</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};
