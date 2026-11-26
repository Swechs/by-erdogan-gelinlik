import type {NextConfig} from 'next';
import {initOpenNextCloudflareForDev} from '@opennextjs/cloudflare';
// Vercel still uses the ChatGPT Sites admin until the move to Cloudflare is finished.
const legacyAdmin=process.env.VERCEL?[{source:'/yonetim',destination:'https://by-erdogan-gelinlik.swechs.chatgpt.site/yonetim',permanent:false}]:[];
const config:NextConfig={
  poweredByHeader:false,
  async redirects(){return legacyAdmin;},
  async headers(){return [{source:'/:path*',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},{key:'Content-Security-Policy',value:"frame-ancestors 'self'"}]}];}
};
export default config;
if(process.env.NODE_ENV==='development'&&!process.env.VERCEL)void initOpenNextCloudflareForDev();
