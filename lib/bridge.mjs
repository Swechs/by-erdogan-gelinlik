export const BACKEND_ORIGIN = 'https://by-erdogan-gelinlik.swechs.chatgpt.site';
export function allowedPath(path, method) {
  return method === 'GET'
    ? ['catalog', 'slots'].includes(path) || /^media\/[0-9a-f-]{36}\.jpg$/.test(path)
    : method === 'POST' && ['book', 'booking/status', 'try/start', 'try/status', 'try/image', 'try/delete'].includes(path);
}
export function upstreamHeaders(method) {
  const headers = new Headers();
  if (method === 'POST') { headers.set('Content-Type', 'application/json'); headers.set('Origin', BACKEND_ORIGIN); }
  return headers;
}
export async function relay(req, fetcher = fetch) {
  const url = new URL(req.url), path = url.pathname.slice(5);
  const error = (message, status) => Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
  if (!allowedPath(path, req.method)) return error('Bulunamadı.', 404);
  if (req.method === 'POST' && req.headers.get('origin') !== url.origin) return error('İstek kaynağı doğrulanamadı.', 403);
  if (req.method === 'POST' && !req.headers.get('content-type')?.startsWith('application/json')) return error('JSON veri bekleniyor.', 415);
  let body;
  if (req.method === 'POST') {
    if (Number(req.headers.get('content-length') || 0) > 4_000_000) return error('Lütfen daha küçük bir fotoğraf seçin.', 413);
    const chunks = []; let size = 0;
    const reader = req.body?.getReader();
    if (!reader) return error('Eksik istek.', 400);
    for (;;) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 4_000_000) { await reader.cancel(); return error('Lütfen daha küçük bir fotoğraf seçin.', 413); }
      chunks.push(chunk.value);
    }
    body = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  }
  try {
    const upstream = await fetcher(`${BACKEND_ORIGIN}/api/${path}`, {
      method: req.method, headers: upstreamHeaders(req.method), body,
      cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(25000),
    });
    const contentType = upstream.headers.get('content-type') || '';
    if (upstream.status >= 300 && upstream.status < 400 || !/^(application\/json|image\/)/.test(contentType)) return error('Atölye bağlantısı şu an yanıt vermiyor. Lütfen tekrar deneyin.', 502);
    return new Response(upstream.body, { status: upstream.status, headers: {
      'Content-Type': contentType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    } });
  } catch { return error('Bağlantı zaman aşımına uğradı. Lütfen tekrar deneyin.', 504); }
}
