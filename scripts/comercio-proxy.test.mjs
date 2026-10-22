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
