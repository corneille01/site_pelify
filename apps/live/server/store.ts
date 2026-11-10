// Stockage : PostgreSQL (Neon) quand DATABASE_URL est défini, mémoire sinon (développement uniquement).
import { neon } from '@neondatabase/serverless';
import type { Booking, NotificationLog, UserAccount } from '../src/types';
import { HttpError, isProduction } from './security';

export interface UserRec {
  id: string;
  email: string;
  phoneKey: string;
  passwordHash: string;
  verifiedAt: string | null;
  failedLogins: number;
  lockedUntil: number;
  profile: Omit<UserAccount, 'password'>;
}
export interface CodeRec {
  hash: string;
  expiresAt: number;
  attempts: number;
  purpose: 'login' | 'register' | 'recover';
  sentAt: number;
}
export interface BookingRec extends Booking {
  userId: string;
  startsAt: string;
  endsAt: string;
}
export interface Busy {
  date: string;
  slotTime: string;
  slotEndTime: string;
  startsAt: string;
  endsAt: string;
}
export type NotifRec = NotificationLog & { userId?: string; status?: string };

export interface Store {
  kind: 'neon' | 'memory';
  init(): Promise<void>;
  findUserByEmail(email: string): Promise<UserRec | null>;
  findUserByPhoneKey(key: string): Promise<UserRec | null>;
  getUser(id: string): Promise<UserRec | null>;
  saveUser(u: UserRec): Promise<void>;
  deleteUser(id: string): Promise<void>;
  setCode(userId: string, c: CodeRec): Promise<void>;
  getCode(userId: string): Promise<CodeRec | null>;
  deleteCode(userId: string): Promise<void>;
  busy(): Promise<Busy[]>;
  insertBooking(b: BookingRec): Promise<void>;
  getBooking(id: string): Promise<BookingRec | null>;
  updateBooking(id: string, patch: Partial<BookingRec>): Promise<BookingRec | null>;
  listBookings(userId?: string): Promise<BookingRec[]>;
  addNotifications(list: NotifRec[]): Promise<void>;
  listNotifications(userId?: string): Promise<NotifRec[]>;
}

const ACTIVE = ['pending', 'confirmed', 'completed'];
const slotTaken = () => new HttpError(409, 'Ce créneau vient d’être réservé. Choisissez-en un autre.', 'slot_taken');
const toBusy = (b: BookingRec): Busy => ({ date: b.date, slotTime: b.slotTime, slotEndTime: b.slotEndTime, startsAt: b.startsAt, endsAt: b.endsAt });

/* ───────────────────────── Mémoire ───────────────────────── */
function memoryStore(): Store {
  const users = new Map<string, UserRec>();
  const codes = new Map<string, CodeRec>();
  const bookings = new Map<string, BookingRec>();
  let notifs: NotifRec[] = [];
  return {
    kind: 'memory',
    async init() {},
    async findUserByEmail(email) { return [...users.values()].find((u) => u.email === email) || null; },
    async findUserByPhoneKey(key) { return [...users.values()].find((u) => u.phoneKey === key) || null; },
    async getUser(id) { return users.get(id) || null; },
    async saveUser(u) { users.set(u.id, u); },
    async deleteUser(id) { users.delete(id); codes.delete(id); },
    async setCode(id, c) { codes.set(id, c); },
    async getCode(id) { return codes.get(id) || null; },
    async deleteCode(id) { codes.delete(id); },
    async busy() {
      const now = new Date().toISOString();
      return [...bookings.values()].filter((b) => ACTIVE.includes(b.status) && b.endsAt > now).map(toBusy);
    },
    async insertBooking(b) {
      for (const x of bookings.values()) {
        if (ACTIVE.includes(x.status) && x.startsAt < b.endsAt && b.startsAt < x.endsAt) throw slotTaken();
      }
      bookings.set(b.id, b);
    },
    async getBooking(id) { return bookings.get(id) || null; },
    async updateBooking(id, patch) {
      const b = bookings.get(id);
      if (!b) return null;
      Object.assign(b, patch);
      return b;
    },
    async listBookings(userId) {
      return [...bookings.values()].filter((b) => !userId || b.userId === userId).sort((a, b) => (a.startsAt < b.startsAt ? 1 : -1));
    },
    async addNotifications(list) { notifs = [...list, ...notifs].slice(0, 1000); },
    async listNotifications(userId) { return notifs.filter((n) => !userId || n.userId === userId); },
  };
}

