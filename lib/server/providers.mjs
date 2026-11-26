import {env as secrets} from './env.mjs';
// Server-side adapters. Only the application server should import this module.
const falApp = 'https://queue.fal.run/fal-ai/image-apps-v2';
const falModel = falApp + '/virtual-try-on';
const requestIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const imageDataPrefix = /^data:image\/(?:jpeg|png|webp);base64,/i;

export class ProviderError extends Error {
  constructor(message, { status = 502, retryable = false } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
    this.retryable = retryable;
  }
}

export function tryOnConfigured() {
  return Boolean(secrets.FAL_KEY?.trim());
}

function falHeaders(key = secrets.FAL_KEY) {
  if (!key?.trim()) {
    throw new ProviderError('Sanal deneme henüz kullanıma açılmadı.', { status: 503 });
  }
  return { Authorization: 'Key ' + key.trim(), 'Content-Type': 'application/json' };
}

async function request(url, options = {}) {
  try {
    return await fetch(url, {
      ...options,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(25_000)
    });
  } catch {
    throw new ProviderError('Sağlayıcıya şu anda ulaşılamıyor.', { status: 503, retryable: true });
  }
}

async function readJson(response) {
  if (!response.ok) {
    const retryable = response.status === 429 || response.status === 408 || response.status >= 500;
    throw new ProviderError('Sağlayıcı işlemi tamamlayamadı.', { status: retryable ? 503 : 502, retryable });
  }
  try {
    return await response.json();
  } catch {
    throw new ProviderError('Sağlayıcı geçerli bir yanıt göndermedi.', { retryable: true });
  }
}

function requireImageInput(value) {
  if (typeof value !== 'string' || value.length > 12 * 1024 * 1024) {
    throw new ProviderError('Görsel boyutu veya biçimi uygun değil.', { status: 400 });
  }
  if (imageDataPrefix.test(value) && value.length > value.indexOf(',') + 1) return value;
  if (value.startsWith('https://')) {
    try {
      const url = new URL(value);
      if (url.hostname && !url.username && !url.password) return value;
    } catch { /* Handled below. */ }
  }
  throw new ProviderError('JPG, PNG veya WebP biçiminde bir fotoğraf seçin.', { status: 400 });
}

function queueUrl(requestId) {
  if (!requestIdPattern.test(requestId)) {
    throw new ProviderError('Deneme işlem numarası geçersiz.', { status: 400 });
  }
  return falApp + '/requests/' + requestId;
}

export async function submitTryOn({ personImage, garmentImage }) {
  const response = await request(falModel, {
    method: 'POST',
    headers: {
      ...falHeaders(),
      'X-Fal-Store-IO': '0',
      'X-Fal-Object-Lifecycle-Preference': JSON.stringify({
        expiration_duration_seconds: 3600,
        initial_acl: { default: 'forbid', rules: [] }
      })
    },
    body: JSON.stringify({
      person_image_url: requireImageInput(personImage),
      clothing_image_url: requireImageInput(garmentImage),
      preserve_pose: true,
      aspect_ratio: { ratio: '3:4' }
    })
  });
  const data = await readJson(response);
  queueUrl(data.request_id);
  return { requestId: data.request_id };
}

function requireFalImage(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.port && !url.username && !url.password &&
        ['v3.fal.media', 'v3b.fal.media'].includes(url.hostname) && url.pathname.startsWith('/files/')) {
      return url;
    }
  } catch { /* Handled below. */ }
  throw new ProviderError('Deneme görselinin adresi doğrulanamadı.');
}

export async function pollTryOn(requestId) {
  const url = queueUrl(requestId);
  const headers = falHeaders();
  const statusResponse = await request(url + '/status', { headers });
  if (statusResponse.status === 404 || statusResponse.status === 410) {
    return { status: 'failed', error: 'Bu deneme artık kullanılabilir değil.' };
  }
  const state = await readJson(statusResponse);
  if (state.status === 'IN_QUEUE') return { status: 'queued' };
  if (state.status === 'IN_PROGRESS') return { status: 'processing' };
  if (state.status !== 'COMPLETED' || state.error || state.error_type) {
    return { status: 'failed', error: 'Deneme tamamlanamadı. Farklı bir fotoğrafla tekrar deneyebilirsiniz.' };
  }
  const output = await request(url, { headers });
  if ([400, 404, 410, 422].includes(output.status)) {
    return { status: 'failed', error: 'Bu fotoğrafla deneme sonucu üretilemedi.' };
  }
  const result = await readJson(output);
  const imageUrl = result.images?.[0]?.url;
  if (!imageUrl) return { status: 'failed', error: 'Deneme sonucunda görsel alınamadı.' };
  return { status: 'succeeded', imageUrl: requireFalImage(imageUrl).href };
}

