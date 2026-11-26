// Atelier API running inside this Next.js app on Cloudflare (D1 + R2).
// Ported from sites-backend/lib/api.mjs. Changes: business-owned admin login instead of ChatGPT
// sign-in, idempotent booking submissions, background cleanup via waitUntil.
import {env, waitUntil} from './env.mjs';
import {initialContent, sampleModels} from './seed.mjs';
import {tryOnConfigured, whatsAppConfigured, ProviderError, submitTryOn, pollTryOn, readTryOnImage, deleteTryOn, sendAppointmentTemplate} from './providers.mjs';
import {authConfigured, verifyPassword, createSession, validSession, sessionCookie} from './auth.mjs';

const day = 86400000;
const active = "status IN ('pending','confirmed')";
const freeSQL = "SELECT start FROM slots s WHERE enabled=1 AND start>? AND NOT EXISTS(SELECT 1 FROM bookings b WHERE b.start=s.start AND " + active + ") ORDER BY start LIMIT 500";
const states = {pending: 'Onay bekliyor', confirmed: 'Onaylandı', rejected: 'Reddedildi'};
const query = (sql, ...args) => env.DB.prepare(sql).bind(...args);
const result = (value, status = 200, headers = {}) => Response.json(value, {status, headers: {'Cache-Control': 'private,no-store', 'X-Content-Type-Options': 'nosniff', ...headers}});
function ok(yes, message, code = 400) { if (!yes) throw new ProviderError(message, {status: code}); }
function word(x, max, min = 1) { ok(typeof x === 'string' && x.trim().length >= min && x.trim().length <= max, 'Lütfen bilgileri kontrol edin.'); return x.trim(); }
function asset(x) { return typeof x === 'string' && /^\/(images\/[a-z0-9-]+\.webp|api\/media\/[0-9a-f-]{36}\.jpg)$/.test(x); }
const tok = () => crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
const hash = async v => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v))), x => x.toString(16).padStart(2, '0')).join('');
function time(x) {
  const d = new Date(word(x, 40));
  ok(Number.isFinite(+d) && +d > Date.now() && d.getUTCMinutes() % 30 === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0, 'Gelecekte yarım saatlik bir dilim seçin.');
  return d.toISOString();
}
async function rate(id, max, window) {
  const n = Date.now();
  const row = await query('INSERT INTO limits VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET used=CASE WHEN expires<=? THEN 1 ELSE used+1 END,expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END RETURNING used', id, n + window, n, n).first();
  ok(row.used <= max, 'İstek sınırına ulaşıldı. Daha sonra deneyin.', 429);
}
const save = (id, val) => query('INSERT INTO docs VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data', id, JSON.stringify(val)).run();

async function config() {
  let content = initialContent, settings = {controller: '', privacyEmail: '', transfer: '', bookings: false};
  const map = new Map(sampleModels.map(m => [m.id, m]));
  const rows = await env.DB.prepare('SELECT id,data FROM docs').all();
  for (const r of rows.results) {
    const x = JSON.parse(r.data);
    if (r.id === 'content') content = x;
    else if (r.id === 'settings') settings = x;
    else if (r.id.startsWith('model/')) { if (x) map.set(x.id, x); else map.delete(r.id.slice(6)); }
  }
  return {models: [...map.values()], content, settings};
}

export async function publicData() {
  const {models, content, settings: s} = await config();
  const legal = !!(s.controller && s.privacyEmail);
  return {
    models, content, freeTryOn: env.FREE_TRYON !== 'off',
    controller: s.controller, privacyEmail: s.privacyEmail, transfer: s.transfer,
    bookingReady: legal && s.bookings,
    tryOn: legal && !!s.transfer && tryOnConfigured(),
    notifications: legal && !!s.transfer && whatsAppConfigured(),
    preview: false,
    analytics: {
      ga: /^G-[A-Z0-9]+$/.test(env.GA4_ID || '') ? env.GA4_ID : '',
      pixel: /^\d+$/.test(env.META_PIXEL_ID || '') ? env.META_PIXEL_ID : ''
    }
  };
}

