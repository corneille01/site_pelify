// Test d'intégration : lance le vrai serveur et déroule inscription, code, réservation, conflit, annulation.
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

const tomorrow = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const D = tomorrow(10);
const activity = { businessName: 'Chez Mama Afi', sector: 'restauration', productsDescription: 'Plats togolais', country: 'Togo', onScreenPhone: '+228 90 11 22 33' };
const consents = { cgv: true, data: true, image: true };
let session, bookingId;

async function signup(email, phone, name) {
  const reg = await call('POST', '/auth/register', { fullName: name, businessName: `Commerce ${name}`, email, phone, countryCode: '+228', password: 'motdepasse-solide', channel: 'sms' });
  assert.equal(reg.status, 200, JSON.stringify(reg.data));
  const v = await call('POST', '/auth/verify', { challenge: reg.data.challenge, code: reg.data.demoCode });
  assert.equal(v.status, 200, JSON.stringify(v.data));
  return v.cookie;
}

test('les routes de données exigent une connexion', async () => {
  for (const p of ['/bookings', '/notifications']) assert.equal((await call('GET', p)).status, 401, p);
  assert.equal((await call('POST', '/bookings', {})).status, 401);
  assert.equal((await call('PATCH', '/bookings/x', { status: 'confirmed' })).status, 401);
  assert.equal((await call('POST', '/send-email', { to: 'a@b.co', subject: 's', content: 'c' })).status, 404);
  assert.equal((await call('GET', '/users')).status, 404);
});

test('le code 123456 n’ouvre aucun compte', async () => {
  const reg = await call('POST', '/auth/register', { fullName: 'Ama Kodjo', businessName: 'Faux Shop', email: 'faux@example.com', phone: '90112200', countryCode: '+228', password: 'motdepasse-solide', channel: 'sms' });
  assert.equal(reg.status, 200);
  const code = reg.data.demoCode === '123456' ? '654321' : '123456';
  const bad = await call('POST', '/auth/verify', { challenge: reg.data.challenge, code });
  assert.equal(bad.status, 401);
  assert.equal(bad.cookie, undefined);
});

test('inscription : mot de passe faible ou identique au nom du commerce refusé', async () => {
  const base = { fullName: 'Ama Kodjo', businessName: 'Ama Shop', email: 'ama2@example.com', phone: '90112244', countryCode: '+228', channel: 'sms' };
  assert.equal((await call('POST', '/auth/register', { ...base, password: 'court' })).status, 422);
  assert.equal((await call('POST', '/auth/register', { ...base, password: 'Ama Shop' })).status, 422);
});

test('inscription puis code reçu : le compte s’ouvre et la session fonctionne', async () => {
  session = await signup('ama@example.com', '90112233', 'Ama Kodjo');
  const me = await call('GET', '/auth/me', undefined, session);
  assert.equal(me.data.user.email, 'ama@example.com');
  assert.equal(me.data.user.role, 'client');
  assert.equal(me.data.user.password, undefined);
});

test('connexion : mauvais mot de passe refusé, puis code par e-mail ou par numéro', async () => {
  assert.equal((await call('POST', '/auth/login', { identifier: 'ama@example.com', password: 'faux-mot-de-passe' })).status, 401);
  assert.equal((await call('POST', '/auth/login', { identifier: 'inconnu@example.com', password: 'faux-mot-de-passe' })).status, 401);

  const byEmail = await call('POST', '/auth/login', { identifier: 'ama@example.com', password: 'motdepasse-solide', channel: 'email' });
  assert.equal(byEmail.status, 200);
  assert.equal(byEmail.data.channel, 'email');
  assert.match(byEmail.data.destination, /@/);
  assert.equal(byEmail.cookie, undefined); // pas de session avant le code
  const ok = await call('POST', '/auth/verify', { challenge: byEmail.data.challenge, code: byEmail.data.demoCode });
  assert.equal(ok.status, 200);

  await new Promise((r) => setTimeout(r, 30500)); // délai minimal entre deux codes
  const byPhone = await call('POST', '/auth/login', { identifier: '+228 90 11 22 33', password: 'motdepasse-solide', channel: 'whatsapp' });
  assert.equal(byPhone.status, 200);
  assert.equal(byPhone.data.channel, 'whatsapp');
  assert.doesNotMatch(byPhone.data.destination, /@/);
});