/* ───────────────────────── PostgreSQL (Neon) ───────────────────────── */
function neonStore(url: string): Store {
  const sql = neon(url);
  const q = (text: string, params: any[] = []) => (sql as any).query(text, params) as Promise<any[]>;
  const toUser = (r: any): UserRec | null =>
    r && {
      id: r.id, email: r.email, phoneKey: r.phone_key, passwordHash: r.password_hash,
      verifiedAt: r.verified_at ? new Date(r.verified_at).toISOString() : null,
      failedLogins: Number(r.failed_logins), lockedUntil: Number(r.locked_until), profile: r.profile,
    };
  const toBooking = (r: any): BookingRec | null => r && { ...r.data, userId: r.user_id, startsAt: new Date(r.starts_at).toISOString(), endsAt: new Date(r.ends_at).toISOString(), status: r.status };

  return {
    kind: 'neon',
    async init() {
      await q(`CREATE TABLE IF NOT EXISTS ocd_users (
        id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, phone_key TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
        verified_at TIMESTAMPTZ, failed_logins INT NOT NULL DEFAULT 0, locked_until BIGINT NOT NULL DEFAULT 0,
        profile JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
      await q(`CREATE TABLE IF NOT EXISTS ocd_auth_codes (
        user_id TEXT PRIMARY KEY, hash TEXT NOT NULL, expires_at BIGINT NOT NULL, attempts INT NOT NULL DEFAULT 0,
        purpose TEXT NOT NULL, sent_at BIGINT NOT NULL)`);
      await q(`CREATE TABLE IF NOT EXISTS ocd_bookings (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES ocd_users(id), starts_at TIMESTAMPTZ NOT NULL,
        ends_at TIMESTAMPTZ NOT NULL, status TEXT NOT NULL, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT ocd_bookings_no_overlap EXCLUDE USING gist (tstzrange(starts_at, ends_at) WITH &&)
          WHERE (status IN ('pending','confirmed','completed')))`);
      await q(`CREATE TABLE IF NOT EXISTS ocd_notifications (
        id TEXT PRIMARY KEY, user_id TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), data JSONB NOT NULL)`);
    },
    async findUserByEmail(email) { return toUser((await q('SELECT * FROM ocd_users WHERE email = $1', [email]))[0]); },
    async findUserByPhoneKey(key) { return toUser((await q('SELECT * FROM ocd_users WHERE phone_key = $1', [key]))[0]); },
    async getUser(id) { return toUser((await q('SELECT * FROM ocd_users WHERE id = $1', [id]))[0]); },
    async saveUser(u) {
      await q(
        `INSERT INTO ocd_users (id, email, phone_key, password_hash, verified_at, failed_logins, locked_until, profile)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO UPDATE SET email=$2, phone_key=$3, password_hash=$4, verified_at=$5, failed_logins=$6, locked_until=$7, profile=$8`,
        [u.id, u.email, u.phoneKey, u.passwordHash, u.verifiedAt, u.failedLogins, u.lockedUntil, JSON.stringify(u.profile)],
      );
    },
    async deleteUser(id) {
      await q('DELETE FROM ocd_auth_codes WHERE user_id = $1', [id]);
      await q('DELETE FROM ocd_users WHERE id = $1 AND verified_at IS NULL', [id]);
    },
    async setCode(id, c) {
      await q(
        `INSERT INTO ocd_auth_codes (user_id, hash, expires_at, attempts, purpose, sent_at) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (user_id) DO UPDATE SET hash=$2, expires_at=$3, attempts=$4, purpose=$5, sent_at=$6`,
        [id, c.hash, c.expiresAt, c.attempts, c.purpose, c.sentAt],
      );
    },
    async getCode(id) {
      const r = (await q('SELECT * FROM ocd_auth_codes WHERE user_id = $1', [id]))[0];
      return r ? { hash: r.hash, expiresAt: Number(r.expires_at), attempts: Number(r.attempts), purpose: r.purpose, sentAt: Number(r.sent_at) } : null;
    },
    async deleteCode(id) { await q('DELETE FROM ocd_auth_codes WHERE user_id = $1', [id]); },
    async busy() {
      const rows = await q(`SELECT data, starts_at, ends_at FROM ocd_bookings WHERE status = ANY($1) AND ends_at > now()`, [ACTIVE]);
      return rows.map((r) => ({ date: r.data.date, slotTime: r.data.slotTime, slotEndTime: r.data.slotEndTime, startsAt: new Date(r.starts_at).toISOString(), endsAt: new Date(r.ends_at).toISOString() }));
    },
    async insertBooking(b) {
      const { userId, startsAt, endsAt, ...data } = b;
      try {
        await q('INSERT INTO ocd_bookings (id, user_id, starts_at, ends_at, status, data) VALUES ($1,$2,$3,$4,$5,$6)', [b.id, userId, startsAt, endsAt, b.status, JSON.stringify(data)]);
      } catch (e: any) {
        if (e?.code === '23P01') throw slotTaken();
        throw e;
      }
    },
    async getBooking(id) { return toBooking((await q('SELECT * FROM ocd_bookings WHERE id = $1', [id]))[0]); },
    async updateBooking(id, patch) {
      const cur = await this.getBooking(id);
      if (!cur) return null;
      const next = { ...cur, ...patch };
      const { userId, startsAt, endsAt, ...data } = next;
      await q('UPDATE ocd_bookings SET status = $2, data = $3 WHERE id = $1', [id, next.status, JSON.stringify(data)]);
      return next;
    },
    async listBookings(userId) {
      const rows = userId
        ? await q('SELECT * FROM ocd_bookings WHERE user_id = $1 ORDER BY starts_at DESC', [userId])
        : await q('SELECT * FROM ocd_bookings ORDER BY starts_at DESC LIMIT 500');
      return rows.map((r) => toBooking(r)!);
    },
    async addNotifications(list) {
      for (const n of list) {
        const { userId, ...data } = n;
        await q('INSERT INTO ocd_notifications (id, user_id, data) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING', [n.id, userId ?? null, JSON.stringify(data)]);
      }
    },
    async listNotifications(userId) {
      const rows = userId
        ? await q('SELECT * FROM ocd_notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200', [userId])
        : await q('SELECT * FROM ocd_notifications ORDER BY created_at DESC LIMIT 300');
      return rows.map((r) => ({ ...r.data, userId: r.user_id ?? undefined }));
    },
  };
}

/* ───────────────────────── Accès ───────────────────────── */
let cached: Promise<Store> | null = null;

/** Un échec de connexion n'est jamais masqué par un repli sur la mémoire : le service répond 503 et réessaie à la requête suivante. */
export function getStore(): Promise<Store> {
  if (cached) return cached;
  const url = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || '';
  if (!url && isProduction()) return Promise.reject(new HttpError(503, 'Service indisponible. Réessayez dans quelques minutes.'));
  const store = url ? neonStore(url) : memoryStore();
  const ready = store.init().then(
    () => store,
    (e) => {
      console.error('[Stockage] initialisation impossible :', e?.message || e);
      cached = null;
      throw new HttpError(503, 'Service indisponible. Réessayez dans quelques minutes.');
    },
  );
  cached = ready;
  return ready;
}