async function body(req, max) {
  ok(req.headers.get('content-type')?.startsWith('application/json'), 'JSON veri bekleniyor.', 415);
  const origin = req.headers.get('origin');
  ok(!origin || origin === new URL(req.url).origin, 'İstek kaynağı doğrulanamadı.', 403);
  ok(Number(req.headers.get('content-length') || 0) <= max, 'Dosya çok büyük.', 413);
  const reader = req.body?.getReader();
  ok(reader, 'Eksik istek.');
  let n = 0; const parts = [];
  for (;;) {
    const v = await reader.read();
    if (v.done) break;
    n += v.value.byteLength;
    if (n > max) { await reader.cancel(); ok(false, 'Dosya çok büyük.', 413); }
    parts.push(v.value);
  }
  const a = new Uint8Array(n); let i = 0;
  for (const p of parts) { a.set(p, i); i += p.length; }
  try { const v = JSON.parse(new TextDecoder().decode(a)); if (v && typeof v === 'object') return v; } catch {}
  ok(false, 'Veri okunamadı.');
}
function jpg(x) {
  ok(typeof x === 'string' && x.startsWith('data:image/jpeg;base64,') && x.length < 7000000, 'Uygun bir JPEG fotoğrafı seçin.');
  const a = Uint8Array.from(atob(x.slice(23)), c => c.charCodeAt(0));
  ok(a.length > 100 && a[0] === 255 && a[1] === 216 && a[2] === 255 && a.at(-1) === 217, 'Fotoğraf okunamadı.');
  return a;
}
const dataURL = bytes => { const a = new Uint8Array(bytes); let text = ''; for (let i = 0; i < a.length; i += 8192) text += String.fromCharCode(...a.subarray(i, i + 8192)); return 'data:image/jpeg;base64,' + btoa(text); };
const free = async () => (await query(freeSQL, new Date().toISOString()).all()).results.map(x => x.start);

async function notify(id) {
  const b = await query('SELECT * FROM bookings WHERE id=?', id).first();
  if (!b?.notify || b.delivery !== 'queued') return;
  const claim = await query("UPDATE bookings SET delivery='sending' WHERE id=? AND delivery='queued' AND start=? AND status=?", id, b.start, b.status).run();
  if (!claim.meta.changes) return;
  let state = 'accepted';
  try { await sendAppointmentTemplate({phone: b.phone, variables: [b.name, new Date(b.start).toLocaleString('tr-TR', {timeZone: 'Europe/Istanbul'}), states[b.status]]}); } catch { state = 'review'; }
  await query("UPDATE bookings SET delivery=? WHERE id=? AND start=? AND status=? AND delivery='sending'", state, id, b.start, b.status).run();
}

export async function compact() {
  const n = Date.now();
  await env.DB.batch([
    query('DELETE FROM limits WHERE expires<=?', n),
    query('DELETE FROM requests WHERE expires<=?', n),
    query('DELETE FROM bookings WHERE start<?', new Date(n - 180 * day).toISOString())
  ]);
  const list = await query('SELECT key,remote FROM jobs WHERE expires<=? LIMIT 10', n).all();
  for (const j of list.results) {
    try { if (!(await deleteTryOn(j.remote)).pending) await query('DELETE FROM jobs WHERE key=?', j.key).run(); } catch {}
  }
}
let nextCleanup = 0;
function scheduleCleanup() {
  if (Date.now() < nextCleanup) return;
  nextCleanup = Date.now() + 600000;
  waitUntil(compact().catch(() => { nextCleanup = Date.now() + 60000; }));
}

const clientId = req => hash(req.headers.get('CF-Connecting-IP') || req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'shared');

async function auth(path, req) {
  if (path === 'auth/session') return result({signedIn: await validSession(req), configured: authConfigured()});
  ok(req.method === 'POST', 'Geçersiz yöntem.', 405);
  ok(req.headers.get('origin') === new URL(req.url).origin, 'İstek kaynağı doğrulanamadı.', 403);
  if (path === 'auth/logout') return result({ok: true}, 200, {'Set-Cookie': sessionCookie(req, '')});
  ok(path === 'auth/login', 'Bulunamadı.', 404);
  ok(authConfigured(), 'Yönetici girişi henüz yapılandırılmadı.', 503);
  const b = await body(req, 4000);
  await rate('login/' + await clientId(req), 8, 900000);
  const email = word(b.email || '', 200), password = typeof b.password === 'string' ? b.password : '';
  const valid = email.toLowerCase() === String(env.ADMIN_EMAIL).toLowerCase() && await verifyPassword(password, env.ADMIN_PASSWORD_HASH);
  ok(valid, 'E-posta veya şifre hatalı.', 401);
  return result({ok: true}, 200, {'Set-Cookie': sessionCookie(req, await createSession())});
}

