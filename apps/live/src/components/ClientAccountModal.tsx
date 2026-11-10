import React, { useEffect, useRef, useState } from 'react';
import { X, Mail, Smartphone, MessageCircle, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import type { UserAccount } from '../types';
import { api, ApiError, Channel, Challenge, ServerConfig } from '../utils/api';
import { COUNTRY_CODES } from '../data/sectors';

export type AuthView = 'login' | 'register' | 'recover';

export interface AuthPrefill {
  fullName?: string;
  businessName?: string;
  email?: string;
  phone?: string;
  countryCode?: string;
  sector?: string;
  country?: string;
  onScreenPhone?: string;
}

interface Props {
  initialView?: AuthView;
  prefill?: AuthPrefill;
  config: ServerConfig | null;
  onAuthenticated: (user: UserAccount) => void;
  onClose: () => void;
}

const CHANNELS: { id: Channel; label: string; icon: React.ReactNode }[] = [
  { id: 'email', label: 'E-mail', icon: <Mail className="w-4 h-4" /> },
  { id: 'sms', label: 'SMS', icon: <Smartphone className="w-4 h-4" /> },
  { id: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle className="w-4 h-4" /> },
];

const field =
  'w-full border border-[#2c2c44] bg-[#0d0d14] px-3 py-3 text-base text-white focus:outline-none focus:border-[#00ffcc] focus:ring-2 focus:ring-[#00ffcc]/30 min-h-[48px]';
const label = 'block text-sm font-semibold text-white mb-1';
const primary =
  'w-full inline-flex items-center justify-center gap-2 bg-[#00ffcc] hover:bg-[#00d9ad] disabled:bg-[#aab3c5] text-[#050508] font-bold px-5 py-3 text-base min-h-[48px]';

export const ClientAccountModal: React.FC<Props> = ({ initialView = 'login', prefill, config, onAuthenticated, onClose }) => {
  const [view, setView] = useState<AuthView>(initialView);
  const [stage, setStage] = useState<'form' | 'code' | 'reset'>('form');
  const [channel, setChannel] = useState<Channel>('email');
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [resetToken, setResetToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [showPwd, setShowPwd] = useState(false);

  const [identifier, setIdentifier] = useState(prefill?.email || '');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState(prefill?.fullName || '');
  const [businessName, setBusinessName] = useState(prefill?.businessName || '');
  const [email, setEmail] = useState(prefill?.email || '');
  const [phone, setPhone] = useState(prefill?.phone || '');
  const [countryCode, setCountryCode] = useState(prefill?.countryCode || '+228');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const dialogRef = useRef<HTMLDivElement>(null);
  const available = (c: Channel) => !config || config.demo || config.channels[c];

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector<HTMLElement>('input')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    // Premier canal disponible si celui par défaut ne l'est pas.
    if (!available(channel)) setChannel((CHANNELS.find((c) => available(c.id)) || CHANNELS[0]).id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const fail = (e: unknown) => setError(e instanceof ApiError ? e.message : 'Une erreur est survenue. Réessayez.');

  const run = async (fn: () => Promise<void>) => {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const gotChallenge = (c: Challenge) => {
    setChallenge(c);
    setStage('code');
    setCode('');
    setCooldown(30);
    setNotice(`Nous venons d'envoyer un code à 6 chiffres à ${c.destination}.`);
  };

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (view === 'login') {
        if (!identifier.trim() || !password) throw new ApiError('Saisissez votre e-mail ou numéro et votre mot de passe.', 0);
        gotChallenge(await api.login(identifier.trim(), password, channel));
      } else if (view === 'register') {
        gotChallenge(
          await api.register({
            fullName: fullName.trim(),
            businessName: businessName.trim(),
            email: email.trim(),
            phone: phone.trim(),
            countryCode,
            password,
            channel,
            sector: prefill?.sector,
            country: prefill?.country,
            onScreenPhone: prefill?.onScreenPhone,
          }),
        );
      } else {
        if (!identifier.trim()) throw new ApiError('Saisissez votre e-mail ou votre numéro.', 0);
        gotChallenge(await api.recover(identifier.trim(), channel));
      }
    });
  };

  const submitCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!challenge) return;
    run(async () => {
      if (!/^\d{6}$/.test(code.trim())) throw new ApiError('Le code compte 6 chiffres.', 0);
      const res = await api.verify(challenge.challenge, code.trim());
      if (res.resetToken) {
        setResetToken(res.resetToken);
        setStage('reset');
      } else if (res.user) {
        onAuthenticated(res.user);
      }
    });
  };

  const resend = (next: Channel) =>
    run(async () => {
      if (!challenge) return;
      setChannel(next);
      gotChallenge(await api.resend(challenge.challenge, next));
    });

  const submitReset = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api.reset(resetToken, newPassword);
      setView('login');
      setStage('form');
      setPassword('');
      setNewPassword('');
      setNotice('Mot de passe modifié. Connectez-vous avec le nouveau.');
    });
  };

  const switchView = (v: AuthView) => {
    setView(v);
    setStage('form');
    setError('');
    setNotice('');
  };

  const title =
    stage === 'code'
      ? 'Saisissez votre code'
      : stage === 'reset'
        ? 'Nouveau mot de passe'
        : view === 'login'
          ? 'Se connecter'
          : view === 'register'
            ? 'Créer mon compte'
            : 'Mot de passe oublié';

  const ChannelPicker = ({ current, onPick }: { current: Channel; onPick: (c: Channel) => void }) => (
    <fieldset>
      <legend className={label}>Recevoir mon code par</legend>
      <div className="grid grid-cols-3 gap-2">
        {CHANNELS.map((c) => (
          <label
            key={c.id}
            className={`flex flex-col items-center justify-center gap-1 border-2 px-2 py-2 text-sm font-semibold min-h-[56px] ${
              !available(c.id)
                ? 'opacity-40 cursor-not-allowed border-[#2c2c44]'
                : current === c.id
                  ? 'border-[#00ffcc] bg-[rgba(0,255,204,0.08)] text-[#00ffcc] cursor-pointer'
                  : 'border-[#2c2c44] cursor-pointer hover:border-[#00ffcc]'
            }`}
          >
            <input type="radio" name="channel" className="sr-only" disabled={!available(c.id)} checked={current === c.id} onChange={() => onPick(c.id)} />
            {c.icon}
            <span>{c.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/60 flex items-stretch sm:items-center justify-center"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-[#0d0d14] w-full sm:max-w-md max-h-full overflow-y-auto border border-[#2c2c44]"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2c2c44] sticky top-0 bg-[#0d0d14]">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="p-2 -mr-2 hover:bg-[#14141f] min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {notice && (
            <p role="status" className="text-sm border border-[#2c2c44] bg-[#0d0d14] p-3 text-white">
              {notice}
            </p>
          )}
          {error && (
            <div role="alert" className="flex items-start gap-2 border border-[#ff007f] bg-[rgba(255,0,127,0.12)] text-[#ff7ab3] text-sm p-3">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {stage === 'form' && (
            <form onSubmit={submitForm} className="space-y-4" noValidate>
              {view === 'register' ? (
                <>
                  <div>
                    <label className={label} htmlFor="a-name">
                      Nom et prénom
                    </label>
                    <input id="a-name" className={field} autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  </div>
                  <div>
                    <label className={label} htmlFor="a-biz">
                      Nom de votre commerce
                    </label>
                    <input id="a-biz" className={field} autoComplete="organization" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
                  </div>
                  <div>
                    <label className={label} htmlFor="a-mail">
                      Adresse e-mail
                    </label>
                    <input
                      id="a-mail"
                      type="email"
                      inputMode="email"
                      className={field}
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={label} htmlFor="a-phone">
                      Numéro WhatsApp
                    </label>
                    <div className="flex gap-2">
                      <select
                        aria-label="Indicatif du pays"
                        className={`${field} w-28 shrink-0 px-2`}
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={c.id} value={c.code}>
                            {c.flag} {c.code}
                          </option>
                        ))}
                      </select>
                      <input
                        id="a-phone"
                        type="tel"
                        inputMode="tel"
                        className={field}
                        autoComplete="tel-national"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <label className={label} htmlFor="a-id">
                    E-mail ou numéro de téléphone
                  </label>
                  <input
                    id="a-id"
                    className={field}
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="nom@exemple.com ou +22890000000"
                  />
                </div>
              )}

              {view !== 'recover' && (
                <div>
                  <label className={label} htmlFor="a-pwd">
                    {view === 'register' ? 'Choisissez un mot de passe (8 caractères minimum)' : 'Mot de passe'}
                  </label>
                  <div className="relative">
                    <input
                      id="a-pwd"
                      type={showPwd ? 'text' : 'password'}
                      className={`${field} pr-12`}
                      autoComplete={view === 'register' ? 'new-password' : 'current-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((v) => !v)}
                      aria-label={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                      className="absolute right-0 top-0 h-full w-12 flex items-center justify-center text-[#dde4f0]"
                    >
                      {showPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              )}

              <ChannelPicker current={channel} onPick={setChannel} />

              <button type="submit" disabled={busy} className={primary}>
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {view === 'login' ? 'Recevoir mon code' : view === 'register' ? 'Créer mon compte' : 'Recevoir mon code'}
              </button>

              <div className="flex flex-wrap justify-between gap-2 text-sm">
                {view === 'login' ? (
                  <>
                    <button type="button" onClick={() => switchView('recover')} className="underline text-[#dde4f0] min-h-[44px]">
                      Mot de passe oublié
                    </button>
                    <button type="button" onClick={() => switchView('register')} className="underline text-[#00ffcc] font-semibold min-h-[44px]">
                      Créer un compte
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => switchView('login')} className="underline text-[#00ffcc] font-semibold min-h-[44px]">
                    J'ai déjà un compte
                  </button>
                )}
              </div>
            </form>
          )}

          {stage === 'code' && challenge && (
            <form onSubmit={submitCode} className="space-y-4" noValidate>
              {challenge.demoCode && (
                <p className="border border-[#00ffcc] bg-[rgba(0,255,204,0.08)] p-3 text-sm text-white">
                  Mode essai, aucun message réel n'est envoyé. Votre code :{' '}
                  <strong className="tabular-nums text-lg text-[#00ffcc]">{challenge.demoCode}</strong>
                </p>
              )}
              <div>
                <label className={label} htmlFor="a-code">
                  Code à 6 chiffres
                </label>
                <input
                  id="a-code"
                  className={`${field} text-center text-2xl tabular-nums`}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                />
                <p className="text-xs text-[#dde4f0] mt-1">Il est valable {challenge.expiresInMinutes} minutes.</p>
              </div>
              <button type="submit" disabled={busy || code.length !== 6} className={primary}>
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}Valider
              </button>
              <div className="border-t border-[#2c2c44] pt-4 space-y-3">
                <p className="text-sm font-semibold text-white">Code non reçu ?</p>
                <div className="grid grid-cols-3 gap-2">
                  {CHANNELS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      disabled={busy || cooldown > 0 || !available(c.id)}
                      onClick={() => resend(c.id)}
                      className="flex flex-col items-center gap-1 border border-[#2c2c44] px-2 py-2 text-sm font-semibold disabled:opacity-40 hover:border-[#00ffcc] min-h-[56px]"
                    >
                      {c.icon}
                      <span>{c.label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-[#dde4f0]">
                  {cooldown > 0 ? `Nouvel envoi possible dans ${cooldown} s.` : 'Choisissez le canal pour recevoir un nouveau code.'}
                </p>
                <button type="button" onClick={() => switchView(view)} className="underline text-sm text-[#dde4f0] min-h-[44px]">
                  Modifier mes informations
                </button>
              </div>
            </form>
          )}

          {stage === 'reset' && (
            <form onSubmit={submitReset} className="space-y-4" noValidate>
              <div>
                <label className={label} htmlFor="a-new">
                  Nouveau mot de passe (8 caractères minimum)
                </label>
                <input
                  id="a-new"
                  type="password"
                  className={field}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <button type="submit" disabled={busy} className={primary}>
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}Enregistrer
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
