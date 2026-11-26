import 'server-only';
import {cache} from 'react';
import {BACKEND_ORIGIN,upstreamHeaders} from './bridge.mjs';
import type {Data} from '../components/types';
async function bridged():Promise<Data>{
  const r=await fetch(BACKEND_ORIGIN+'/api/catalog',{headers:upstreamHeaders('GET'),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!r.ok||!r.headers.get('content-type')?.includes('application/json'))throw Error('Atelier catalog unavailable.');
  return await r.json();
}
export const publicData=cache(async ():Promise<Data>=>process.env.VERCEL?bridged():(await import('./server/api.mjs')).publicData() as Promise<Data>);
