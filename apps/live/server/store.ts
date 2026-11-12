// Stockage : PostgreSQL (Neon) quand DATABASE_URL est défini, mémoire sinon (développement uniquement).
import { neon } from '@neondatabase/serverless';
import type { AppNotification, ArenaEvent, PartStatus, UserAccount } from '../src/types';
import { HttpError, isProduction } from './security';

export interface UserRec {
  id: string;
  email: string;
  phoneKey: string;
  passwordHash: string;
  verifiedAt: string | null;
  failedLogins: number;
  lockedUntil: number;
  disabled?: boolean;
  profile: UserAccount;
}
export interface CodeRec {
  hash: string;
  expiresAt: number;
  attempts: number;
  purpose: 'login' | 'register' | 'recover';
  sentAt: number;
}
export interface PartRec {
  eventId: string;
  userId: string;
  pseudo: string;
  status: PartStatus;
  createdAt: string;
}
export interface ReportRec {
  id: string;
  createdAt: string;
  targetType: 'event' | 'user';
  targetId: string;
  targetLabel: string;
  reason: string;
  reporterId: string;
  reporter: string;
  status: 'open' | 'resolved';
}
export type NotifRec = AppNotification & { userId: string };

export interface Store {
  kind: 'neon' | 'memory';
  init(): Promise<void>;
  findUserByEmail(email: string): Promise<UserRec | null>;
  findUserByPhoneKey(key: string): Promise<UserRec | null>;
  getUser(id: string): Promise<UserRec | null>;
  saveUser(u: UserRec): Promise<void>;
  deleteUser(id: string): Promise<void>;
  eraseUser(id: string): Promise<void>;
  listUsers(): Promise<UserRec[]>;
  setCode(userId: string, c: CodeRec): Promise<void>;
  getCode(userId: string): Promise<CodeRec | null>;
  deleteCode(userId: string): Promise<void>;

  saveEvent(e: ArenaEvent): Promise<void>;
  getEvent(id: string): Promise<ArenaEvent | null>;
  listEvents(): Promise<ArenaEvent[]>;
  /** Inscription atomique : refuse si l'événement est complet ou si le joueur est déjà inscrit. */
  joinEvent(p: PartRec, max: number): Promise<'ok' | 'full' | 'exists'>;
  getPart(eventId: string, userId: string): Promise<PartRec | null>;
  setPart(eventId: string, userId: string, status: PartStatus): Promise<void>;
  listParts(eventId: string): Promise<PartRec[]>;
  listPartsOfUser(userId: string): Promise<PartRec[]>;
  countsByEvent(): Promise<Record<string, number>>;

  addReport(r: ReportRec): Promise<void>;
  listReports(): Promise<ReportRec[]>;
  resolveReport(id: string): Promise<void>;
  addNotifications(list: NotifRec[]): Promise<void>;
  listNotifications(userId: string): Promise<NotifRec[]>;
  markRead(userId: string, id?: string): Promise<void>;
  audit(actor: string, action: string, target: string): Promise<void>;
}

const TAKEN = ['pending', 'accepted'];

