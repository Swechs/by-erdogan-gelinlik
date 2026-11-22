export class ProviderError extends Error {
  readonly status: number;
  readonly retryable: boolean;
  constructor(message: string, options?: { status?: number; retryable?: boolean });
}
export function tryOnConfigured(): boolean;
export function submitTryOn(input: { personImage: string; garmentImage: string }): Promise<{ requestId: string }>;
export type TryOnState =
  | { status: 'queued' | 'processing' }
  | { status: 'succeeded'; imageUrl: string }
  | { status: 'failed'; error: string };
export function pollTryOn(requestId: string): Promise<TryOnState>;
export function readTryOnImage(imageUrl: string): Promise<Response>;
export function deleteTryOn(requestId: string): Promise<{ pending: boolean }>;
export function whatsAppConfigured(): boolean;
export function sendAppointmentTemplate(input: { phone: string; variables?: string[] }): Promise<{ messageId: string }>;
