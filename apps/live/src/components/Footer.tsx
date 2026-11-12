import React from 'react';

const LINKS = [
  { href: '/arena/regles/', label: 'Règles de la communauté' },
  { href: '/mentions-legales.html', label: 'Mentions légales' },
  { href: '/politique-de-confidentialite.html', label: 'Confidentialité' },
  { href: '/cookies.html', label: 'Cookies' },
  { href: '/accessibilite.html', label: 'Accessibilité' },
  { href: '/plan-du-site.html', label: 'Plan du site' },
];

export const Footer: React.FC = () => (
  <footer className="mt-16 border-t border-[#2c2c44] bg-[#0d0d14] text-white">
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
      <div className="flex items-center gap-2">
        <img src="/img/logo-mark.svg" alt="" width={28} height={28} className="w-7 h-7" />
        <span className="font-extrabold">PELIFY</span>
        <span className="text-[#00ffcc] font-bold">ARENA</span>
      </div>
      <p className="text-sm text-[#dde4f0] max-w-xl leading-relaxed">
        PELIFY Arena met les joueurs en relation. Aucun paiement, aucun pari. Les parties se jouent et se diffusent sur les plateformes que vous choisissez.
      </p>
      <nav aria-label="Informations légales" className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {LINKS.map((l) => (
          <a key={l.href} href={l.href} className="underline text-[#dde4f0] hover:text-[#00ffcc] min-h-[44px] inline-flex items-center">
            {l.label}
          </a>
        ))}
      </nav>
      <p className="text-xs text-[#aab3c5]">Cette application n’utilise qu’un cookie technique pour garder votre session ouverte. Aucun traceur publicitaire.</p>
    </div>
  </footer>
);
