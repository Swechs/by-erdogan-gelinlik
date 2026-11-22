import test from 'node:test';
import assert from 'node:assert/strict';
import {relay,allowedPath,BACKEND_ORIGIN} from '../lib/bridge.mjs';
const origin='https://atelier.example';
const post=(path,extra={})=>new Request(origin+'/api/'+path,{method:'POST',headers:{origin,'content-type':'application/json',...extra},body:'{}'});
test('only customer operations are allowed; admin and arbitrary paths are blocked',async()=>{
 for(const path of ['admin','admin/model','../admin','admin%2fsettings','https://evil.example'])assert.equal(allowedPath(path,'GET'),false);
 const r=await relay(new Request(origin+'/api/admin'),()=>{throw Error('must not fetch')});assert.equal(r.status,404);
});
test('cross-origin writes are rejected before upstream access',async()=>{
 const r=await relay(post('book',{origin:'https://evil.example'}),()=>{throw Error('must not fetch')});assert.equal(r.status,403);
});
test('client identity and credentials are never forwarded',async()=>{
 const r=await relay(post('booking/status',{'oai-authenticated-user-email':'owner@example.com','oai-authenticated-user-id':'owner',authorization:'Bearer attacker',cookie:'sensitive=1'}),async(url,init)=>{
  assert.equal(url,BACKEND_ORIGIN+'/api/booking/status');
  assert.equal(init.headers.get('oai-authenticated-user-email'),null);
  assert.equal(init.headers.get('oai-authenticated-user-id'),null);
  assert.equal(init.headers.get('authorization'),null);assert.equal(init.headers.get('cookie'),null);
  assert.equal(init.headers.get('OAI-Sites-Authorization'),null);
  assert.equal(init.redirect,'manual');return Response.json({status:'pending'},{headers:{'set-cookie':'private=1'}});
 });assert.equal(r.status,200);assert.equal(r.headers.get('set-cookie'),null);assert.equal(r.headers.get('OAI-Sites-Authorization'),null);
});
test('upstream login redirects and HTML errors become safe JSON errors',async()=>{
 for(const response of [new Response(null,{status:302,headers:{location:'https://login.example'}}),new Response('<script>bad</script>',{status:500,headers:{'content-type':'text/html'}})]){
 const r=await relay(new Request(origin+'/api/catalog'),async()=>response);assert.equal(r.status,502);assert.ok((await r.json()).error);
 }
});
test('upstream customer errors and image content types are preserved',async()=>{
 const r=await relay(post('try/status'),async()=>Response.json({error:'Süresi doldu.'},{status:410}));assert.equal(r.status,410);
 const image=await relay(post('try/image'),async()=>new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'image/png'}}));assert.equal(image.headers.get('content-type'),'image/png');
});
test('network failure is recoverable',async()=>{
 assert.equal((await relay(new Request(origin+'/api/catalog'),async()=>{throw Error('network')})).status,504);
});
