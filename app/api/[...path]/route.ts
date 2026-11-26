import {relay} from '../../../lib/bridge.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
// On Vercel the old bridge to the ChatGPT Sites backend is kept until the move to Cloudflare is finished.
// Everywhere else (Cloudflare Worker, local dev) the API runs inside this app on D1 + R2.
const handle=async(request:Request)=>process.env.VERCEL?relay(request):(await import('../../../lib/server/api.mjs')).handleApi(request);
export const GET=handle;
export const POST=handle;
