// End-to-end smoke test against a running local dev server (npm run dev) with a migrated local D1.
// Reads the local test admin from .dev.vars. Usage: node scripts/smoke-local.mjs [baseUrl]
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const base = process.argv[2] || 'http://localhost:3000';
const vars = readFileSync('.dev.vars', 'utf8');
const password = vars.match(/password: (\S+)/)?.[1];
const email = vars.match(/^ADMIN_EMAIL=(.+)$/m)?.[1].trim();
let cookie = '';
const results = [];
async function call(path, data, {auth = false, origin = base} = {}) {
  const headers = {};
  if (data !== undefined) { headers['content-type'] = 'application/json'; if (origin) headers.origin = origin; }
  if (auth && cookie) headers.cookie = cookie;
  const r = await fetch(base + '/api/' + path, {method: data === undefined ? 'GET' : 'POST', headers, body: data === undefined ? undefined : JSON.stringify(data)});
  const set = r.headers.get('set-cookie');
  if (set && auth) cookie = set.split(';')[0];
  let json = null; try { json = await r.json(); } catch {}
  return {status: r.status, json, set};
}
async function check(name, fn) {
  try { await fn(); results.push('ok   ' + name); } catch (e) { results.push('FAIL ' + name + ' :: ' + e.message); }
}
// Next free half-hour slots, a few days ahead (Istanbul 11:00 / 11:30 / 12:00).
// A random future day, so repeated runs against the same local database do not collide.
const day = new Date(Date.now() + (5 + Math.floor(Math.random() * 300)) * 86400000).toISOString().slice(0, 10);
const slot = t => new Date(`${day}T${t}:00+03:00`).toISOString();
const [s1, s2, s3] = [slot('11:00'), slot('11:30'), slot('12:00')];
let lookup = '', bookingId = '';

await check('admin data is blocked without a session', async () => assert.equal((await call('admin')).status, 401));
await check('wrong password is rejected', async () => assert.equal((await call('auth/login', {email, password: 'wrong-password'}, {auth: true})).status, 401));
await check('login from another origin is rejected', async () => assert.equal((await call('auth/login', {email, password}, {auth: true, origin: 'https://evil.example'})).status, 403));
await check('correct login sets an HttpOnly session cookie', async () => {
  const r = await call('auth/login', {email, password}, {auth: true});
  assert.equal(r.status, 200); assert.match(r.set || '', /HttpOnly/); assert.match(r.set || '', /SameSite=Strict/);
});
await check('admin data loads with the session', async () => assert.equal((await call('admin', undefined, {auth: true})).status, 200));
await check('admin write from another origin is rejected', async () => assert.equal((await call('admin/slot', {start: s1}, {auth: true, origin: 'https://evil.example'})).status, 403));
await check('booking is closed until business details are entered', async () => {
  if ((await call('catalog')).json.bookingReady) return; // already opened by an earlier run on this database
  assert.equal((await call('book', {})).status, 503);
});
await check('business details and booking switch are saved', async () => {
  assert.equal((await call('admin/settings', {controller: 'Test İşletme', privacyEmail: 'kvkk@example.test', transfer: '', bookings: true}, {auth: true})).status, 200);
  assert.equal((await call('catalog')).json.bookingReady, true);
});
await check('admin opens three slots', async () => {
  for (const start of [s1, s2, s3]) assert.equal((await call('admin/slot', {start, enabled: true}, {auth: true})).status, 200);
  const slots = (await call('slots')).json.slots;
  for (const start of [s1, s2, s3]) assert.ok(slots.includes(start));
});
const form = (start, request) => ({name: 'Test', surname: 'Müşteri', phone: '05321234567', wedding: '', model: 'lale', start, notice: true, notify: false, request});
const key = crypto.randomUUID();
await check('booking succeeds and returns a tracking code', async () => {
  const r = await call('book', form(s1, key));
  assert.equal(r.status, 201); assert.ok(r.json.lookup); lookup = r.json.lookup;
});
await check('retrying the same submission returns the same booking, no duplicate', async () => {
  const r = await call('book', form(s1, key));
  assert.equal(r.status, 201); assert.equal(r.json.lookup, lookup);
  const admin = await call('admin', undefined, {auth: true});
  assert.equal(admin.json.bookings.filter(b => b.start === s1).length, 1);
  bookingId = admin.json.bookings.find(b => b.start === s1).id;
});
await check('a different customer cannot take the same slot', async () => assert.equal((await call('book', form(s1, crypto.randomUUID()))).status, 409));
await check('booked slot disappears from free slots', async () => assert.ok(!(await call('slots')).json.slots.includes(s1)));
await check('tracking code shows pending status', async () => {
  const r = await call('booking/status', {lookup}); assert.equal(r.status, 200); assert.equal(r.json.status, 'pending');
});
await check('wrong tracking code is not found', async () => assert.equal((await call('booking/status', {lookup: 'x'.repeat(64)})).status, 404));
await check('admin confirms the booking', async () => {
  assert.equal((await call('admin/booking', {id: bookingId, previousStart: s1, previousStatus: 'pending', status: 'confirmed', start: s1}, {auth: true})).status, 200);
  assert.equal((await call('booking/status', {lookup})).json.status, 'confirmed');
});
await check('stale admin update is rejected (conflict guard)', async () => assert.equal((await call('admin/booking', {id: bookingId, previousStart: s1, previousStatus: 'pending', status: 'rejected', start: s1}, {auth: true})).status, 409));
await check('second customer books 11:30', async () => assert.equal((await call('book', form(s2, crypto.randomUUID()))).status, 201));
await check('rescheduling onto a taken slot is blocked', async () => assert.equal((await call('admin/booking', {id: bookingId, previousStart: s1, previousStatus: 'confirmed', status: 'confirmed', start: s2}, {auth: true})).status, 409));
await check('rescheduling to a free slot works and frees the old one', async () => {
  assert.equal((await call('admin/booking', {id: bookingId, previousStart: s1, previousStatus: 'confirmed', status: 'confirmed', start: s3}, {auth: true})).status, 200);
  const r = await call('booking/status', {lookup}); assert.equal(r.json.start, s3);
  assert.ok((await call('slots')).json.slots.includes(s1));
});
await check('closing a slot with a booking is blocked', async () => assert.equal((await call('admin/slot', {start: s3, enabled: false}, {auth: true})).status, 409));
await check('logout ends the session', async () => {
  await call('auth/logout', {}, {auth: true});
  assert.equal((await call('admin', undefined, {auth: true})).status, 401);
});
console.log(results.join('\n'));
process.exit(results.some(r => r.startsWith('FAIL')) ? 1 : 0);
