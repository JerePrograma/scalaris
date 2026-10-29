import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { onRequest } from '../functions/indumentaria/[[path]].js';

test('Indumentaria routes its assets only to the fixed VPS and discards unrelated credentials', async t => {
  const routes = JSON.parse(readFileSync(new URL('../public/_routes.json', import.meta.url), 'utf8'));
  assert.ok(routes.include.includes('/indumentaria'));
  assert.ok(routes.include.includes('/indumentaria/*'));
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://srv2083548.hstgr.cloud/indumentaria/assets/app.js?v=release');
    assert.equal(options.method, 'GET');
    assert.deepEqual([...options.headers], []);
    return new Response('compiled-app', { headers: { 'Content-Type': 'text/javascript', 'Set-Cookie': 'another_app=discard' } });
  });
  const response = await onRequest({ request: new Request('https://scalaris.com.ar/indumentaria/assets/app.js?v=release', { headers: { Cookie: 'private_session=discard', Authorization: 'Bearer discard' } }) });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'compiled-app');
  assert.equal(response.headers.get('Content-Type'), 'text/javascript');
  assert.equal(response.headers.get('Set-Cookie'), null);
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
});

test('Indumentaria canonicalizes its prefix and blocks mutations and routes belonging to other projects', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('A blocked or canonicalized request reached the VPS'));
  const redirect = await onRequest({ request: new Request('https://scalaris.com.ar/indumentaria?from=demo') });
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get('Location'), 'https://scalaris.com.ar/indumentaria/?from=demo');
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const response = await onRequest({ request: new Request('https://scalaris.com.ar/indumentaria/', { method }) });
    assert.equal(response.status, 405);
  }
  assert.equal((await onRequest({ request: new Request('https://scalaris.com.ar/comercio/') })).status, 404);
  assert.equal((await onRequest({ request: new Request('https://scalaris.com.ar/indumentaria-ajena/') })).status, 404);
});

test('Indumentaria HEAD stays bodyless and HTML receives no-store cache policy', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://srv2083548.hstgr.cloud/indumentaria/');
    assert.equal(options.method, 'HEAD');
    return new Response('upstream-body', { headers: { 'Content-Type': 'text/html' } });
  });
  const response = await onRequest({ request: new Request('https://scalaris.com.ar/indumentaria/', { method: 'HEAD' }) });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
