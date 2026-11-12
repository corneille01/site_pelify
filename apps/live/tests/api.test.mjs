// Test d'intégration : lance le vrai serveur et déroule inscription, code, événements, places, participation, notifications.
// Utilisation : npm test
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const PORT = 3911;
const BASE = `http://localhost:${PORT}`;
let server;
let log = '';

async function call(method, path, body, cookie) {
  const headers = { origin: BASE };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  const res = await fetch(`${BASE}/api${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  const set = res.headers.get('set-cookie');
  return { status: res.status, data, cookie: set ? set.split(';')[0] : undefined };
}

before(async () => {
  server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'development', DATABASE_URL: '', NEON_DATABASE_URL: '', ADMIN_EMAILS: 'studio@example.com', SESSION_SECRET: 'secret-de-test-0123456789' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (d) => (log += d));
  server.stderr.on('data', (d) => (log += d));
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${BASE}/api/health`)).ok) return; } catch { /* pas encore prêt */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Serveur non démarré :\n${log}`);
});
after(() => server?.kill());


const inDays = (d, h = 20) => new Date(Date.now() + d * 86400000 + h * 3600000 - (Date.now() % 86400000)).toISOString();
const START = new Date(Date.now() + 5 * 86400000).toISOString();
const LIMIT = new Date(Date.now() + 4 * 86400000).toISOString();

async function signup(email, pseudo, extra = {}) {
  const reg = await call('POST', '/auth/register', { pseudo, email, password: 'motdepasse-solide', channel: 'email', accept: true, ...extra });
  assert.equal(reg.status, 200, JSON.stringify(reg.data));
  const v = await call('POST', '/auth/verify', { challenge: reg.data.challenge, code: reg.data.demoCode });
  assert.equal(v.status, 200, JSON.stringify(v.data));
  return { cookie: v.cookie, user: v.data.user };
}
const ev = (over = {}) => ({ title: 'Tournoi du vendredi', game: 'EA Sports FC', platform: 'PlayStation', type: 'tournoi', format: 'multi', maxPlayers: 4, startsAt: START, deadline: LIMIT, visibility: 'public', ...over });
let orga, p1, p2, p3, evId;

test('les routes de données exigent une connexion', async () => {
  for (const p of ['/notifications', '/me/events', '/admin/overview', '/me/export']) assert.equal((await call('GET', p)).status, 401, p);
  assert.equal((await call('POST', '/events', ev())).status, 401);
  assert.equal((await call('GET', '/bookings')).status, 404);
  assert.equal((await call('GET', '/users')).status, 404);
});

test('le code 123456 n’ouvre aucun compte et l’inscription exige les conditions', async () => {
  const noAccept = await call('POST', '/auth/register', { pseudo: 'Faux Pseudo', email: 'faux@example.com', password: 'motdepasse-solide', channel: 'email' });
  assert.equal(noAccept.status, 422);
  const reg = await call('POST', '/auth/register', { pseudo: 'Faux Pseudo', email: 'faux@example.com', password: 'motdepasse-solide', channel: 'email', accept: true });
  assert.equal(reg.status, 200);
  const v = await call('POST', '/auth/verify', { challenge: reg.data.challenge, code: '123456' });
  assert.equal(v.status, 401);
  assert.equal(v.cookie, undefined);
  assert.equal((await call('POST', '/auth/login', { identifier: 'faux@example.com', password: 'motdepasse-solide', channel: 'email' })).status, 401);
});

test('inscription, session et profil', async () => {
  orga = await signup('orga@example.com', 'Orga_One');
  assert.equal(orga.user.pseudo, 'Orga_One');
  const me = await call('GET', '/auth/me', undefined, orga.cookie);
  assert.equal(me.data.user.email, 'orga@example.com');
  const bad = await call('PUT', '/me', { pseudo: '<script>' }, orga.cookie);
  assert.equal(bad.status, 422);
  const ok = await call('PUT', '/me', { games: ['Valorant', 'EA Sports FC'] }, orga.cookie);
  assert.deepEqual(ok.data.user.games, ['Valorant', 'EA Sports FC']);
});

test('création d’un événement : validations côté serveur', async () => {
  assert.equal((await call('POST', '/events', ev({ link: 'http://twitch.tv/x' }), orga.cookie)).status, 422, 'http refusé');
  assert.equal((await call('POST', '/events', ev({ link: 'https://evil.example/x' }), orga.cookie)).status, 422, 'domaine refusé');
  assert.equal((await call('POST', '/events', ev({ link: 'https://twitch.tv.evil.example/x' }), orga.cookie)).status, 422, 'faux sous-domaine refusé');
  assert.equal((await call('POST', '/events', ev({ startsAt: new Date(Date.now() - 1000).toISOString() }), orga.cookie)).status, 422, 'passé refusé');
  assert.equal((await call('POST', '/events', ev({ deadline: new Date(Date.now() + 9 * 86400000).toISOString() }), orga.cookie)).status, 422, 'limite après début');
  const r = await call('POST', '/events', ev({ link: 'https://www.twitch.tv/pelify' }), orga.cookie);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  evId = r.data.event.id;
  assert.equal(r.data.event.status, 'open');
  const d = await call('POST', '/events', ev({ type: 'defi', maxPlayers: 50 }), orga.cookie);
  assert.equal(d.data.event.maxPlayers, 2, 'un défi a deux places');
});

test('la liste est publique, sans identifiant du propriétaire', async () => {
  const r = await call('GET', '/events');
  assert.equal(r.status, 200);
  const e = r.data.find((x) => x.id === evId);
  assert.ok(e);
  assert.equal(e.ownerId, '');
  const priv = await call('POST', '/events', ev({ title: 'Salon privé', visibility: 'prive' }), orga.cookie);
  assert.ok(!(await call('GET', '/events')).data.some((x) => x.id === priv.data.event.id), 'privé absent de la liste');
  assert.equal((await call('GET', `/events/${priv.data.event.id}`)).status, 200, 'privé accessible par lien');
});

test('places, doublons et organisateur', async () => {
  p1 = await signup('p1@example.com', 'Joueur1');
  p2 = await signup('p2@example.com', 'Joueur2');
  p3 = await signup('p3@example.com', 'Joueur3');
  assert.equal((await call('POST', `/events/${evId}/join`, {}, orga.cookie)).status, 403, 'organisateur refusé');
  assert.equal((await call('POST', `/events/${evId}/join`, {}, p1.cookie)).status, 200);
  assert.equal((await call('POST', `/events/${evId}/join`, {}, p1.cookie)).data.code, 'exists');
  const small = (await call('POST', '/events', ev({ title: 'Duel rapide', type: 'defi' }), orga.cookie)).data.event.id;
  const joins = await Promise.all([p1, p2, p3].map((p) => call('POST', `/events/${small}/join`, {}, p.cookie)));
  assert.equal(joins.filter((j) => j.status === 200).length, 2, 'deux places seulement, même en parallèle');
  assert.equal(joins.filter((j) => j.data.code === 'full').length, 1);
});

test('le propriétaire reçoit une notification, le lecteur peut la marquer comme lue', async () => {
  const n = await call('GET', '/notifications', undefined, orga.cookie);
  assert.ok(n.data.length >= 1 && n.data.some((x) => /Nouveau participant/.test(x.title)));
  assert.equal(n.data[0].read, false);
  await call('POST', '/notifications/read', {}, orga.cookie);
  assert.ok((await call('GET', '/notifications', undefined, orga.cookie)).data.every((x) => x.read));
  assert.equal((await call('GET', '/notifications', undefined, p3.cookie)).data.length, 0, 'chacun ne voit que les siennes');
});

test('validation des demandes par l’organisateur', async () => {
  const id = (await call('POST', '/events', ev({ title: 'Sur demande', requireApproval: true }), orga.cookie)).data.event.id;
  const j = await call('POST', `/events/${id}/join`, {}, p2.cookie);
  assert.equal(j.data.status, 'pending');
  const detail = await call('GET', `/events/${id}`, undefined, orga.cookie);
  const part = detail.data.participants[0];
  assert.equal((await call('POST', `/events/${id}/participants/${part.userId}`, { action: 'accept' }, p1.cookie)).status, 403, 'un joueur ne gère pas');
  assert.equal((await call('POST', `/events/${id}/participants/${part.userId}`, { action: 'accept' }, orga.cookie)).status, 200);
  assert.ok((await call('GET', '/notifications', undefined, p2.cookie)).data.some((x) => /acceptée/.test(x.title)));
  assert.equal((await call('GET', `/events/${id}`)).data.participants[0].userId, undefined, 'identifiant masqué au public');
});

test('annulation : participants prévenus, plus d’inscription', async () => {
  const r = await call('POST', `/events/${evId}/cancel`, {}, p1.cookie);
  assert.equal(r.status, 403);
  assert.equal((await call('POST', `/events/${evId}/cancel`, {}, orga.cookie)).data.event.status, 'cancelled');
  assert.ok((await call('GET', '/notifications', undefined, p1.cookie)).data.some((x) => /annulé/.test(x.title)));
  assert.equal((await call('POST', `/events/${evId}/join`, {}, p3.cookie)).status, 409);
});

test('signalement, administration et journal', async () => {
  assert.equal((await call('POST', '/reports', { targetType: 'event', targetId: evId, reason: 'Contenu inapproprié' }, p1.cookie)).status, 200);
  assert.equal((await call('GET', '/admin/overview', undefined, p1.cookie)).status, 403);
  const admin = await signup('studio@example.com', 'Admin_Pelify');
  const o = await call('GET', '/admin/overview', undefined, admin.cookie);
  assert.equal(o.status, 200);
  assert.ok(o.data.stats.users >= 5 && o.data.reports.length === 1);
  assert.ok(o.data.users.every((u) => u.passwordHash === undefined));
  await call('POST', `/admin/users/${p3.user ? (o.data.users.find((u) => u.email === 'p3@example.com').id) : ''}/disable`, {}, admin.cookie);
  assert.equal((await call('POST', '/events/x/join', {}, p3.cookie)).status, 403, 'compte suspendu');
});

test('export et suppression du compte', async () => {
  const ex = await call('GET', '/me/export', undefined, p2.cookie);
  assert.equal(ex.status, 200);
  assert.ok(ex.data.participations.length >= 1);
  assert.equal((await call('DELETE', '/me', { password: 'faux' }, p2.cookie)).status, 401);
  assert.equal((await call('DELETE', '/me', { password: 'motdepasse-solide' }, p2.cookie)).status, 200);
  assert.equal((await call('GET', '/auth/me', undefined, p2.cookie)).data.user, null);
  assert.equal((await call('POST', '/auth/login', { identifier: 'p2@example.com', password: 'motdepasse-solide', channel: 'email' })).status, 401);
});