/* ───────────────────────── Mémoire ───────────────────────── */
function memoryStore(): Store {
  const users = new Map<string, UserRec>();
  const codes = new Map<string, CodeRec>();
  const events = new Map<string, ArenaEvent>();
  const parts = new Map<string, PartRec>();
  const reports = new Map<string, ReportRec>();
  let notifs: NotifRec[] = [];
  const pk = (e: string, u: string) => `${e}:${u}`;
  return {
    kind: 'memory',
    async init() {},
    async findUserByEmail(email) { return [...users.values()].find((u) => u.email === email) || null; },
    async findUserByPhoneKey(key) { return [...users.values()].find((u) => u.phoneKey === key) || null; },
    async getUser(id) { return users.get(id) || null; },
    async saveUser(u) { users.set(u.id, u); },
    async deleteUser(id) { codes.delete(id); const u = users.get(id); if (u && !u.verifiedAt) users.delete(id); },
    async eraseUser(id) {
      users.delete(id); codes.delete(id);
      for (const [k, p] of parts) if (p.userId === id) parts.delete(k);
      notifs = notifs.filter((n) => n.userId !== id);
    },
    async listUsers() { return [...users.values()]; },
    async setCode(id, c) { codes.set(id, c); },
    async getCode(id) { return codes.get(id) || null; },
    async deleteCode(id) { codes.delete(id); },

    async saveEvent(e) { events.set(e.id, e); },
    async getEvent(id) { return events.get(id) || null; },
    async listEvents() { return [...events.values()]; },
    async joinEvent(p, max) {
      const cur = parts.get(pk(p.eventId, p.userId));
      if (cur && cur.status !== 'withdrawn') return 'exists';
      const taken = [...parts.values()].filter((x) => x.eventId === p.eventId && TAKEN.includes(x.status)).length;
      if (taken >= max) return 'full';
      parts.set(pk(p.eventId, p.userId), p);
      return 'ok';
    },
    async getPart(e, u) { return parts.get(pk(e, u)) || null; },
    async setPart(e, u, status) { const p = parts.get(pk(e, u)); if (p) p.status = status; },
    async listParts(e) { return [...parts.values()].filter((p) => p.eventId === e); },
    async listPartsOfUser(u) { return [...parts.values()].filter((p) => p.userId === u); },
    async countsByEvent() {
      const out: Record<string, number> = {};
      for (const p of parts.values()) if (TAKEN.includes(p.status)) out[p.eventId] = (out[p.eventId] || 0) + 1;
      return out;
    },

    async addReport(r) { reports.set(r.id, r); },
    async listReports() { return [...reports.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)); },
    async resolveReport(id) { const r = reports.get(id); if (r) r.status = 'resolved'; },
    async addNotifications(list) { notifs = [...list, ...notifs].slice(0, 2000); },
    async listNotifications(userId) { return notifs.filter((n) => n.userId === userId).slice(0, 100); },
    async markRead(userId, id) { for (const n of notifs) if (n.userId === userId && (!id || n.id === id)) n.read = true; },
    async audit(actor, action, target) { console.log(`[journal] ${actor} ${action} ${target}`); },
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
      failedLogins: Number(r.failed_logins), lockedUntil: Number(r.locked_until), disabled: Boolean(r.profile?.disabled), profile: r.profile,
    };
  const toPart = (r: any): PartRec => ({ eventId: r.item_id, userId: r.user_id, pseudo: r.pseudo, status: r.status, createdAt: new Date(r.created_at).toISOString() });
  const toReport = (r: any): ReportRec => ({ ...r.data, id: r.id, status: r.status, createdAt: new Date(r.created_at).toISOString() });

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
      await q(`CREATE TABLE IF NOT EXISTS ocd_notifications (
        id TEXT PRIMARY KEY, user_id TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), data JSONB NOT NULL)`);
      await q(`CREATE TABLE IF NOT EXISTS arena_events (
        id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, starts_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), data JSONB NOT NULL)`);
      await q(`CREATE TABLE IF NOT EXISTS arena_parts (
        item_id TEXT NOT NULL, user_id TEXT NOT NULL, pseudo TEXT NOT NULL, status TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (item_id, user_id))`);
      await q(`CREATE TABLE IF NOT EXISTS arena_reports (
        id TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'open', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), data JSONB NOT NULL)`);
      await q(`CREATE TABLE IF NOT EXISTS arena_audit (
        id BIGSERIAL PRIMARY KEY, at TIMESTAMPTZ NOT NULL DEFAULT now(), actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL)`);
    },
    async findUserByEmail(email) { return toUser((await q('SELECT * FROM ocd_users WHERE email = $1', [email]))[0]); },
    async findUserByPhoneKey(key) { return toUser((await q('SELECT * FROM ocd_users WHERE phone_key = $1', [key]))[0]); },
    async getUser(id) { return toUser((await q('SELECT * FROM ocd_users WHERE id = $1', [id]))[0]); },
    async saveUser(u) {
      const profile = { ...u.profile, ...(u.disabled ? { disabled: true } : {}) };
      await q(
        `INSERT INTO ocd_users (id, email, phone_key, password_hash, verified_at, failed_logins, locked_until, profile)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO UPDATE SET email=$2, phone_key=$3, password_hash=$4, verified_at=$5, failed_logins=$6, locked_until=$7, profile=$8`,
        [u.id, u.email, u.phoneKey, u.passwordHash, u.verifiedAt, u.failedLogins, u.lockedUntil, JSON.stringify(profile)],
      );
    },
    async deleteUser(id) {
      await q('DELETE FROM ocd_auth_codes WHERE user_id = $1', [id]);
      await q('DELETE FROM ocd_users WHERE id = $1 AND verified_at IS NULL', [id]);
    },
    async eraseUser(id) {
      await q('DELETE FROM arena_parts WHERE user_id = $1', [id]);
      await q('DELETE FROM ocd_notifications WHERE user_id = $1', [id]);
      await q('DELETE FROM ocd_auth_codes WHERE user_id = $1', [id]);
      await q('DELETE FROM ocd_users WHERE id = $1', [id]);
    },
    async listUsers() { return (await q('SELECT * FROM ocd_users ORDER BY created_at DESC LIMIT 500')).map((r) => toUser(r)!); },
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

    async saveEvent(e) {
      await q(
        `INSERT INTO arena_events (id, owner_id, starts_at, data) VALUES ($1,$2,$3,$4)
         ON CONFLICT (id) DO UPDATE SET starts_at=$3, data=$4`,
        [e.id, e.ownerId, e.startsAt, JSON.stringify(e)],
      );
    },
    async getEvent(id) { const r = (await q('SELECT data FROM arena_events WHERE id = $1', [id]))[0]; return r ? r.data : null; },
    async listEvents() { return (await q('SELECT data FROM arena_events ORDER BY created_at DESC LIMIT 1000')).map((r) => r.data); },
    async joinEvent(p, max) {
      const rows = await q(
        `INSERT INTO arena_parts (item_id, user_id, pseudo, status)
         SELECT $1,$2,$3,$4 WHERE (SELECT count(*) FROM arena_parts WHERE item_id = $1 AND status IN ('pending','accepted')) < $5
         ON CONFLICT (item_id, user_id) DO UPDATE SET status = EXCLUDED.status, pseudo = EXCLUDED.pseudo, created_at = now()
           WHERE arena_parts.status = 'withdrawn'
         RETURNING user_id`,
        [p.eventId, p.userId, p.pseudo, p.status, max],
      );
      if (rows.length) return 'ok';
      const cur = await this.getPart(p.eventId, p.userId);
      return cur && cur.status !== 'withdrawn' ? 'exists' : 'full';
    },
    async getPart(e, u) { const r = (await q('SELECT * FROM arena_parts WHERE item_id = $1 AND user_id = $2', [e, u]))[0]; return r ? toPart(r) : null; },
    async setPart(e, u, status) { await q('UPDATE arena_parts SET status = $3 WHERE item_id = $1 AND user_id = $2', [e, u, status]); },
    async listParts(e) { return (await q('SELECT * FROM arena_parts WHERE item_id = $1 ORDER BY created_at', [e])).map(toPart); },
    async listPartsOfUser(u) { return (await q('SELECT * FROM arena_parts WHERE user_id = $1', [u])).map(toPart); },
    async countsByEvent() {
      const out: Record<string, number> = {};
      for (const r of await q(`SELECT item_id, count(*) AS n FROM arena_parts WHERE status IN ('pending','accepted') GROUP BY item_id`)) out[r.item_id] = Number(r.n);
      return out;
    },

    async addReport(r) {
      const { id, status, createdAt, ...data } = r;
      await q('INSERT INTO arena_reports (id, status, data) VALUES ($1,$2,$3)', [id, status, JSON.stringify(data)]);
    },
    async listReports() { return (await q('SELECT * FROM arena_reports ORDER BY created_at DESC LIMIT 300')).map(toReport); },
    async resolveReport(id) { await q(`UPDATE arena_reports SET status = 'resolved' WHERE id = $1`, [id]); },
    async addNotifications(list) {
      for (const n of list) {
        const { userId, id, ...data } = n;
        await q('INSERT INTO ocd_notifications (id, user_id, data) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING', [id, userId, JSON.stringify(data)]);
      }
    },
    async listNotifications(userId) {
      const rows = await q('SELECT * FROM ocd_notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100', [userId]);
      return rows.filter((r) => r.data?.title).map((r) => ({ ...r.data, id: r.id, userId: r.user_id, read: Boolean(r.data.read) }));
    },
    async markRead(userId, id) {
      if (id) await q(`UPDATE ocd_notifications SET data = jsonb_set(data, '{read}', 'true') WHERE user_id = $1 AND id = $2`, [userId, id]);
      else await q(`UPDATE ocd_notifications SET data = jsonb_set(data, '{read}', 'true') WHERE user_id = $1`, [userId]);
    },
    async audit(actor, action, target) { await q('INSERT INTO arena_audit (actor, action, target) VALUES ($1,$2,$3)', [actor, action, target]); },
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
