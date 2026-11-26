import {getCloudflareContext} from '@opennextjs/cloudflare';

// Cloudflare bindings (D1, R2) and secrets for the current request.
// Works in `next dev` (via initOpenNextCloudflareForDev) and in the deployed Worker.
export const env = new Proxy({}, {get: (_, key) => getCloudflareContext().env[key]});

/** Lets background work (cleanup, notifications) finish after the response. */
export function waitUntil(promise) {
  try { getCloudflareContext().ctx.waitUntil(promise); } catch { void promise.catch(() => {}); }
}
