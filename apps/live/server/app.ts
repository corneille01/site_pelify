import express, { NextFunction, Request, Response } from 'express';
import dotenv from 'dotenv';
import crypto from 'node:crypto';
import type { AppNotification, ArenaEvent, ArenaEventView, EventFormat, EventStatus, EventType, UserAccount } from '../src/types';
import { EVENT_FORMATS, EVENT_TYPES } from '../src/types';
import {
  HttpError, assertSecurityConfig, burnPasswordCheck, clearSessionCookie, generateCode, hashCode, hashPassword, isProduction,
  parseIdentifier, phoneKey, rateLimited, sameHash, sameOriginOnly, sessionUserId, setSessionCookie, signToken, verifyPassword, verifyToken,
} from './security';
import { CodeChannel, channelAvailable, deliverCode, emailProviderReady, phoneProviderReady, sendEmail } from './messaging';
import { NotifRec, PartRec, Store, UserRec, getStore } from './store';

dotenv.config();
assertSecurityConfig();

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use(express.json({ limit: '50kb' }));
app.use('/api', sameOriginOnly);
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

/* ───────── Utilitaires ───────── */
const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => {
  fn(req, res).catch(next);
};
const adminEmails = () => (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const isAdmin = (u: UserRec) => adminEmails().includes(u.email);
const ip = (req: Request) => req.ip || 'inconnu';
const siteUrl = () => (process.env.APP_URL || 'https://pelify.app').replace(/\/$/, '');
const eventLink = (id: string) => `/arena/jouer/e/${id}`;

function text(v: unknown, min: number, max: number, label: string): string {
  const s = typeof v === 'string' ? v.trim().replace(/[ \t]+/g, ' ') : '';
  if (s.length < min || s.length > max) throw new HttpError(422, min ? `${label} : entre ${min} et ${max} caractères.` : `${label} : ${max} caractères maximum.`, 'validation');
  return s;
}
function emailOf(v: unknown): string {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) || s.length > 120) throw new HttpError(422, 'Saisissez une adresse e-mail valide.', 'validation');
  return s;
}
function pseudoOf(v: unknown): string {
  const s = text(v, 3, 24, 'Pseudonyme');
  if (!/^[\p{L}\p{N}_.\- ]+$/u.test(s)) throw new HttpError(422, 'Pseudonyme : lettres, chiffres, espace, point, tiret et underscore uniquement.', 'validation');
  return s;
}
function passwordOf(v: unknown, ...forbidden: string[]): string {
  if (typeof v !== 'string' || v.length < 8 || v.length > 128) throw new HttpError(422, 'Le mot de passe doit contenir au moins 8 caractères.', 'validation');
  if (forbidden.some((f) => f && v.trim().toLowerCase() === f.trim().toLowerCase())) throw new HttpError(422, 'Choisissez un mot de passe différent de votre e-mail ou de votre pseudonyme.', 'validation');
  return v;
}
const channelOf = (v: unknown): CodeChannel => (v === 'sms' || v === 'whatsapp' ? v : 'email');

function publicUser(u: UserRec): UserAccount {
  const p = u.profile as any;
  return {
    fullName: p.fullName || '', pseudo: p.pseudo || p.businessName || 'Joueur', email: u.email, phone: p.phone || '', countryCode: p.countryCode || '+33',
    country: p.country || 'France', games: Array.isArray(p.games) ? p.games : [], emailNotifications: p.emailNotifications !== false,
    role: isAdmin(u) ? 'admin' : 'joueur', createdAt: p.createdAt, lastLoginAt: p.lastLoginAt,
  };
}

async function requireUser(req: Request, store: Store): Promise<UserRec> {
  const id = sessionUserId(req);
  const user = id ? await store.getUser(id) : null;
  if (!user || !user.verifiedAt) throw new HttpError(401, 'Connectez-vous pour continuer.', 'auth_required');
  if (user.disabled) throw new HttpError(403, 'Ce compte est suspendu. Contactez contact@pelify.app.', 'suspended');
  return user;
}
async function optionalUser(req: Request, store: Store): Promise<UserRec | null> {
  const id = sessionUserId(req);
  const user = id ? await store.getUser(id) : null;
  return user && user.verifiedAt && !user.disabled ? user : null;
}
async function requireAdmin(req: Request, store: Store): Promise<UserRec> {
  const user = await requireUser(req, store);
  if (!isAdmin(user)) throw new HttpError(403, 'Accès non autorisé.');
  return user;
}

const maskDestination = (channel: CodeChannel, u: UserRec) =>
  channel === 'email' ? u.email.replace(/^(.).*(@.*)$/, '$1•••$2') : `${u.phoneKey.slice(0, 4)} ••• ••${u.phoneKey.slice(-2)}`;

