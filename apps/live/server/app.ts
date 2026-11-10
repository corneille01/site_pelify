import express, { NextFunction, Request, Response } from 'express';
import dotenv from 'dotenv';
import crypto from 'node:crypto';
import type { Booking, PaymentMethod, UserAccount } from '../src/types';
import { PACKS, TIME_SLOTS_1H30, TIME_SLOTS_4H } from '../src/data/packs';
import { SECTORS } from '../src/data/sectors';
import {
  HttpError, assertSecurityConfig, burnPasswordCheck, clearSessionCookie, generateCode, hashCode, hashPassword, isProduction,
  parseIdentifier, phoneKey, rateLimited, sameHash, sameOriginOnly, sessionUserId, setSessionCookie, signToken, verifyPassword, verifyToken,
} from './security';
import { CodeChannel, channelAvailable, deliverCode, emailProviderReady, notifyBooking, phoneProviderReady } from './messaging';
import { BookingRec, Store, UserRec, getStore } from './store';

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
const adminEmails = () => (process.env.ADMIN_EMAILS || 'blogoos1@gmail.com').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const isAdmin = (u: UserRec) => adminEmails().includes(u.email);
const ip = (req: Request) => req.ip || 'inconnu';
const siteUrl = (req: Request) => process.env.APP_URL || `${req.protocol}://${req.get('host')}`;

function text(v: unknown, min: number, max: number, label: string): string {
  const s = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
  if (s.length < min || s.length > max) throw new HttpError(422, `${label} : entre ${min} et ${max} caractères.`, 'validation');
  return s;
}
function emailOf(v: unknown): string {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) || s.length > 120) throw new HttpError(422, 'Saisissez une adresse e-mail valide.', 'validation');
  return s;
}
function passwordOf(v: unknown, ...forbidden: string[]): string {
  if (typeof v !== 'string' || v.length < 8 || v.length > 128) throw new HttpError(422, 'Le mot de passe doit contenir au moins 8 caractères.', 'validation');
  if (forbidden.some((f) => f && v.trim().toLowerCase() === f.trim().toLowerCase())) throw new HttpError(422, 'Choisissez un mot de passe différent de votre e-mail ou du nom de votre commerce.', 'validation');
  return v;
}
const channelOf = (v: unknown): CodeChannel => (v === 'email' || v === 'whatsapp' ? v : 'sms');

async function publicUser(store: Store, u: UserRec): Promise<UserAccount> {
  const mine = await store.listBookings(u.id);
  return { ...u.profile, role: isAdmin(u) ? 'regie_admin' : 'client', bookingIds: mine.map((b) => b.id) };
}
const publicBooking = (b: BookingRec): Booking => {
  const { userId, startsAt, endsAt, ...rest } = b;
  return rest;
};

async function requireUser(req: Request, store: Store): Promise<UserRec> {
  const id = sessionUserId(req);
  const user = id ? await store.getUser(id) : null;
  if (!user || !user.verifiedAt) throw new HttpError(401, 'Connectez-vous pour continuer.', 'auth_required');
  return user;
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
    payment: { tmoney: process.env.PAY_TMONEY || '', flooz: process.env.PAY_FLOOZ || '', mtn_momo: process.env.PAY_MTN || '' },
  });
});

