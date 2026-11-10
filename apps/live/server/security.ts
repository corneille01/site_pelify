import crypto from 'node:crypto';
import { promisify } from 'node:util';
import type { NextFunction, Request, Response } from 'express';

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export class HttpError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const isProduction = () => process.env.NODE_ENV === 'production';

/** Secret de signature des sessions. Obligatoire en production. */
function secret(): string {
  const s = process.env.SESSION_SECRET || '';
  if (s.length >= 16) return s;
  if (isProduction()) throw new Error('SESSION_SECRET (16 caractères minimum) est obligatoire en production.');
  return 'secret-de-developpement-uniquement';
}

export function assertSecurityConfig(): void {
  secret();
}

/* ───────── Mots de passe ───────── */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `s1$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [version, saltB64, keyB64] = String(stored || '').split('$');
  if (version !== 's1' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

let dummyHash: string | undefined;
/** Même durée de calcul quand l'identifiant n'existe pas, pour ne pas révéler les comptes. */
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= await hashPassword('mot-de-passe-factice');
  await verifyPassword(password, dummyHash);
}

/* ───────── Jetons signés (session, défi de connexion, réinitialisation) ───────── */
export type TokenKind = 'session' | 'challenge' | 'reset';

const b64 = (buf: Buffer | string) => Buffer.from(buf).toString('base64url');
const hmac = (data: string) => crypto.createHmac('sha256', secret()).update(data).digest('base64url');

export function signToken(kind: TokenKind, sub: string, ttlSeconds: number, extra: Record<string, string> = {}): string {
  const payload = b64(JSON.stringify({ k: kind, sub, exp: Math.floor(Date.now() / 1000) + ttlSeconds, ...extra }));
  return `${payload}.${hmac(payload)}`;
}

export function verifyToken(kind: TokenKind, token: unknown): { sub: string; [k: string]: any } | null {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = hmac(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.k !== kind || typeof data.sub !== 'string' || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

/* ───────── Codes à 6 chiffres ───────── */
export const generateCode = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
export const hashCode = (userId: string, code: string) => crypto.createHash('sha256').update(`${secret()}:${userId}:${code}`).digest('hex');
export function sameHash(a: string, b: string): boolean {
  return a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/* ───────── Cookies ───────── */
export const SESSION_COOKIE = 'ocd_session';
export const SESSION_DAYS = 30;

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function setSessionCookie(req: Request, res: Response, userId: string): void {
  const secure = isProduction() || req.secure || req.headers['x-forwarded-proto'] === 'https';
  const token = signToken('session', userId, SESSION_DAYS * 86400);
  res.append('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure ? '; Secure' : ''}`);
}

export function clearSessionCookie(res: Response): void {
  res.append('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export const sessionUserId = (req: Request): string | null =>
  verifyToken('session', parseCookies(req.headers.cookie)[SESSION_COOKIE])?.sub ?? null;

/* ───────── Limitation de débit (mémoire) ───────── */
const hits = new Map<string, number[]>();
export function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return false;
}

/* ───────── Protection contre les requêtes venues d'un autre site ───────── */
export function sameOriginOnly(req: Request, _res: Response, next: NextFunction): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (origin) {
    let host = '';
    try {
      host = new URL(origin).host;
    } catch {
      /* origine illisible */
    }
    const expected = (req.headers['x-forwarded-host'] as string) || req.headers.host;
    if (!host || host !== expected) return next(new HttpError(403, 'Origine de la requête refusée.'));
  }
  next();
}

/* ───────── Numéros ───────── */
export const DEFAULT_COUNTRY_CODE = process.env.DEFAULT_COUNTRY_CODE || '+228';

/** Clé unique d'un numéro : indicatif + chiffres sans le 0 initial. */
export function phoneKey(countryCode: string, phone: string): string {
  const cc = `+${String(countryCode || DEFAULT_COUNTRY_CODE).replace(/\D/g, '')}`;
  return `${cc}${String(phone || '').replace(/\D/g, '').replace(/^0+/, '')}`;
}

/** Interprète un identifiant de connexion : e-mail ou numéro (avec ou sans indicatif). */
export function parseIdentifier(raw: string): { email?: string; phoneKey?: string } {
  const s = String(raw || '').trim();
  if (s.includes('@')) return { email: s.toLowerCase() };
  const digits = s.replace(/\D/g, '');
  if (digits.length < 6) return {};
  if (s.startsWith('+') || s.startsWith('00')) return { phoneKey: `+${s.startsWith('00') ? digits.slice(2) : digits}` };
  return { phoneKey: phoneKey(DEFAULT_COUNTRY_CODE, digits) };
}
