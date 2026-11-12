import { useEffect, useState } from 'react';
import type { ArenaEventView, EventStatus } from './types';

/* ───────── Routage minimal (History API), compatible avec la base /arena/jouer/ ───────── */
const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
const strip = () => {
  const p = window.location.pathname;
  const rel = p.startsWith(BASE) ? p.slice(BASE.length) : p;
  return rel.replace(/\/$/, '') || '/';
};
export const href = (path: string) => `${BASE}${path === '/' ? '/' : path}`;
export function go(path: string) {
  window.history.pushState({}, '', href(path));
  window.dispatchEvent(new Event('arena-nav'));
  window.scrollTo({ top: 0 });
}
export function usePath(): string {
  const [path, setPath] = useState(strip);
  useEffect(() => {
    const on = () => setPath(strip());
    window.addEventListener('popstate', on);
    window.addEventListener('arena-nav', on);
    return () => {
      window.removeEventListener('popstate', on);
      window.removeEventListener('arena-nav', on);
    };
  }, []);
  return path;
}

/* ───────── Affichage ───────── */
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
export const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export const BANNERS: Record<string, { src: string; label: string }> = {
  esport: { src: '/img/photos/arena-joueurs.jpg', label: 'Joueurs en salle' },
  controllers: { src: '/img/photos/arena-manettes.jpg', label: 'Manettes' },
  laptops: { src: '/img/photos/studio-developpement.jpg', label: 'Ordinateurs' },
  dashboard: { src: '/img/photos/insights-tableau-de-bord.jpg', label: 'Tableaux de bord' },
  grid: { src: '/img/scene-arena.svg', label: 'Illustration PELIFY' },
};
export const bannerOf = (e: Pick<ArenaEventView, 'banner'>) => (BANNERS[e.banner] || BANNERS.esport).src;

export const STATUS_STYLE: Record<EventStatus, string> = {
  open: 'border-[#00ffcc] text-[#00ffcc]',
  full: 'border-[#ff007f] text-[#ff7ab3]',
  closed: 'border-[#5b5b7a] text-[#aab3c5]',
  live: 'border-[#ff007f] text-white bg-[#ff007f]',
  finished: 'border-[#5b5b7a] text-[#aab3c5]',
  cancelled: 'border-[#5b5b7a] text-[#aab3c5] line-through',
};