// The caller must verify the visitor owns the job before streaming this response.
export async function readTryOnImage(imageUrl) {
  const url = requireFalImage(imageUrl);
  const auth = await request('https://rest.fal.ai/storage/auth/token?storage_type=fal-cdn-v3', {
    method: 'POST',
    headers: falHeaders(),
    body: JSON.stringify({ expiration_seconds: 300 })
  });
  const { token } = await readJson(auth);
  if (typeof token !== 'string' || !token) throw new ProviderError('Deneme görseline erişilemiyor.');
  const image = await request(url, { headers: { Authorization: 'Bearer ' + token } });
  if (!image.ok || !/^image\/(?:webp|png|jpeg)(?:;|$)/i.test(image.headers.get('content-type') || '')) {
    throw new ProviderError('Deneme görseli artık kullanılamıyor.', { status: image.status === 404 ? 410 : 502 });
  }
  return image;
}

export async function deleteTryOn(requestId) {
  const url = queueUrl(requestId);
  const cancel = await request(url + '/cancel', { method: 'PUT', headers: falHeaders() });
  if (cancel.status === 202) return { pending: true };
  if (!cancel.ok && ![400, 404].includes(cancel.status)) await readJson(cancel);
  const response = await request('https://api.fal.ai/v1/models/requests/' + requestId + '/payloads', {
    method: 'DELETE', headers: falHeaders(secrets.FAL_DELETE_KEY || secrets.FAL_KEY)
  });
  if (response.status === 400) return { pending: true };
  if (response.status === 404) return { pending: false };
  const { cdn_delete_results: files } = await readJson(response);
  if (!Array.isArray(files) || files.some(file => file.exception)) {
    throw new ProviderError('Deneme görselinin silinmesi yeniden denenmeli.', { retryable: true });
  }
  return { pending: false };
}

export function whatsAppConfigured() {
  return Boolean(secrets.WHATSAPP_TOKEN?.trim() &&
    /^\d+$/.test(secrets.WHATSAPP_PHONE_NUMBER_ID || '') &&
    /^[a-z0-9_]+$/.test(secrets.WHATSAPP_TEMPLATE || '') &&
    /^v\d+\.\d+$/.test(secrets.WHATSAPP_GRAPH_VERSION || ''));
}

export async function sendAppointmentTemplate({ phone, variables = [] }) {
  if (!whatsAppConfigured()) {
    throw new ProviderError('WhatsApp bildirimleri henüz kullanıma açılmadı.', { status: 503 });
  }
  // Local 05xx / 5xx mobile numbers are normalized for the Isparta atelier.
  let digits = String(phone).replace(/[\s()\-+]/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (/^0?5\d{9}$/.test(digits)) digits = '90' + digits.slice(-10);
  if (!/^[1-9]\d{6,14}$/.test(digits)) {
    throw new ProviderError('Geçerli bir telefon numarası girin.', { status: 400 });
  }
  if (!Array.isArray(variables) || variables.some(value => typeof value !== 'string' || !value.trim())) {
    throw new ProviderError('WhatsApp şablonundaki bilgiler eksik.');
  }
  const template = {
    name: secrets.WHATSAPP_TEMPLATE,
    language: { code: secrets.WHATSAPP_LANGUAGE || 'tr' }
  };
  if (variables.length) {
    template.components = [{
      type: 'body', parameters: variables.map(text => ({ type: 'text', text }))
    }];
  }
  const endpoint = 'https://graph.facebook.com/' + secrets.WHATSAPP_GRAPH_VERSION +
    '/' + secrets.WHATSAPP_PHONE_NUMBER_ID + '/messages';
  const response = await request(endpoint, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + secrets.WHATSAPP_TOKEN.trim(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: digits, type: 'template', template })
  });
  const result = await readJson(response);
  const messageId = result.messages?.[0]?.id;
  if (!messageId) throw new ProviderError('WhatsApp mesajının kabulü doğrulanamadı.');
  return { messageId };
}
