import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { onRequest } from '../functions/comercio/[[path]].js';
test('Pages routes both the new commerce root and nested API through its dedicated function',async()=>{
 const routes=JSON.parse(await readFile(new URL('../public/_routes.json',import.meta.url),'utf8'));
 assert.ok(routes.include.includes('/comercio'));assert.ok(routes.include.includes('/comercio/*'));
 const response=await onRequest({request:new Request('https://scalaris.com.ar/comercio')});
 assert.equal(response.status,308);assert.equal(response.headers.get('Location'),'https://scalaris.com.ar/comercio/');
});

test('legacy sales pages redirect GET and HEAD to fixed current offer routes without queries or upstream access',async t=>{
 t.mock.method(globalThis,'fetch',()=>assert.fail('legacy marketing redirect reached the upstream'));
 const mappings=[
  ['/comercio/planes','/catalogo/'],
  ['/comercio/planes/','/catalogo/'],
  ['/comercio/planes/index.html','/catalogo/'],
  ['/comercio/planes/propuesta.html','/catalogo/propuesta'],
  ['/comercio/planes/cartel-precios.svg','/catalogo/cartel-precios.svg'],
  ['/comercio/planes/cartel-precios.html','/catalogo/cartel-precios.svg'],
  ['/comercio/planes/offer.json','/catalogo/offer.json'],
 ];
 for(const method of ['GET','HEAD'])for(const [source,target]of mappings){
  const response=await onRequest({request:new Request(`https://scalaris.com.ar${source}?amount=1&ref=PRIVATE_SENTINEL&next=https://other.example`,{method})});
  assert.equal(response.status,308,`${method} ${source}`);
  assert.equal(response.headers.get('Location'),`https://scalaris.com.ar${target}`);
  assert.equal(response.headers.get('Cache-Control'),'no-store');
  assert.equal(response.headers.get('Referrer-Policy'),'no-referrer');
  assert.equal(await response.text(),'');
 }
});

test('legacy marketing redirects reject mutations and do not capture private or arbitrary nested paths',async t=>{
 const requests=[];
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  requests.push({url,options});
  return new Response('not a marketing redirect',{status:404});
 });
 for(const method of ['POST','PUT','PATCH','DELETE','OPTIONS']){
  const response=await onRequest({request:new Request('https://scalaris.com.ar/comercio/planes/offer.json',{method})});
  assert.equal(response.status,405,method);
 }
 assert.equal(requests.length,0);
 for(const pathname of ['/comercio/planes/.private/issuer.json','/comercio/planes/unknown.html','/comercio/planes-evil','/comercio/api/planes']){
  const response=await onRequest({request:new Request(`https://scalaris.com.ar${pathname}`)});
  assert.equal(response.status,404,pathname);
  assert.equal(response.headers.get('Location'),null,pathname);
  assert.equal(requests.at(-1).url.href,`https://srv2083548.hstgr.cloud${pathname}`);
 }
});
