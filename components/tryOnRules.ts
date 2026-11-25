// Pure rules shared by the try-on dialog. Kept dependency-free so `node --test` can import it directly.

export type TryOnMode = 'paid' | 'free' | null;

type ModelFlags = {tryOn: boolean; concept: boolean};
type DataFlags = {preview: boolean; tryOn: boolean; freeTryOn?: boolean};

/**
 * Decides which provider (if any) may run for a model.
 * - A real (non-concept) model follows the admin's per-model `tryOn` switch for every provider.
 * - The paid provider is used only when the business service is configured.
 * - Concept models cannot carry an admin switch (the backend forces `tryOn: false` for them),
 *   so they may only use the free experimental demo, and only while the backend enables it.
 */
export function tryOnMode(data: DataFlags, model?: ModelFlags): TryOnMode {
  if (data.preview || !model) return null;
  if (!model.concept) {
    if (!model.tryOn) return null;
    if (data.tryOn) return 'paid';
    return data.freeTryOn ? 'free' : null;
  }
  return data.freeTryOn ? 'free' : null;
}

const terminal = new Set(['succeeded', 'failed', 'expired']);
export const isTerminal = (state: string) => terminal.has(state);

/** HTTP statuses after which polling a paid job can never succeed. */
export const isFinalStatus = (status?: number) => status === 404 || status === 410;

/** Longest time a paid job is polled before the dialog stops asking (backend jobs expire after 1 hour). */
export const MAX_POLL_MS = 15 * 60 * 1000;

const extensions: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif'
};

/** File extension matching the real image format, defaulting to the format's subtype or `png`. */
export function extensionFor(mime?: string): string {
  const type = (mime || '').split(';')[0].trim().toLowerCase();
  return extensions[type] || (/^image\/[a-z0-9.+-]+$/.test(type) ? type.slice(6).replace(/[^a-z0-9]/g, '') || 'png' : 'png');
}

/** ASCII-safe download file name, e.g. `By-Erdogan-Lale.jpg`. */
export function downloadName(modelName: string | undefined, mime?: string): string {
  const safe = (modelName || 'Prova').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i').replace(/İ/g, 'I').replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'Prova';
  return 'By-Erdogan-' + safe + '.' + extensionFor(mime);
}