/** Génère, enregistre et envoie un code à 6 chiffres. Le code n'est renvoyé au navigateur qu'en développement, sans fournisseur configuré. */
async function startChallenge(store: Store, user: UserRec, channel: CodeChannel, purpose: 'login' | 'register' | 'recover') {
  if (channel !== 'email' && user.phoneKey.startsWith('none:')) throw new HttpError(422, 'Aucun numéro enregistré sur ce compte. Choisissez la réception par e-mail.', 'no_phone');
  if (!channelAvailable(channel)) throw new HttpError(503, channel === 'email' ? 'L’envoi par e-mail n’est pas disponible pour le moment.' : 'L’envoi par SMS ou WhatsApp n’est pas disponible pour le moment.');
  if (rateLimited(`code:${user.id}`, 5, 3_600_000)) throw new HttpError(429, 'Trop de demandes de code. Réessayez dans une heure.');
  const previous = await store.getCode(user.id);
  if (previous && Date.now() - previous.sentAt < 30_000) throw new HttpError(429, 'Patientez 30 secondes avant de demander un nouveau code.');

  const code = generateCode();
  await store.setCode(user.id, { hash: hashCode(user.id, code), expiresAt: Date.now() + 600_000, attempts: 0, purpose, sentAt: Date.now() });
  const status = await deliverCode(channel, { email: user.email, phoneE164: user.phoneKey }, code);
  if (status === 'failed' || status === 'not_configured') {
    await store.deleteCode(user.id);
    throw new HttpError(502, 'Impossible d’envoyer le code. Essayez un autre moyen de réception.');
  }
  return {
    challenge: signToken('challenge', user.id, 900, { p: purpose }),
    channel,
    destination: maskDestination(channel, user),
    expiresInMinutes: 10,
    ...(status === 'demo' ? { demoCode: code } : {}),
  };
}