export async function handleApi(req) {
  try {
    const path = new URL(req.url).pathname.slice(5), method = req.method;
    scheduleCleanup();
    if (path.startsWith('auth/')) return await auth(path, req);
    if (path.startsWith('admin')) {
      ok(await validSession(req), 'Oturumunuz sona erdi. Lütfen yeniden giriş yapın.', 401);
      if (method === 'POST') ok(req.headers.get('origin') === new URL(req.url).origin, 'İstek kaynağı doğrulanamadı.', 403);
    }
    if (path.startsWith('media/') && method === 'GET') {
      ok(asset('/api/' + path), 'Bulunamadı.', 404);
      const o = await env.BUCKET.get(path);
      ok(o, 'Görsel bulunamadı.', 404);
      return new Response(o.body, {headers: {'Content-Type': 'image/jpeg', 'Cache-Control': 'public,max-age=86400', 'X-Content-Type-Options': 'nosniff'}});
    }
    const c = await publicData();
    if (method === 'GET') {
      if (path === 'catalog') return result(c);
      if (path === 'slots') return result({slots: c.bookingReady ? await free() : [], enabled: c.bookingReady});
      if (path === 'admin') {
        const [s, b, u] = await env.DB.batch([
          query('SELECT * FROM slots WHERE start>? ORDER BY start LIMIT 500', new Date().toISOString()),
          query('SELECT id,name,phone,model,start,wedding,status,notify,delivery FROM bookings ORDER BY start DESC LIMIT 500'),
          query('SELECT day,tries FROM counts ORDER BY day DESC LIMIT 30')
        ]);
        return result({models: c.models, content: c.content, slots: s.results, available: await free(), bookings: b.results, usage: u.results, tryOn: c.tryOn, notifications: c.notifications, bookingsEnabled: c.bookingReady, settings: {controller: c.controller, privacyEmail: c.privacyEmail, transfer: c.transfer}});
      }
      ok(false, 'Bulunamadı.', 404);
    }
    ok(method === 'POST', 'Geçersiz yöntem.', 405);
    if (path === 'book') ok(c.bookingReady, 'Çevrim içi randevu henüz açılmadı.', 503);
    if (path === 'try/start') ok(c.tryOn, 'Sanal deneme henüz açılmadı.', 503);
    const b = await body(req, ['try/start', 'admin/upload'].includes(path) ? 7000000 : 120000), client = await clientId(req);
    switch (path) {
      case 'admin/settings': {
        const controller = word(b.controller || '', 200, 0), privacyEmail = word(b.privacyEmail || '', 200, 0);
        ok(!privacyEmail || /^\S+@\S+\.\S+$/.test(privacyEmail), 'Geçerli bir e-posta girin.');
        ok(!b.bookings || controller && privacyEmail, 'İşletme unvanı ve başvuru adresi gerekli.');
        await save('settings', {controller, privacyEmail, transfer: word(b.transfer || '', 2500, 0), bookings: b.bookings === true});
        return result({ok: true});
      }
      case 'admin/upload': {
        const bytes = jpg(b.image), id = 'media/' + crypto.randomUUID() + '.jpg';
        await env.BUCKET.put(id, bytes, {httpMetadata: {contentType: 'image/jpeg'}});
        return result({url: '/api/' + id});
      }
      case 'admin/model': {
        const id = word(b.id || crypto.randomUUID(), 80);
        ok(/^[a-z0-9-]+$/.test(id) && Array.isArray(b.images) && b.images.length && b.images.length <= 8 && b.images.every(asset), '1–8 ürün fotoğrafı seçin.');
        await save('model/' + id, {id, name: word(b.name, 90), silhouette: word(b.silhouette, 80), fabric: word(b.fabric, 100), description: word(b.description, 2000), images: b.images, concept: b.concept === true, tryOn: b.tryOn === true && !b.concept});
        return result({ok: true});
      }
      case 'admin/model/archive':
        await save('model/' + word(b.id, 80), null);
        return result({ok: true});
      case 'admin/content': {
        ok(asset(b.hero) && Array.isArray(b.stories) && b.stories.length <= 80, 'İçeriği kontrol edin.');
        const ids = new Set();
        const stories = b.stories.map(s => {
          ok(/^[a-z0-9-]+$/.test(s.id) && !ids.has(s.id) && asset(s.image), 'Hikâye adresi veya görseli geçersiz.');
          ids.add(s.id);
          ok(s.category !== 'Gelin hikâyeleri' || s.permission === true, 'Yayın izni gerekli.');
          return {id: word(s.id, 80), title: word(s.title, 140), category: word(s.category, 80), intro: word(s.intro, 600), body: word(s.body, 12000), image: s.image, permission: !!s.permission};
        });
        await save('content', {hero: b.hero, stories});
        return result({ok: true});
      }
      case 'admin/slot': {
        const start = time(b.start), enabled = b.enabled !== false ? 1 : 0;
        const r = await query("INSERT INTO slots SELECT ?,? WHERE ?=1 OR NOT EXISTS(SELECT 1 FROM bookings WHERE start=? AND " + active + ") ON CONFLICT(start) DO UPDATE SET enabled=excluded.enabled", start, enabled, enabled, start).run();
        ok(r.meta.changes, 'Bu saatte randevu var.', 409);
        return result({ok: true});
      }
      case 'book': {
        // A retried submission with the same request key returns the original booking.
        const requestKey = typeof b.request === 'string' && /^[A-Za-z0-9-]{20,100}$/.test(b.request) ? await hash('book/' + b.request) : '';
        if (requestKey) {
          const previous = await query('SELECT response FROM requests WHERE id=? AND expires>?', requestKey, Date.now()).first();
          if (previous) return result(JSON.parse(previous.response), 201);
        }
        await rate('book/' + client, 12, 3600000);
        const start = time(b.start), name = word(b.name, 95, 2) + ' ' + word(b.surname, 95, 2), phone = word(b.phone, 24).replace(/[\s()\-]/g, ''), w = word(b.wedding || '', 10, 0);
        ok(/^(?:0?5\d{9}|\+[1-9]\d{7,14})$/.test(phone), 'Geçerli bir telefon numarası girin.');
        ok(!w || (/^\d{4}-\d\d-\d\d$/.test(w) && Number.isFinite(Date.parse(w)) && new Date(w).toISOString().slice(0, 10) === w && w >= new Date(Date.now() + 10800000).toISOString().slice(0, 10)), 'Düğün tarihini kontrol edin.');
        ok(b.notice === true, 'Aydınlatmayı okuyun.');
        const m = c.models.find(m => m.id === b.model);
        ok(!b.model || m, 'Geçersiz model.');
        const model = m ? m.name + (m.concept ? ' · konsept referansı' : '') : '', lookup = tok(), id = crypto.randomUUID(), msg = !!(b.notify && c.notifications);
        const response = {lookup, status: 'pending', start, model};
        const insert = query("INSERT INTO bookings SELECT ?,?,s.start,?,?,?,?,'pending',?,? FROM slots s WHERE s.start=? AND s.enabled=1 AND s.start>? AND NOT EXISTS(SELECT 1 FROM bookings b WHERE b.start=s.start AND " + active + ")", id, await hash(lookup), model, name, phone, w, msg ? 1 : 0, msg ? 'queued' : '', start, new Date().toISOString());
        const statements = [insert];
        // Stored only when the booking row was inserted in the same batch.
        if (requestKey) statements.push(query('INSERT INTO requests SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM bookings WHERE id=?)', requestKey, JSON.stringify(response), Date.now() + day, id));
        const [r] = await env.DB.batch(statements);
        ok(r.meta.changes, 'Bu saat doldu. Başka bir saat seçin.', 409);
        if (msg) waitUntil(notify(id));
        return result(response, 201);
      }
      case 'booking/status': {
        await rate('lookup/' + client, 120, 60000);
        const r = await query('SELECT start,status,model FROM bookings WHERE lookup=?', await hash(word(b.lookup, 100))).first();
        ok(r, 'Randevu bulunamadı.', 404);
        return result(r);
      }
      case 'admin/booking': {
        const id = word(b.id, 80), status = word(b.status, 20);
        ok(Object.hasOwn(states, status), 'Durum geçersiz.');
        const old = await query('SELECT * FROM bookings WHERE id=?', id).first();
        ok(old, 'Randevu bulunamadı.', 404);
        const start = b.start === old.start ? old.start : time(b.start);
        if (start === old.start && status === old.status) return result({ok: true});
        const r = await query("UPDATE bookings SET start=?,status=?,delivery=CASE WHEN notify=1 THEN 'queued' ELSE '' END WHERE id=? AND start=? AND status=? AND (?='rejected' OR EXISTS(SELECT 1 FROM slots WHERE start=? AND enabled=1)) AND (?='rejected' OR NOT EXISTS(SELECT 1 FROM bookings b WHERE b.start=? AND b.id<>? AND b." + active + "))", start, status, id, b.previousStart, b.previousStatus, status, start, status, start, id).run();
        ok(r.meta.changes, 'Randevu veya saat değişti. Listeyi yenileyin.', 409);
        if (old.notify) waitUntil(notify(id));
        return result({ok: true});
      }
      case 'try/start': {
        const m = c.models.find(x => x.id === b.model && x.tryOn && !x.concept);
        ok(m && b.consent === true, 'Model seçimi ve fotoğraf izni gerekli.');
        jpg(b.photo);
        await rate('try/' + client, 3, day);
        await rate('alltry', Number(env.TRYON_DAILY_LIMIT) || 10, day);
        let garment = new URL(m.images[0], req.url).href;
        if (m.images[0].startsWith('/api/media/')) {
          const o = await env.BUCKET.get(m.images[0].slice(5));
          ok(o, 'Ürün fotoğrafı eksik.', 409);
          garment = dataURL(await o.arrayBuffer());
        }
        const {requestId} = await submitTryOn({personImage: b.photo, garmentImage: garment}), key = tok();
        await env.DB.batch([
          query("INSERT INTO jobs VALUES(?,?,?,'queued',NULL,?)", await hash(key), requestId, m.id, Date.now() + 3600000),
          query('INSERT INTO counts VALUES(?,1) ON CONFLICT(day) DO UPDATE SET tries=tries+1', new Date().toISOString().slice(0, 10))
        ]);
        return result({key, state: 'queued'}, 202);
      }
      case 'try/status': case 'try/image': case 'try/delete': {
        const key = await hash(word(b.key, 100)), j = await query('SELECT * FROM jobs WHERE key=? AND expires>?', key, Date.now()).first();
        ok(j, 'Denemenin süresi doldu veya deneme silindi.', 410);
        if (path === 'try/delete') {
          await query("UPDATE jobs SET expires=0,image=NULL,state='deleting' WHERE key=?", key).run();
          try { if (!(await deleteTryOn(j.remote)).pending) await query('DELETE FROM jobs WHERE key=?', key).run(); } catch {}
          return result({ok: true});
        }
        if (path === 'try/image') {
          ok(j.image, 'Sonuç henüz hazır değil.', 409);
          const r = await readTryOnImage(j.image);
          return new Response(r.body, {headers: {'Content-Type': r.headers.get('content-type'), 'Cache-Control': 'private,no-store'}});
        }
        if (['failed', 'succeeded'].includes(j.state)) return result({state: j.state});
        const p = await pollTryOn(j.remote);
        await query('UPDATE jobs SET state=?,image=? WHERE key=? AND expires>?', p.status, p.imageUrl || null, key, Date.now()).run();
        return result({state: p.status, error: p.error});
      }
      default: ok(false, 'Bulunamadı.', 404);
    }
  } catch (e) {
    if (e instanceof ProviderError) return result({error: e.message}, e.status);
    if (String(e).includes('UNIQUE constraint failed: bookings.start')) return result({error: 'Bu saat doldu.'}, 409);
    console.error('api', e);
    return result({error: 'İşlem tamamlanamadı. Yeniden deneyin.'}, 503);
  }
}
