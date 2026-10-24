/* Evidence Fit — Zugang, Abo, Einwilligung (24.10.2026). */
import { decidePlan, filterDay, cleanConsent, verifyIdToken, verifyStripe, handleAccess } from '../worker/access.js';
import { periodEnd } from '../worker/access.js';
import { summarize, isAdminEmail } from '../worker/admin.js';
import { handleAdmin } from '../worker/admin.js';
import { webcrypto } from 'node:crypto';
const subtle = globalThis.crypto.subtle || webcrypto.subtle;
let fail = 0;
const t = async (n, f) => { try { await f(); console.log('✓ ' + n); } catch (e) { fail++; console.log('✗ ' + n + ' → ' + e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m || 'assertion'); };
const now = 1792800000000;

await t('plan: own active subscription wins', () => ok(decidePlan({ active: true, until: now + 1 }, null, null, now) === 'fit'));
await t('plan: expired subscription does not count', () => ok(decidePlan({ active: true, until: now - 1 }, null, null, now) === 'free'));
await t('plan: linked Evidence Pro gives access', () => ok(decidePlan(null, { evidenceUid: 'x' }, { plan: 'pro' }, now) === 'evidence-pro'));
await t('plan: linked Evidence trial counts as Pro', () => ok(decidePlan(null, { evidenceUid: 'x' }, { trialUntil: Date.now() + 9e6 }, now) === 'evidence-pro'));
await t('plan: linked but Evidence free → free', () => ok(decidePlan(null, { evidenceUid: 'x' }, { plan: 'free' }, now) === 'free'));
await t('plan: nothing → free', () => ok(decidePlan(null, null, null, now) === 'free'));

const day = { date: '2026-10-23', sleepH: 6.5, readiness: 61, rhr: 52, hrv: 70, kcal: 2400, protein: 160, carbs: 220, fat: 80,
  waterMl: 2500, caffeineMg: 200, alcoholDrinks: 2, trained: true, tonnage: 12000, sessions: 1, weightKg: 82.4, notes: 'secret', photo: 'x' };
await t('consent: only granted categories leave the app', () => {
  const f = filterDay(day, { sleep: true, nutrition: false, training: false, body: false });
  ok(f.sleepH === 6.5 && f.readiness === 61, 'sleep kept');
  ok(!('kcal' in f) && !('weightKg' in f) && !('trained' in f), JSON.stringify(f));
});
await t('consent: unknown fields never pass (notes, photos)', () => {
  const f = filterDay(day, { sleep: true, nutrition: true, training: true, body: true });
  ok(!('notes' in f) && !('photo' in f), JSON.stringify(f));
  ok(f.trained === true && f.weightKg === 82.4 && f.alcoholDrinks === 2, 'all granted kept');
});
await t('consent: no consent → nothing written', () => ok(filterDay(day, {}) === null && filterDay(day, null) === null));
await t('consent: bad date is refused', () => ok(filterDay({ date: '23.10.2026', sleepH: 7 }, { sleep: true }) === null));
await t('consent: only true counts', () => { const c = cleanConsent({ sleep: 'yes', body: true, x: true }); ok(c.sleep === false && c.body === true && !('x' in c)); });

// Firebase-ID-Token: echte RS256-Signatur mit eigenem Schlüssel
const kp = await subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = Object.assign(await subtle.exportKey('jwk', kp.publicKey), { kid: 'k1' });
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const mk = async (pay, kid = 'k1') => { const u = b64({ alg: 'RS256', kid }) + '.' + b64(pay); const s = Buffer.from(await subtle.sign('RSASSA-PKCS1-v1_5', kp.privateKey, new TextEncoder().encode(u))).toString('base64url'); return u + '.' + s; };
const sec = Math.floor(Date.now() / 1000);
const good = { aud: 'fitness-64dbc', iss: 'https://securetoken.google.com/fitness-64dbc', sub: 'u1', iat: sec, exp: sec + 600, email: 'a@b.c' };
await t('id token: valid one is accepted', async () => { const r = await verifyIdToken(await mk(good), 'fitness-64dbc', [jwk]); ok(r && r.uid === 'u1'); });
await t('id token: other project is refused', async () => ok(await verifyIdToken(await mk(Object.assign({}, good, { aud: 'evil' })), 'fitness-64dbc', [jwk]) === null));
await t('id token: expired is refused', async () => ok(await verifyIdToken(await mk(Object.assign({}, good, { exp: sec - 1 })), 'fitness-64dbc', [jwk]) === null));
await t('id token: tampered payload is refused', async () => { const tk = (await mk(good)).split('.'); tk[1] = b64(Object.assign({}, good, { sub: 'admin' })); ok(await verifyIdToken(tk.join('.'), 'fitness-64dbc', [jwk]) === null); });

// Stripe-Signatur
const secret = 'whsec_test', body = '{"id":"evt_1"}', ts = String(sec);
const key = await subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
const v1 = Buffer.from(await subtle.sign('HMAC', key, new TextEncoder().encode(ts + '.' + body))).toString('hex');
await t('stripe: valid signature passes', async () => ok(await verifyStripe(body, 't=' + ts + ',v1=' + v1, secret, sec)));
await t('stripe: wrong body fails', async () => ok(!(await verifyStripe(body + 'x', 't=' + ts + ',v1=' + v1, secret, sec))));
await t('stripe: old timestamp fails (replay)', async () => ok(!(await verifyStripe(body, 't=' + ts + ',v1=' + v1, secret, sec + 3600))));

// § 312k: Kündigung ohne Login — gleiche Antwort ohne Stripe/Mail, kaputte Adresse abgelehnt
const req = (path, body) => new Request('https://w' + path, { method: 'POST', body: JSON.stringify(body) });
await t('cancel: works without login, same answer', async () => {
  const r = await handleAccess(req('/api/cancel', { email: 'a@b.de' }), {}, {});
  const d = await r.json(); ok(r.status === 200 && d.ok && d.receivedAt, JSON.stringify(d));
});
await t('cancel: bad email → 400', async () => ok((await handleAccess(req('/api/cancel', { email: 'nope' }), {}, {})).status === 400));
await t('checkout: still needs login', async () => ok((await handleAccess(req('/api/billing/checkout', { waiver: true }), {}, {})).status === 401));

// Admin
await t('admin: only listed emails', () => ok(isAdminEmail({}, 'JasonZiborius@gmail.com') && !isAdminEmail({}, 'x@y.de') && isAdminEmail({ ADMIN_EMAILS: 'a@b.de, c@d.de' }, 'c@d.de') && !isAdminEmail({}, '')));
await t('admin: no token → 401', async () => ok((await handleAdmin(new Request('https://w/api/admin/users'), {}, {})).status === 401));
await t('admin: summary from state', () => {
  const r = summarize(JSON.stringify({ profile: { name: 'A', ziel: 'Diät' }, meals: { '2026-10-01': [], '2026-10-03': [] }, logs: [{ date: '2026-10-05T08:00' }], biometrics: [{}] }));
  ok(r.name === 'A' && r.mealDays === 2 && r.workouts === 1 && r.bio === 1 && r.lastDay === '2026-10-05', JSON.stringify(r));
});
await t('admin: broken state does not crash', () => ok(summarize('{kaputt').bytes === 7 && summarize('').bytes === 0));

await t('stripe: period end from items (new API) or top level (old)', () => ok(periodEnd({ items: { data: [{ current_period_end: 2000 }] } }) === 2e6 && periodEnd({ current_period_end: 1000 }) === 1e6 && periodEnd(null) === 0));

await t('consent: mind category only with its own consent', () => {
  const d = { date: '2026-10-24', sleepH: 7, stress: 4, mood: 2, sick: true, bedHour: 24.5 };
  const a = filterDay(d, { sleep: true }), b = filterDay(d, { mind: true });
  ok(a.sleepH === 7 && a.bedHour === 24.5 && !('stress' in a) && !('sick' in a), JSON.stringify(a));
  ok(b.stress === 4 && b.mood === 2 && b.sick === true && !('sleepH' in b), JSON.stringify(b));
  ok(cleanConsent({ mind: true }).mind === true && cleanConsent({}).mind === false);
});

console.log(fail ? fail + ' failed' : 'Evidence Fit access: all tests passed');
process.exit(fail ? 1 : 0);
