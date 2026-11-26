// Business-owned admin sign-in: one admin email + PBKDF2 password hash, HMAC-signed session cookie.
// Secrets: ADMIN_EMAIL, ADMIN_PASSWORD_HASH (from `npm run admin:hash`), SESSION_SECRET (random, 32+ chars).
import {env} from './env.mjs';

export const COOKIE = 'be_admin';
const SESSION_SECONDS = 12 * 60 * 60;
const enc = new TextEncoder();

const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));
const b64url = bytes => b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = text => unb64(text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4));

function same(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({name: 'PBKDF2', hash: 'SHA-256', salt, iterations}, key, 256));
}

/** Creates `pbkdf2$<iterations>$<salt>$<hash>`. Workers allow at most 100 000 iterations. */
export async function hashPassword(password, iterations = 100000) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return ['pbkdf2', iterations, b64(salt), b64(await pbkdf2(password, salt, iterations))].join('$');
}

export async function verifyPassword(password, stored) {
  const [kind, rounds, salt, hash] = String(stored || '').split('$');
  const iterations = Number(rounds);
  if (kind !== 'pbkdf2' || !Number.isInteger(iterations) || iterations < 10000 || iterations > 100000 || !salt || !hash) return false;
  return same(await pbkdf2(password, unb64(salt), iterations), unb64(hash));
}

/** Password hash in use: one set from the admin panel (stored in D1) wins over the ADMIN_PASSWORD_HASH secret. */
export async function adminHash() {
  try {
    const row = await env.DB.prepare("SELECT data FROM docs WHERE id='auth'").first();
    const stored = row && JSON.parse(row.data).hash;
    if (String(stored || '').startsWith('pbkdf2$')) return stored;
  } catch {}
  return String(env.ADMIN_PASSWORD_HASH || '');
}

export function authConfigured() {
  return Boolean(env.ADMIN_EMAIL && String(env.ADMIN_PASSWORD_HASH || '').startsWith('pbkdf2$') && String(env.SESSION_SECRET || '').length >= 32);
}

async function hmac(data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(env.SESSION_SECRET), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

// A session is bound to the current password hash: changing the password signs everyone out.
const fingerprint = async () => (await adminHash()).slice(-12);

export async function createSession() {
  const payload = b64url(enc.encode(JSON.stringify({e: String(env.ADMIN_EMAIL).toLowerCase(), v: await fingerprint(), x: Date.now() + SESSION_SECONDS * 1000})));
  return payload + '.' + b64url(await hmac(payload));
}

export async function validSession(req) {
  if (!authConfigured()) return false;
  const cookie = req.headers.get('cookie') || '';
  const token = cookie.split(/;\s*/).find(part => part.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  if (!token || token.length > 1000) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  try {
    if (!same(await hmac(payload), unb64url(signature))) return false;
    const data = JSON.parse(new TextDecoder().decode(unb64url(payload)));
    return data.e === String(env.ADMIN_EMAIL).toLowerCase() && data.v === await fingerprint() && Number(data.x) > Date.now();
  } catch { return false; }
}

export function sessionCookie(req, token) {
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  return token
    ? `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure}`
    : `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}
