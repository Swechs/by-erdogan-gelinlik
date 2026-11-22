import {relay} from '../../../lib/bridge.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const handle=(request:Request)=>relay(request);
export const GET=handle;
export const POST=handle;