/* ───────── Notifications ───────── */
type Notice = { userId: string; title: string; body: string; link: string };
export async function notify(store: Store, list: Notice[]): Promise<void> {
  const seen = new Set<string>();
  const items = list.filter((n) => {
    const k = `${n.userId}|${n.title}|${n.link}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const now = new Date().toISOString();
  const recs: NotifRec[] = items.map((n) => ({ id: `N-${crypto.randomUUID()}`, timestamp: now, read: false, ...n }));
  await store.addNotifications(recs);
  await Promise.allSettled(
    items.map(async (n) => {
      const u = await store.getUser(n.userId);
      if (!u || !u.verifiedAt || u.disabled || (u.profile as any).emailNotifications === false) return;
      await sendEmail(u.email, n.title, `${n.body}\n\n${siteUrl()}${n.link}\n\nVous pouvez désactiver ces e-mails dans votre espace, rubrique Paramètres.`);
    }),
  );
}

/* ───────── Événements : règles métier ───────── */
const LINK_HOSTS = ['twitch.tv', 'youtube.com', 'youtu.be', 'kick.com', 'discord.gg', 'discord.com', 'tiktok.com', 'facebook.com', 'fb.gg', 'steamcommunity.com', 'start.gg', 'challonge.com'];
const BANNERS = ['esport', 'controllers', 'laptops', 'dashboard', 'grid'];
const LIVE_WINDOW_MS = 12 * 3_600_000;

function linkOf(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) return '';
  let u: URL;
  try { u = new URL(s); } catch { throw new HttpError(422, 'Le lien externe n’est pas une adresse valide.', 'validation'); }
  const host = u.hostname.toLowerCase().replace(/^(www|m)\./, '');
  const ok = u.protocol === 'https:' && !u.username && !u.password && LINK_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  if (!ok) throw new HttpError(422, 'Lien accepté : https uniquement, vers Twitch, YouTube, Kick, Discord, TikTok, Facebook, Steam, start.gg ou Challonge.', 'validation');
  return u.toString();
}
function dateOf(v: unknown, label: string): string {
  const d = new Date(typeof v === 'string' ? v : '');
  if (Number.isNaN(d.getTime())) throw new HttpError(422, `${label} : date invalide.`, 'validation');
  return d.toISOString();
}

function statusOf(e: ArenaEvent, taken: number, now = Date.now()): EventStatus {
  if (e.cancelled) return 'cancelled';
  const start = Date.parse(e.startsAt);
  if (e.finished || now > start + LIVE_WINDOW_MS) return 'finished';
  if (now >= start) return 'live';
  if (taken >= e.maxPlayers) return 'full';
  if (now > Date.parse(e.deadline)) return 'closed';
  return 'open';
}
function view(e: ArenaEvent, taken: number, viewer?: UserRec | null, mine?: PartRec | null): ArenaEventView {
  const { ownerId, ...rest } = e;
  return { ...rest, ownerId: viewer && viewer.id === ownerId ? ownerId : '', status: statusOf(e, taken), taken, mine: mine?.status, isOwner: Boolean(viewer && viewer.id === ownerId) };
}
async function loadEvent(store: Store, id: string): Promise<ArenaEvent> {
  const e = /^[A-Za-z0-9-]{8,40}$/.test(id) ? await store.getEvent(id) : null;
  if (!e) throw new HttpError(404, 'Événement introuvable.', 'not_found');
  return e;
}
const canManage = (e: ArenaEvent, u: UserRec) => e.ownerId === u.id || isAdmin(u);

function parseEvent(b: any, ownerId: string, ownerPseudo: string, prev?: ArenaEvent): ArenaEvent {
  const type = EVENT_TYPES.some((t) => t.id === b.type) ? (b.type as EventType) : 'autre';
  let format = EVENT_FORMATS.some((f) => f.id === b.format) ? (b.format as EventFormat) : 'libre';
  let maxPlayers = Math.floor(Number(b.maxPlayers));
  if (type === 'defi') { format = '1v1'; maxPlayers = 2; }
  if (format === '1v1') maxPlayers = 2;
  if (!Number.isFinite(maxPlayers) || maxPlayers < 2 || maxPlayers > 500) throw new HttpError(422, 'Nombre de participants : entre 2 et 500.', 'validation');
  const startsAt = dateOf(b.startsAt, 'Début');
  const deadline = b.deadline ? dateOf(b.deadline, 'Date limite') : startsAt;
  if (Date.parse(startsAt) < Date.now() + 5 * 60_000 && !prev) throw new HttpError(422, 'Le début doit être dans le futur.', 'validation');
  if (Date.parse(deadline) > Date.parse(startsAt)) throw new HttpError(422, 'La date limite d’inscription doit précéder le début.', 'validation');
  const now = new Date().toISOString();
  return {
    id: prev?.id || crypto.randomUUID().replace(/-/g, '').slice(0, 14),
    ownerId, ownerPseudo,
    title: text(b.title, 4, 90, 'Nom de l’événement'),
    game: text(b.game, 2, 80, 'Jeu'),
    platform: text(b.platform || 'Autre', 2, 30, 'Plateforme'),
    type, format, maxPlayers,
    description: text(b.description, 0, 1500, 'Description'),
    rules: text(b.rules, 0, 2000, 'Règles'),
    requireApproval: Boolean(b.requireApproval),
    startsAt, deadline,
    link: linkOf(b.link),
    visibility: b.visibility === 'prive' ? 'prive' : 'public',
    banner: BANNERS.includes(b.banner) ? b.banner : 'esport',
    createdAt: prev?.createdAt || now, updatedAt: now,
    finished: prev?.finished, cancelled: prev?.cancelled, result: prev?.result,
    ...((prev as any)?.reminded ? { reminded: true } : {}),
  } as ArenaEvent;
}

/* ───────── Configuration publique ───────── */
app.get('/api/health', wrap(async (_req, res) => {
  // Diagnostic sans secret : indique seulement si le stockage répond.
  try {
    await getStore();
    res.json({ status: 'ok', storage: 'ok' });
  } catch {
    res.status(503).json({ status: 'degraded', storage: 'indisponible' });
  }
}));
app.get('/api/config', (_req, res) => {
  res.json({
    demo: !isProduction() && (!emailProviderReady() || !phoneProviderReady()),
    channels: { email: channelAvailable('email'), sms: channelAvailable('sms'), whatsapp: channelAvailable('whatsapp') },
  });
});

/* ───────── Authentification : mot de passe puis code de vérification ───────── */
app.post('/api/auth/register', wrap(async (req, res) => {
  if (rateLimited(`register:${ip(req)}`, 10, 3_600_000)) throw new HttpError(429, 'Trop de tentatives. Réessayez plus tard.');
  const b = req.body || {};
  if (b.accept !== true) throw new HttpError(422, 'Acceptez les conditions d’utilisation et confirmez avoir 15 ans ou plus.', 'validation');
  const pseudo = pseudoOf(b.pseudo);
  const fullName = text(b.fullName, 0, 80, 'Nom');
  const email = emailOf(b.email);
  const countryCode = `+${String(b.countryCode || '+33').replace(/\D/g, '') || '33'}`;
  const localPhone = String(b.phone || '').replace(/\D/g, '').replace(/^0+/, '');
  if (localPhone && (localPhone.length < 6 || localPhone.length > 13)) throw new HttpError(422, 'Saisissez un numéro valide ou laissez le champ vide.', 'validation');
  const password = passwordOf(b.password, email, pseudo);
  const channel = localPhone ? channelOf(b.channel) : 'email';

  const store = await getStore();
  const byEmail = await store.findUserByEmail(email);
  if (byEmail?.verifiedAt) throw new HttpError(409, 'Un compte existe déjà avec cet e-mail. Connectez-vous.', 'account_exists');
  const id = byEmail?.id || crypto.randomUUID();
  const key = localPhone ? phoneKey(countryCode, localPhone) : `none:${id}`;
  if (localPhone) {
    const byPhone = await store.findUserByPhoneKey(key);
    if (byPhone && byPhone.id !== byEmail?.id) {
      if (byPhone.verifiedAt) throw new HttpError(409, 'Ce numéro est déjà associé à un compte. Connectez-vous.', 'phone_used');
      await store.deleteUser(byPhone.id);
    }
  }
  const now = new Date().toISOString();
  const rec: UserRec = {
    id, email, phoneKey: key, passwordHash: await hashPassword(password), verifiedAt: null, failedLogins: 0, lockedUntil: 0,
    profile: {
      fullName, pseudo, email, phone: localPhone, countryCode, country: typeof b.country === 'string' && b.country.trim() ? b.country.trim().slice(0, 60) : 'France',
      games: [], emailNotifications: true, createdAt: now, lastLoginAt: now,
    },
  };
  await store.saveUser(rec);
  res.json(await startChallenge(store, rec, channel, 'register'));
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const { identifier, password } = req.body || {};
  if (rateLimited(`login:${ip(req)}`, 20, 900_000)) throw new HttpError(429, 'Trop de tentatives. Réessayez dans quelques minutes.');
  const id = parseIdentifier(identifier);
  const store = await getStore();
  const user = id.email ? await store.findUserByEmail(id.email) : id.phoneKey ? await store.findUserByPhoneKey(id.phoneKey) : null;
  const pwd = typeof password === 'string' ? password : '';

  if (user?.lockedUntil && user.lockedUntil > Date.now()) throw new HttpError(429, 'Compte verrouillé quelques minutes après plusieurs erreurs. Réessayez plus tard.', 'locked');
  const ok = user && user.verifiedAt ? await verifyPassword(pwd, user.passwordHash) : (await burnPasswordCheck(pwd), false);
  if (!ok || !user) {
    if (user && user.verifiedAt) {
      const failed = user.failedLogins + 1;
      await store.saveUser({ ...user, failedLogins: failed >= 5 ? 0 : failed, lockedUntil: failed >= 5 ? Date.now() + 900_000 : 0 });
    }
    throw new HttpError(401, 'E-mail, numéro ou mot de passe incorrect.', 'bad_credentials');
  }
  if (user.disabled) throw new HttpError(403, 'Ce compte est suspendu. Contactez contact@pelify.app.', 'suspended');
  if (user.failedLogins) await store.saveUser({ ...user, failedLogins: 0, lockedUntil: 0 });
  res.json(await startChallenge(store, user, channelOf(req.body.channel), 'login'));
}));

app.post('/api/auth/resend', wrap(async (req, res) => {
  const token = verifyToken('challenge', req.body?.challenge);
  const store = await getStore();
  const user = token ? await store.getUser(token.sub) : null;
  if (!token || !user) throw new HttpError(401, 'La vérification a expiré. Recommencez.', 'challenge_expired');
  res.json(await startChallenge(store, user, channelOf(req.body.channel), token.p));
}));

app.post('/api/auth/verify', wrap(async (req, res) => {
  const token = verifyToken('challenge', req.body?.challenge);
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  if (!/^\d{6}$/.test(code)) throw new HttpError(422, 'Saisissez le code à 6 chiffres.', 'validation');
  const store = await getStore();
  const user = token ? await store.getUser(token.sub) : null;
  if (!token || !user) throw new HttpError(401, 'Code incorrect ou expiré.', 'bad_code');

  const rec = await store.getCode(user.id);
  if (!rec || rec.expiresAt < Date.now()) throw new HttpError(401, 'Ce code a expiré. Demandez-en un nouveau.', 'code_expired');
  if (rec.attempts >= 5) {
    await store.deleteCode(user.id);
    throw new HttpError(429, 'Trop d’essais. Demandez un nouveau code.', 'too_many_attempts');
  }
  if (!sameHash(rec.hash, hashCode(user.id, code))) {
    await store.setCode(user.id, { ...rec, attempts: rec.attempts + 1 });
    throw new HttpError(401, 'Code incorrect. Vérifiez et réessayez.', 'bad_code');
  }
  await store.deleteCode(user.id);

  if (rec.purpose === 'recover') return res.json({ resetToken: signToken('reset', user.id, 600) });
  const now = new Date().toISOString();
  const saved: UserRec = { ...user, verifiedAt: user.verifiedAt || now, failedLogins: 0, lockedUntil: 0, profile: { ...user.profile, lastLoginAt: now } };
  await store.saveUser(saved);
  setSessionCookie(req, res, saved.id);
  res.json({ user: publicUser(saved) });
}));

app.post('/api/auth/recover', wrap(async (req, res) => {
  if (rateLimited(`recover:${ip(req)}`, 10, 3_600_000)) throw new HttpError(429, 'Trop de tentatives. Réessayez plus tard.');
  const id = parseIdentifier(req.body?.identifier);
  const store = await getStore();
  const user = id.email ? await store.findUserByEmail(id.email) : id.phoneKey ? await store.findUserByPhoneKey(id.phoneKey) : null;
  const channel = channelOf(req.body?.channel);
  if (user && user.verifiedAt) return res.json(await startChallenge(store, user, channel, 'recover'));
  // Même réponse pour un compte inconnu : on ne révèle pas qui est inscrit.
  res.json({ challenge: signToken('challenge', 'inconnu', 900, { p: 'recover' }), channel, destination: 'votre contact', expiresInMinutes: 10 });
}));

app.post('/api/auth/reset', wrap(async (req, res) => {
  const token = verifyToken('reset', req.body?.resetToken);
  const store = await getStore();
  const user = token ? await store.getUser(token.sub) : null;
  if (!token || !user) throw new HttpError(401, 'La demande a expiré. Recommencez.', 'challenge_expired');
  const next = { ...user, passwordHash: await hashPassword(passwordOf(req.body?.newPassword, user.email, publicUser(user).pseudo)), failedLogins: 0, lockedUntil: 0 };
  await store.saveUser(next);
  setSessionCookie(req, res, next.id);
  res.json({ user: publicUser(next) });
}));

app.get('/api/auth/me', wrap(async (req, res) => {
  const store = await getStore();
  const user = await optionalUser(req, store);
  res.json({ user: user ? publicUser(user) : null });
}));

app.post('/api/auth/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

/* ───────── Profil, export et suppression ───────── */
app.put('/api/me', wrap(async (req, res) => {
  const store = await getStore();
  const user = await requireUser(req, store);
  const b = req.body || {};
  const profile: any = { ...user.profile };
  if (b.pseudo !== undefined) profile.pseudo = pseudoOf(b.pseudo);
  if (b.fullName !== undefined) profile.fullName = text(b.fullName, 0, 80, 'Nom');
  if (b.country !== undefined) profile.country = text(b.country, 2, 60, 'Pays');
  if (b.emailNotifications !== undefined) profile.emailNotifications = Boolean(b.emailNotifications);
  if (Array.isArray(b.games)) profile.games = b.games.slice(0, 12).map((g: unknown) => text(g, 2, 60, 'Jeu'));
  const saved = { ...user, profile };
  await store.saveUser(saved);
  res.json({ user: publicUser(saved) });
}));

app.post('/api/me/password', wrap(async (req, res) => {
  const store = await getStore();
  const user = await requireUser(req, store);
  if (!(await verifyPassword(String(req.body?.currentPassword || ''), user.passwordHash))) throw new HttpError(401, 'Le mot de passe actuel est incorrect.', 'bad_credentials');
  await store.saveUser({ ...user, passwordHash: await hashPassword(passwordOf(req.body?.newPassword, user.email, publicUser(user).pseudo)) });
  res.json({ ok: true });
}));

app.get('/api/me/export', wrap(async (req, res) => {
  const store = await getStore();
  const user = await requireUser(req, store);
  const [events, parts, notifications] = await Promise.all([store.listEvents(), store.listPartsOfUser(user.id), store.listNotifications(user.id)]);
  res.json({ exportedAt: new Date().toISOString(), profile: publicUser(user), events: events.filter((e) => e.ownerId === user.id), participations: parts, notifications });
}));

app.delete('/api/me', wrap(async (req, res) => {
  const store = await getStore();
  const user = await requireUser(req, store);
  if (!(await verifyPassword(String(req.body?.password || ''), user.passwordHash))) throw new HttpError(401, 'Mot de passe incorrect.', 'bad_credentials');
  const mine = (await store.listEvents()).filter((e) => e.ownerId === user.id && !e.finished && !e.cancelled);
  for (const e of mine) {
    await store.saveEvent({ ...e, cancelled: true, ownerPseudo: 'Compte supprimé', updatedAt: new Date().toISOString() });
    const parts = (await store.listParts(e.id)).filter((p) => p.status === 'accepted' || p.status === 'pending');
    await notify(store, parts.map((p) => ({ userId: p.userId, title: `Événement annulé : ${e.title}`, body: 'L’organisateur a supprimé son compte, l’événement est annulé.', link: eventLink(e.id) })));
  }
  for (const e of (await store.listEvents()).filter((x) => x.ownerId === user.id && (x.finished || x.cancelled))) await store.saveEvent({ ...e, ownerId: 'supprime', ownerPseudo: 'Compte supprimé' });
  await store.audit(user.id, 'suppression_compte', user.id);
  await store.eraseUser(user.id);
  clearSessionCookie(res);
  res.json({ ok: true });
}));

/* ───────── Événements ───────── */
app.get('/api/events', wrap(async (req, res) => {
  const store = await getStore();
  const viewer = await optionalUser(req, store);
  const [all, counts, mine] = await Promise.all([store.listEvents(), store.countsByEvent(), viewer ? store.listPartsOfUser(viewer.id) : Promise.resolve([])]);
  const byEvent = new Map(mine.map((p) => [p.eventId, p]));
  const cutoff = Date.now() - 30 * 86_400_000;
  const out = all
    .filter((e) => Date.parse(e.startsAt) > cutoff)
    .filter((e) => e.visibility === 'public' || (viewer && (e.ownerId === viewer.id || byEvent.has(e.id))))
    .map((e) => view(e, counts[e.id] || 0, viewer, byEvent.get(e.id)));
  res.json(out);
}));

app.get('/api/events/:id', wrap(async (req, res) => {
  const store = await getStore();
  const viewer = await optionalUser(req, store);
  const e = await loadEvent(store, req.params.id);
  const parts = await store.listParts(e.id);
  const taken = parts.filter((p) => p.status === 'pending' || p.status === 'accepted').length;
  const mine = viewer ? parts.find((p) => p.userId === viewer.id) : undefined;
  const manage = Boolean(viewer && canManage(e, viewer));
  res.json({
    event: view(e, taken, viewer, mine),
    participants: parts
      .filter((p) => manage || p.status === 'accepted')
      .map((p) => ({ ...(manage ? { userId: p.userId } : {}), pseudo: p.pseudo, status: p.status, createdAt: p.createdAt })),
  });
}));

app.post('/api/events', wrap(async (req, res) => {
  const store = await getStore();
  const user = await requireUser(req, store);
  if (rateLimited(`create:${user.id}`, 20, 3_600_000)) throw new HttpError(429, 'Trop de créations. Réessayez plus tard.');
  const e = parseEvent(req.body || {}, user.id, publicUser(user).pseudo);
  await store.saveEvent(e);
  await store.audit(user.id, 'creation_evenement', e.id);
  res.status(201).json({ event: view(e, 0, user) });
}));

app.put('/api/events/:id', wrap(async (req, res) => {
  const store = await getStore();
  const user = await requireUser(req, store);
  const prev = await loadEvent(store, req.params.id);
  if (!canManage(prev, user)) throw new HttpError(403, 'Seul l’organisateur peut modifier cet événement.');
  if (prev.cancelled || prev.finished) throw new HttpError(409, 'Cet événement est clos et ne peut plus être modifié.', 'closed');
  const next = parseEvent(req.body || {}, prev.ownerId, prev.ownerPseudo, prev);
  const parts = await store.listParts(prev.id);
  if (next.maxPlayers < parts.filter((p) => p.status === 'pending' || p.status === 'accepted').length) throw new HttpError(409, 'Le nombre maximum est inférieur au nombre d’inscrits.', 'validation');
  await store.saveEvent(next);
  const changed = next.startsAt !== prev.startsAt || next.rules !== prev.rules || next.link !== prev.link || next.deadline !== prev.deadline;
  if (changed) {
    await notify(store, parts.filter((p) => p.status === 'accepted' || p.status === 'pending').map((p) => ({ userId: p.userId, title: `Modification : ${next.title}`, body: 'L’organisateur a modifié la date, les règles ou le lien de cet événement. Vérifiez les informations.', link: eventLink(next.id) })));
  }
  await store.audit(user.id, 'modification_evenement', next.id);
  const counts = await store.countsByEvent();
  res.json({ event: view(next, counts[next.id] || 0, user) });
}));

async function close(req: Request, res: Response, kind: 'cancel' | 'finish') {
  const store = await getStore();
  const user = await requireUser(req, store);
  const e = await loadEvent(store, req.params.id);
  if (!canManage(e, user)) throw new HttpError(403, 'Seul l’organisateur peut faire cela.');
  if (e.cancelled || e.finished) throw new HttpError(409, 'Cet événement est déjà clos.', 'closed');
  const next: ArenaEvent = kind === 'cancel'
    ? { ...e, cancelled: true, updatedAt: new Date().toISOString() }
    : { ...e, finished: true, result: text(req.body?.result, 0, 300, 'Résultat'), updatedAt: new Date().toISOString() };
  await store.saveEvent(next);
  const parts = (await store.listParts(e.id)).filter((p) => p.status === 'accepted' || p.status === 'pending');
  await notify(store, parts.map((p) => ({
    userId: p.userId,
    title: kind === 'cancel' ? `Événement annulé : ${e.title}` : `Événement terminé : ${e.title}`,
    body: kind === 'cancel' ? 'L’organisateur a annulé cet événement.' : next.result ? `Résultat : ${next.result}` : 'L’événement est terminé.',
    link: eventLink(e.id),
  })));
  await store.audit(user.id, kind === 'cancel' ? 'annulation_evenement' : 'cloture_evenement', e.id);
  const counts = await store.countsByEvent();
  res.json({ event: view(next, counts[e.id] || 0, user) });
}
app.post('/api/events/:id/cancel', wrap((req, res) => close(req, res, 'cancel')));
app.post('/api/events/:id/finish', wrap((req, res) => close(req, res, 'finish')));

app.post('/api/events/:id/join', wrap(async (req, res) => {
  const store = await getStore();
  const user = await requireUser(req, store);
  const e = await loadEvent(store, req.params.id);
  if (e.ownerId === user.id) throw new HttpError(403, 'Vous organisez cet événement : vous ne pouvez pas vous inscrire comme participant.', 'owner');
  const counts = await store.countsByEvent();
  const st = statusOf(e, counts[e.id] || 0);
  if (st === 'cancelled') throw new HttpError(409, 'Cet événement est annulé.', 'closed');
  if (st === 'finished' || st === 'live') throw new HttpError(409, 'Cet événement a déjà commencé.', 'expired');
  if (st === 'closed') throw new HttpError(409, 'Les inscriptions sont closes.', 'expired');
  const status = e.requireApproval ? 'pending' : 'accepted';
  const out = await store.joinEvent({ eventId: e.id, userId: user.id, pseudo: publicUser(user).pseudo, status, createdAt: new Date().toISOString() }, e.maxPlayers);
  if (out === 'exists') throw new HttpError(409, 'Vous êtes déjà inscrit à cet événement.', 'exists');
  if (out === 'full') throw new HttpError(409, 'Cet événement est complet.', 'full');
  await notify(store, [{
    userId: e.ownerId,
    title: e.requireApproval ? `Demande de participation : ${e.title}` : `Nouveau participant : ${e.title}`,
    body: e.requireApproval ? `${publicUser(user).pseudo} demande à participer. Acceptez ou refusez depuis la page de l’événement.` : `${publicUser(user).pseudo} a rejoint votre événement.`,
    link: eventLink(e.id),
  }]);
  res.json({ status });
}));

app.post('/api/events/:id/leave', wrap(async (req, res) => {
  const store = await getStore();
  const user = await requireUser(req, store);
  const e = await loadEvent(store, req.params.id);
  const part = await store.getPart(e.id, user.id);
  if (!part || part.status === 'withdrawn') throw new HttpError(404, 'Vous n’êtes pas inscrit à cet événement.', 'not_found');
  if (Date.now() >= Date.parse(e.startsAt)) throw new HttpError(409, 'L’événement a commencé : le désistement n’est plus possible.', 'expired');
  await store.setPart(e.id, user.id, 'withdrawn');
  await notify(store, [{ userId: e.ownerId, title: `Désistement : ${e.title}`, body: `${publicUser(user).pseudo} s’est retiré de votre événement.`, link: eventLink(e.id) }]);
  res.json({ ok: true });
}));

app.post('/api/events/:id/participants/:userId', wrap(async (req, res) => {
  const store = await getStore();
  const user = await requireUser(req, store);
  const e = await loadEvent(store, req.params.id);
  if (!canManage(e, user)) throw new HttpError(403, 'Seul l’organisateur peut gérer les participants.');
  const action = req.body?.action;
  if (action !== 'accept' && action !== 'refuse') throw new HttpError(422, 'Action inconnue.', 'validation');
  const part = await store.getPart(e.id, req.params.userId);
  if (!part || part.status === 'withdrawn') throw new HttpError(404, 'Participant introuvable.', 'not_found');
  if (action === 'accept' && part.status !== 'accepted') {
    const accepted = (await store.listParts(e.id)).filter((p) => p.status === 'accepted').length;
    if (accepted >= e.maxPlayers) throw new HttpError(409, 'Toutes les places sont attribuées.', 'full');
  }
  await store.setPart(e.id, part.userId, action === 'accept' ? 'accepted' : 'refused');
  await notify(store, [{
    userId: part.userId,
    title: action === 'accept' ? `Participation acceptée : ${e.title}` : `Participation refusée : ${e.title}`,
    body: action === 'accept' ? 'Vous êtes inscrit. Retrouvez le lien et les règles sur la page de l’événement.' : 'L’organisateur n’a pas retenu votre demande.',
    link: eventLink(e.id),
  }]);
  await store.audit(user.id, `participant_${action}`, `${e.id}:${part.userId}`);
  res.json({ ok: true });
}));

app.get('/api/me/events', wrap(async (req, res) => {
  const store = await getStore();
  const user = await requireUser(req, store);
  const [all, counts, parts] = await Promise.all([store.listEvents(), store.countsByEvent(), store.listPartsOfUser(user.id)]);
  const byId = new Map(all.map((e) => [e.id, e]));
  res.json({
    created: all.filter((e) => e.ownerId === user.id).map((e) => view(e, counts[e.id] || 0, user)),
    joined: parts.filter((p) => byId.has(p.eventId)).map((p) => view(byId.get(p.eventId)!, counts[p.eventId] || 0, user, p)),
  });
}));

/* ───────── Notifications ───────── */
app.get('/api/notifications', wrap(async (req, res) => {
  const store = await getStore();
  const user = await requireUser(req, store);
  const list = await store.listNotifications(user.id);
  const out: AppNotification[] = list.map(({ userId, ...n }) => n);
  res.json(out);
}));
app.post('/api/notifications/read', wrap(async (req, res) => {
  const store = await getStore();
  const user = await requireUser(req, store);
  await store.markRead(user.id, typeof req.body?.id === 'string' ? req.body.id : undefined);
  res.json({ ok: true });
}));

/* ───────── Signalements et administration ───────── */
app.post('/api/reports', wrap(async (req, res) => {
  const store = await getStore();
  const user = await requireUser(req, store);
  if (rateLimited(`report:${user.id}`, 10, 3_600_000)) throw new HttpError(429, 'Trop de signalements. Réessayez plus tard.');
  const type = req.body?.targetType === 'user' ? 'user' : 'event';
  const targetId = text(req.body?.targetId, 4, 60, 'Cible');
  let label = targetId;
  if (type === 'event') label = (await loadEvent(store, targetId)).title;
  await store.addReport({ id: `R-${crypto.randomUUID().slice(0, 8)}`, createdAt: new Date().toISOString(), targetType: type, targetId, targetLabel: label, reason: text(req.body?.reason, 5, 500, 'Motif'), reporterId: user.id, reporter: publicUser(user).pseudo, status: 'open' });
  res.json({ ok: true });
}));

app.get('/api/admin/overview', wrap(async (req, res) => {
  const store = await getStore();
  await requireAdmin(req, store);
  const [users, events, reports, counts] = await Promise.all([store.listUsers(), store.listEvents(), store.listReports(), store.countsByEvent()]);
  res.json({
    stats: { users: users.length, events: events.length, open: events.filter((e) => statusOf(e, counts[e.id] || 0) === 'open').length, reports: reports.filter((r) => r.status === 'open').length },
    users: users.map((u) => ({ id: u.id, pseudo: publicUser(u).pseudo, email: u.email, createdAt: u.profile.createdAt, disabled: Boolean(u.disabled), verified: Boolean(u.verifiedAt) })),
    events: events.map((e) => view(e, counts[e.id] || 0, null)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 200),
    reports: reports.map(({ reporterId, ...r }) => r),
  });
}));
app.post('/api/admin/reports/:id/resolve', wrap(async (req, res) => {
  const store = await getStore();
  const admin = await requireAdmin(req, store);
  await store.resolveReport(req.params.id);
  await store.audit(admin.id, 'signalement_traite', req.params.id);
  res.json({ ok: true });
}));
app.post('/api/admin/users/:id/:action', wrap(async (req, res) => {
  const store = await getStore();
  const admin = await requireAdmin(req, store);
  if (req.params.action !== 'disable' && req.params.action !== 'enable') throw new HttpError(404, 'Introuvable.');
  const target = await store.getUser(req.params.id);
  if (!target) throw new HttpError(404, 'Compte introuvable.', 'not_found');
  if (isAdmin(target)) throw new HttpError(403, 'Un administrateur ne peut pas être suspendu ici.');
  await store.saveUser({ ...target, disabled: req.params.action === 'disable' });
  await store.audit(admin.id, `compte_${req.params.action}`, target.id);
  res.json({ ok: true });
}));

/* ───────── Rappels (appelés par la fonction planifiée) ───────── */
export async function sendReminders(): Promise<number> {
  const store = await getStore();
  const now = Date.now();
  let sent = 0;
  for (const e of await store.listEvents()) {
    const start = Date.parse(e.startsAt);
    if (e.cancelled || e.finished || (e as any).reminded || start < now || start > now + 24 * 3_600_000) continue;
    const parts = (await store.listParts(e.id)).filter((p) => p.status === 'accepted');
    await notify(store, [e.ownerId, ...parts.map((p) => p.userId)].map((userId) => ({ userId, title: `Bientôt : ${e.title}`, body: `L’événement commence le ${new Date(e.startsAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'full', timeStyle: 'short' })} (heure de Paris).`, link: eventLink(e.id) })));
    await store.saveEvent({ ...e, reminded: true } as ArenaEvent);
    sent += 1;
  }
  return sent;
}

/* ───────── Erreurs ───────── */
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Introuvable.' });
});
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, code: err.code });
  const e = err as { type?: string; status?: number };
  if (e?.type === 'entity.parse.failed' || e?.type === 'entity.too.large') return res.status(400).json({ error: 'Requête invalide.' });
  console.error('[Erreur serveur]', err instanceof Error ? err.message : err);
  res.status(500).json({ error: 'Le service est momentanément indisponible. Réessayez dans quelques minutes.' });
});
