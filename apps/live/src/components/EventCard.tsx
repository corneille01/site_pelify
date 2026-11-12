import React from 'react';
import { Calendar, Users, Gamepad2 } from 'lucide-react';
import { ArenaEventView, EVENT_TYPES, STATUS_LABEL } from '../types';
import { STATUS_STYLE, bannerOf, fmtDate } from '../lib';
import { Link } from './Ui';

export const EventCard: React.FC<{ e: ArenaEventView }> = ({ e }) => {
  const left = Math.max(0, e.maxPlayers - e.taken);
  const type = EVENT_TYPES.find((t) => t.id === e.type)?.label || 'Événement';
  return (
    <article className="group border border-[#2c2c44] bg-[#0d0d14] hover:border-[#00ffcc] transition-colors flex flex-col">
      <Link to={`/e/${e.id}`} aria-label={`Voir ${e.title}`} className="block relative aspect-[16/9] overflow-hidden bg-[#14141f]">
        <img src={bannerOf(e)} alt="" loading="lazy" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition duration-500" />
        <span className={`absolute top-3 left-3 border px-2 py-0.5 text-xs font-bold bg-[#050508]/80 ${STATUS_STYLE[e.status]}`}>{STATUS_LABEL[e.status]}</span>
        <span className="absolute top-3 right-3 border border-[#5b5b7a] px-2 py-0.5 text-xs font-semibold bg-[#050508]/80 text-white">{type}</span>
      </Link>
      <div className="p-4 flex flex-col gap-3 grow">
        <div>
          <h3 className="text-base font-bold text-white leading-snug">
            <Link to={`/e/${e.id}`} className="hover:text-[#00ffcc]">
              {e.title}
            </Link>
          </h3>
          <p className="text-sm text-[#aab3c5] mt-1">
            par {e.ownerPseudo}
          </p>
        </div>
        <ul className="text-sm text-[#dde4f0] space-y-1.5">
          <li className="flex items-center gap-2">
            <Gamepad2 className="w-4 h-4 text-[#00ffcc] shrink-0" aria-hidden="true" /> {e.game} <span className="text-[#aab3c5]">sur {e.platform}</span>
          </li>
          <li className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#00ffcc] shrink-0" aria-hidden="true" /> {fmtDate(e.startsAt)}
          </li>
          <li className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#00ffcc] shrink-0" aria-hidden="true" /> {e.taken} / {e.maxPlayers} inscrits
            {e.status === 'open' && <span className="text-[#aab3c5]">({left} {left > 1 ? 'places' : 'place'})</span>}
          </li>
        </ul>
        <div className="mt-auto pt-1 flex items-center justify-between gap-2">
          <Link to={`/e/${e.id}`} className="text-sm font-bold text-[#00ffcc] hover:underline min-h-[44px] inline-flex items-center">
            Voir l’événement
          </Link>
          {e.mine && e.mine !== 'withdrawn' && <span className="text-xs font-semibold text-[#00ffcc]">Vous participez</span>}
        </div>
      </div>
    </article>
  );
};