test('réservation : consentements, prix serveur, créneau passé et mode refusés', async () => {
  const base = { mode: 'distance', packId: 'express', date: D, slotTime: '09:00', activity, consents, paymentMethod: 'tmoney' };
  assert.equal((await call('POST', '/bookings', { ...base, consents: { cgv: true } }, session)).status, 422);
  assert.equal((await call('POST', '/bookings', { ...base, date: tomorrow(-3) }, session)).status, 422);
  assert.equal((await call('POST', '/bookings', { ...base, paymentMethod: 'onsite' }, session)).status, 422);
  assert.equal((await call('POST', '/bookings', { ...base, slotTime: '11:00' }, session)).status, 422);

  const r = await call('POST', '/bookings', { ...base, totalFcfa: 1 }, session);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.booking.status, 'pending');
  assert.equal(r.data.booking.paymentStatus, 'pending');
  assert.equal(r.data.booking.totalFcfa, 15000, 'le prix ne vient pas du navigateur');
  bookingId = r.data.booking.id;
});

test('aucun chevauchement, y compris entre un bloc de 4 h et un live de 1 h 30', async () => {
  const s2 = await signup('koffi@example.com', '91000000', 'Koffi Mensah');
  const pay = { mode: 'presentiel', date: D, activity, consents, paymentMethod: 'onsite' };
  assert.equal((await call('POST', '/bookings', { ...pay, packId: 'express', slotTime: '09:00' }, s2)).status, 409);
  assert.equal((await call('POST', '/bookings', { ...pay, packId: 'marathon', slotTime: '09:00' }, s2)).status, 409);
  const free = await call('POST', '/bookings', { ...pay, packId: 'express', slotTime: '14:00' }, s2);
  assert.equal(free.status, 201);
  assert.equal((await call('POST', '/bookings', { ...pay, packId: 'marathon', slotTime: '14:00' }, s2)).status, 409);

  const busy = (await call('GET', '/availability')).data.busy;
  assert.ok(busy.some((b) => b.date === D && b.slotTime === '09:00'));
  assert.equal(JSON.stringify(busy).includes('Koffi'), false, 'aucune donnée personnelle dans les disponibilités');
});

test('un client ne voit que ses réservations et ne peut pas agir comme le studio', async () => {
  const mine = await call('GET', '/bookings', undefined, session);
  assert.equal(mine.data.length, 1);
  assert.equal(mine.data[0].userId, undefined);
  assert.equal((await call('PATCH', `/bookings/${bookingId}`, { status: 'confirmed' }, session)).status, 403);
  const notifs = await call('GET', '/notifications', undefined, session);
  assert.ok(notifs.data.every((n) => n.recipientType === 'client'));
});

test('le studio est reconnu par sa liste d’adresses, pas par le mot « regie » dans l’e-mail', async () => {
  const fake = await signup('faux-admin@example.com', '92000001', 'Faux Studio');
  assert.equal((await call('GET', '/auth/me', undefined, fake)).data.user.role, 'client');
  assert.equal((await call('PATCH', `/bookings/${bookingId}`, { status: 'confirmed' }, fake)).status, 403);

  const studio = await signup('studio@example.com', '92000002', 'Studio');
  assert.equal((await call('GET', '/auth/me', undefined, studio)).data.user.role, 'regie_admin');
  const all = await call('GET', '/bookings', undefined, studio);
  assert.equal(all.data.length, 2);

  const conf = await call('PATCH', `/bookings/${bookingId}`, { status: 'confirmed', paymentStatus: 'completed' }, studio);
  assert.equal(conf.data.booking.status, 'confirmed');
  assert.equal(conf.data.booking.paymentStatus, 'completed');
});

test('annulation : possible à plus de 72 h, libère le créneau', async () => {
  const r = await call('POST', `/bookings/${bookingId}/cancel`, {}, session);
  assert.equal(r.status, 200);
  assert.equal(r.data.booking.status, 'cancelled');
  const busy = (await call('GET', '/availability')).data.busy;
  assert.equal(busy.some((b) => b.date === D && b.slotTime === '09:00'), false);
});

test('une origine étrangère est refusée', async () => {
  const res = await fetch(`${BASE}/api/auth/logout`, { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, body: '{}' });
  assert.equal(res.status, 403);
});