/* ───────── Authentification : mot de passe puis code de vérification ───────── */
app.post('/api/auth/register', wrap(async (req, res) => {
  if (rateLimited(`register:${ip(req)}`, 10, 3_600_000)) throw new HttpError(429, 'Trop de tentatives. Réessayez plus tard.');
  const b = req.body || {};
  const fullName = text(b.fullName, 2, 80, 'Nom complet');
  const businessName = text(b.businessName, 2, 120, 'Nom du commerce');
  const email = emailOf(b.email);
  const countryCode = `+${String(b.countryCode || '+228').replace(/\D/g, '') || '228'}`;
  const localPhone = String(b.phone || '').replace(/\D/g, '').replace(/^0+/, '');
  if (localPhone.length < 6 || localPhone.length > 13) throw new HttpError(422, 'Saisissez un numéro WhatsApp valide.', 'validation');
  const password = passwordOf(b.password, email, businessName);
  const channel = channelOf(b.channel);
  const key = phoneKey(countryCode, localPhone);

  const store = await getStore();
  const byEmail = await store.findUserByEmail(email);
  if (byEmail?.verifiedAt) throw new HttpError(409, 'Un compte existe déjà avec cet e-mail. Connectez-vous.', 'account_exists');
  const byPhone = await store.findUserByPhoneKey(key);
  if (byPhone && byPhone.id !== byEmail?.id) {
    if (byPhone.verifiedAt) throw new HttpError(409, 'Ce numéro est déjà associé à un compte. Connectez-vous.', 'phone_used');
    await store.deleteUser(byPhone.id);
  }
  const now = new Date().toISOString();
  const rec: UserRec = {
    id: byEmail?.id || crypto.randomUUID(), email, phoneKey: key, passwordHash: await hashPassword(password),
    verifiedAt: null, failedLogins: 0, lockedUntil: 0,
    profile: {
      phone: localPhone, countryCode, fullName, email, businessName,
      sector: SECTORS.some((s) => s.id === b.sector) ? b.sector : 'autre',
      onScreenPhone: typeof b.onScreenPhone === 'string' && b.onScreenPhone.trim() ? b.onScreenPhone.trim().slice(0, 40) : `${countryCode} ${localPhone}`,
      country: typeof b.country === 'string' && b.country.trim() ? b.country.trim().slice(0, 60) : 'Togo',
      role: 'client', createdAt: now, lastLoginAt: now, bookingIds: [],
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
  res.json({ user: await publicUser(store, saved) });
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
  const next = { ...user, passwordHash: await hashPassword(passwordOf(req.body?.newPassword, user.email, user.profile.businessName)), failedLogins: 0, lockedUntil: 0 };
  await store.saveUser(next);
  setSessionCookie(req, res, next.id);
  res.json({ user: await publicUser(store, next) });
}));

app.get('/api/auth/me', wrap(async (req, res) => {
  const store = await getStore();
  const id = sessionUserId(req);
  const user = id ? await store.getUser(id) : null;
  res.json({ user: user && user.verifiedAt ? await publicUser(store, user) : null });
}));

app.post('/api/auth/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

/* ───────── Profil ───────── */
app.put('/api/me', wrap(async (req, res) => {
  const store = await getStore();
  const user = await requireUser(req, store);
  const b = req.body || {};
  const profile = { ...user.profile };
  if (b.fullName !== undefined) profile.fullName = text(b.fullName, 2, 80, 'Nom complet');
  if (b.businessName !== undefined) profile.businessName = text(b.businessName, 2, 120, 'Nom du commerce');
  if (b.onScreenPhone !== undefined) profile.onScreenPhone = text(b.onScreenPhone, 3, 40, 'Numéro affiché');
  if (b.country !== undefined) profile.country = text(b.country, 2, 60, 'Pays');
  if (b.sector !== undefined && SECTORS.some((s) => s.id === b.sector)) profile.sector = b.sector;
  const saved = { ...user, profile };
  await store.saveUser(saved);
  res.json({ user: await publicUser(store, saved) });
}));

app.post('/api/me/password', wrap(async (req, res) => {
  const store = await getStore();
  const user = await requireUser(req, store);
  if (!(await verifyPassword(String(req.body?.currentPassword || ''), user.passwordHash))) throw new HttpError(401, 'Le mot de passe actuel est incorrect.', 'bad_credentials');
  await store.saveUser({ ...user, passwordHash: await hashPassword(passwordOf(req.body?.newPassword, user.email, user.profile.businessName)) });
  res.json({ ok: true });
}));

/* ───────── Disponibilités (publiques, sans donnée personnelle) ───────── */
app.get('/api/availability', wrap(async (_req, res) => {
  const store = await getStore();
  res.json({ busy: await store.busy() });
}));

/* ───────── Réservations ───────── */
const PAYMENT_METHODS: PaymentMethod[] = ['tmoney', 'flooz', 'mtn_momo', 'onsite'];

function validDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

app.get('/api/bookings', wrap(async (req, res) => {
  const store = await getStore();
  const user = await requireUser(req, store);
  const list = await store.listBookings(isAdmin(user) ? undefined : user.id);
  res.json(list.map(publicBooking));
}));

app.post('/api/bookings', wrap(async (req, res) => {
  const store = await getStore();
  const user = await requireUser(req, store);
  if (rateLimited(`booking:${user.id}`, 10, 3_600_000)) throw new HttpError(429, 'Trop de réservations en peu de temps. Réessayez plus tard.');
  const b = req.body || {};

  const pack = PACKS.find((p) => p.id === b.packId);
  if (!pack) throw new HttpError(422, 'Choisissez un pack.', 'validation');
  if (b.mode !== 'presentiel' && b.mode !== 'distance') throw new HttpError(422, 'Choisissez le mode de live.', 'validation');
  const slot = (pack.isContinuousBlock ? TIME_SLOTS_4H : TIME_SLOTS_1H30).find((s) => s.time === b.slotTime);
  if (!slot) throw new HttpError(422, 'Choisissez un créneau.', 'validation');
  if (!validDate(b.date)) throw new HttpError(422, 'Choisissez une date.', 'validation');

  const startsAt = new Date(`${b.date}T${slot.time}:00Z`); // l'heure de Lomé est l'heure GMT
  const endsAt = new Date(`${b.date}T${slot.endTime}:00Z`);
  if (startsAt.getTime() <= Date.now()) throw new HttpError(422, 'Ce créneau est déjà passé. Choisissez une date à venir.', 'validation');
  if (startsAt.getTime() > Date.now() + 366 * 86_400_000) throw new HttpError(422, 'Réservation possible jusqu’à un an à l’avance.', 'validation');

  const method = b.paymentMethod as PaymentMethod;
  if (!PAYMENT_METHODS.includes(method)) throw new HttpError(422, 'Choisissez un moyen de paiement.', 'validation');
  if (method === 'onsite' && b.mode !== 'presentiel') throw new HttpError(422, 'Le paiement sur place n’est possible qu’en présentiel.', 'validation');
  const c = b.consents || {};
  if (c.cgv !== true || c.data !== true || c.image !== true) throw new HttpError(422, 'Acceptez les trois conditions pour continuer.', 'validation');

  const a = b.activity || {};
  const country = text(a.country || user.profile.country, 2, 60, 'Pays');
  let id = '';
  do id = `OCD-${new Date().getUTCFullYear()}-${crypto.randomInt(10000, 100000)}`; while (await store.getBooking(id));

  const rec: BookingRec = {
    id, reference: id, createdAt: new Date().toISOString(), mode: b.mode, packId: pack.id,
    date: b.date, slotTime: slot.time, slotEndTime: slot.endTime,
    fullName: user.profile.fullName, phone: user.profile.phone, countryCode: user.profile.countryCode, email: user.email,
    businessName: text(a.businessName, 2, 120, 'Nom du commerce'),
    sector: SECTORS.some((s) => s.id === a.sector) ? a.sector : 'autre',
    productsDescription: text(a.productsDescription, 3, 600, 'Produits à présenter'),
    country,
    onScreenPhone: text(a.onScreenPhone, 3, 60, 'Numéro affiché'),
    liveGoal: typeof a.liveGoal === 'string' ? a.liveGoal.trim().slice(0, 300) : '',
    paymentMethod: method, paymentStatus: 'pending', paymentReference: id,
    totalFcfa: pack.priceFcfa, totalEur: pack.priceEur, // le prix vient toujours du serveur
    status: 'pending', regieNotes: '', googleCalendarSynced: false,
    whatsappNotificationSentClient: false, emailNotificationSentClient: false, whatsappNotificationSentRegie: false, emailNotificationSentRegie: false,
    userId: user.id, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(),
  };
  await store.insertBooking(rec); // refuse tout chevauchement avec une autre réservation

  let saved = rec;
  try {
    const { logs, flags } = await notifyBooking('created', rec, siteUrl(req), user.id);
    await store.addNotifications(logs);
    saved = (await store.updateBooking(id, flags)) || rec;
  } catch (e: any) {
    console.error('[Notifications]', e?.message || e);
  }
  res.status(201).json({ booking: publicBooking(saved) });
}));

app.post('/api/bookings/:id/cancel', wrap(async (req, res) => {
  const store = await getStore();
  const user = await requireUser(req, store);
  const b = await store.getBooking(String(req.params.id));
  if (!b || (b.userId !== user.id && !isAdmin(user))) throw new HttpError(404, 'Réservation introuvable.');
  if (!['pending', 'confirmed'].includes(b.status)) throw new HttpError(409, 'Cette réservation ne peut plus être annulée.');
  if (!isAdmin(user) && new Date(b.startsAt).getTime() - Date.now() < 72 * 3_600_000) {
    throw new HttpError(422, 'L’annulation gratuite n’est possible que jusqu’à 72 h avant le live. Contactez le studio.', 'too_late');
  }
  const cancelled = (await store.updateBooking(b.id, { status: 'cancelled' }))!;
  try {
    const { logs } = await notifyBooking('cancelled', cancelled, siteUrl(req), b.userId);
    await store.addNotifications(logs);
  } catch (e: any) {
    console.error('[Notifications]', e?.message || e);
  }
  res.json({ booking: publicBooking(cancelled) });
}));

// Actions du studio : confirmer, marquer payé, réalisé, annulé, notes.
app.patch('/api/bookings/:id', wrap(async (req, res) => {
  const store = await getStore();
  await requireAdmin(req, store);
  const b = await store.getBooking(String(req.params.id));
  if (!b) throw new HttpError(404, 'Réservation introuvable.');
  const { status, paymentStatus, regieNotes } = req.body || {};
  const patch: Partial<BookingRec> = {};
  if (status !== undefined) {
    if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) throw new HttpError(422, 'Statut invalide.');
    patch.status = status;
  }
  if (paymentStatus !== undefined) {
    if (!['pending', 'completed', 'failed'].includes(paymentStatus)) throw new HttpError(422, 'Statut de paiement invalide.');
    patch.paymentStatus = paymentStatus;
  }
  if (regieNotes !== undefined) patch.regieNotes = String(regieNotes).slice(0, 2000);

  if (patch.status && patch.status !== b.status && b.status === 'cancelled') throw new HttpError(409, 'Une réservation annulée ne peut pas être rouverte. Le client doit réserver à nouveau.');
  const saved = (await store.updateBooking(b.id, patch))!;
  if (patch.status && patch.status !== b.status && ['confirmed', 'cancelled'].includes(patch.status)) {
    try {
      const { logs } = await notifyBooking(patch.status === 'confirmed' ? 'confirmed' : 'cancelled', saved, siteUrl(req), b.userId);
      await store.addNotifications(logs);
    } catch (e: any) {
      console.error('[Notifications]', e?.message || e);
    }
  }
  res.json({ booking: publicBooking(saved) });
}));

app.get('/api/notifications', wrap(async (req, res) => {
  const store = await getStore();
  const user = await requireUser(req, store);
  const list = await store.listNotifications(isAdmin(user) ? undefined : user.id);
  res.json(list.map(({ userId, ...n }) => n));
}));

/* ───────── Erreurs ───────── */
app.use('/api', (_req, res) => res.status(404).json({ error: 'Ressource introuvable.' }));
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, code: err.code });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Requête illisible.' });
  console.error('[Erreur]', err?.message || err);
  res.status(500).json({ error: 'Une erreur est survenue. Réessayez dans un instant.' });
});

