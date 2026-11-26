const space = 'https://fashn-ai-fashn-vton-1-5.hf.space';
const api = space + '/gradio_api';

export type FreeProgress = 'uploading' | 'waiting' | 'queued' | 'processing' | 'downloading';

function providerMessage(message: string): string {
  if (/quota|exceeded|daily|gpu.*limit|zerogpu/i.test(message)) {
    return 'Ücretsiz GPU kotası doldu. Daha sonra yeniden deneyebilirsiniz.';
  }
  if (/queue.*full|too many|429/i.test(message)) {
    return 'Ücretsiz deneme sırası dolu. Biraz sonra yeniden deneyin.';
  }
  if (/sign.?in|log.?in|auth|token|401|403/i.test(message)) {
    return 'Ücretsiz servis şu anda Hugging Face hesabıyla giriş istiyor. Doğrudan deneme bağlantısını kullanabilirsiniz.';
  }
  return 'Ücretsiz servis işlemi tamamlayamadı. Biraz sonra yeniden deneyin.';
}

async function readResponse(response: Response): Promise<unknown> {
  const value: unknown = await response.json();
  if (!response.ok) throw new Error(providerMessage(JSON.stringify(value)));
  return value;
}

async function upload(blob: Blob, name: string, signal: AbortSignal): Promise<object> {
  const form = new FormData();
  form.append('files', blob, name);
  const response = await fetch(api + '/upload', { method: 'POST', body: form, signal });
  const files = await readResponse(response);
  if (!Array.isArray(files) || typeof files[0] !== 'string' || !files[0].startsWith('/tmp/gradio/')) {
    throw new Error('Fotoğraf ücretsiz servise yüklenemedi.');
  }
  return { path: files[0], meta: { _type: 'gradio.FileData' } };
}

function resultURL(value: unknown): string {
  if (!Array.isArray(value) || !value[0] || typeof value[0].url !== 'string') {
    throw new Error('Ücretsiz servis bir sonuç görseli göndermedi.');
  }
  const url = new URL(value[0].url);
  if (url.origin !== space || !url.pathname.startsWith('/gradio_api/file=')) {
    throw new Error('Sonuç görselinin adresi doğrulanamadı.');
  }
  return url.href;
}

// Only the provider's real completion event can produce a result.
export async function readCompletion(
  stream: ReadableStream<Uint8Array>,
  signal: AbortSignal,
  progress: (state: FreeProgress) => void
): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  try {
    for (;;) {
      signal.throwIfAborted();
      const { value, done } = await reader.read();
      pending += done ? decoder.decode() : decoder.decode(value, { stream: true });
      pending = pending.replace(/\r\n/g, '\n');
      let boundary;
      while ((boundary = pending.indexOf('\n\n')) >= 0) {
        const block = pending.slice(0, boundary);
        pending = pending.slice(boundary + 2);
        const lines = block.split('\n');
        const event = lines.find(line => line.startsWith('event:'))?.slice(6).trim();
        const raw = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n');
        if (event === 'error') throw new Error(providerMessage(raw));
        if (event === 'complete') return resultURL(JSON.parse(raw));
        if (event === 'generating') progress('processing');
      }
      if (done) throw new Error('Deneme bağlantısı kesildi. Yeniden deneyebilirsiniz.');
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function freeTryOn({
  person,
  garment,
  signal,
  progress
}: {
  person: string;
  garment: string;
  signal: AbortSignal;
  progress: (state: FreeProgress) => void;
}): Promise<Blob> {
  progress('uploading');
  const personResponse = await fetch(person, { signal });
  const garmentResponse = await fetch(garment, { signal, cache: 'no-store' });
  if (!personResponse.ok || !garmentResponse.ok) throw new Error('Fotoğraf veya gelinlik görseli okunamadı.');
  const personBlob = await personResponse.blob();
  const garmentBlob = await garmentResponse.blob();
  if (personBlob.size > 6 * 1024 * 1024 || garmentBlob.size > 10 * 1024 * 1024) {
    throw new Error('Fotoğraf veya gelinlik görseli çok büyük.');
  }
  const personFile = await upload(personBlob, 'person.jpg', signal);
  const garmentFile = await upload(garmentBlob, 'garment.webp', signal);
  signal.throwIfAborted();
  // The free demo rejects new jobs while its shared queue is full; wait and ask again until the caller's deadline.
  let response: Response;
  for (;;) {
    response = await fetch(api + '/call/try_on', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [personFile, garmentFile, 'one-pieces', 'model', 30, 1.5, 42, true] }),
      signal
    });
    if (response.status !== 503 && response.status !== 429) break;
    progress('waiting');
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 15000);
      signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
    });
  }
  const job = await readResponse(response);
  if (!job || typeof job !== 'object' || !('event_id' in job) ||
      typeof job.event_id !== 'string' || !/^[a-z0-9]{16,64}$/.test(job.event_id)) {
    throw new Error('Ücretsiz servis denemeyi sıraya alamadı.');
  }
  progress('queued');
  const events = await fetch(api + '/call/try_on/' + job.event_id, { signal });
  if (!events.ok || !events.body) throw new Error(providerMessage(String(events.status)));
  const url = await readCompletion(events.body, signal, progress);
  signal.throwIfAborted();
  progress('downloading');
  const image = await fetch(url, { signal, cache: 'no-store' });
  if (!image.ok || !image.headers.get('content-type')?.startsWith('image/')) {
    throw new Error('Deneme tamamlandı fakat sonuç indirilemedi.');
  }
  const blob = await image.blob();
  if (!blob.size || blob.size > 20 * 1024 * 1024) throw new Error('Sonuç görseli okunamadı.');
  return blob;
}
