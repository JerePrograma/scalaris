import assert from 'node:assert/strict';
import { test } from 'node:test';
import { onRequest as pharmahome } from '../functions/pharmahome/[[path]].js';
import { onRequest as gestudio } from '../functions/gestudio-api/[[path]].js';
import { onRequest as fourbubbles } from '../functions/fourbubbles-api/[[path]].js';

test('static demos use only the fixed VPS route and discard browser credentials', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://srv2083548.hstgr.cloud/pharmahome/assets/app.js?v=1');
    assert.deepEqual([...options.headers], []);
    return new Response('asset', { headers: { 'Set-Cookie': 'unrelated=secret' } });
  });
  const response = await pharmahome({ request: new Request('https://scalaris.com.ar/pharmahome/assets/app.js?v=1', { headers: { Cookie: 'private=session', Authorization: 'Bearer private' } }) });
  assert.equal(await response.text(), 'asset');
  assert.equal(response.headers.get('Set-Cookie'), null);
  assert.equal((await pharmahome({ request: new Request('https://scalaris.com.ar/pharmahome?from=gallery') })).headers.get('Location'), 'https://scalaris.com.ar/pharmahome/?from=gallery');
});

test('API login forwards only its own refresh cookie and preserves a host-only secure response', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://srv2083548.hstgr.cloud/gestudio-api/api/login/refresh');
    assert.equal(options.headers.get('Cookie'), 'gestudio_scalaris_refresh=demo-session');
    assert.equal(options.headers.get('Authorization'), 'Bearer demo-access');
    assert.equal(options.headers.get('Origin'), 'https://scalaris.com.ar');
    assert.equal(await new Response(options.body).text(), '{}');
    const headers = new Headers();
    headers.append('Set-Cookie', 'gestudio_scalaris_refresh=rotated; Domain=srv2083548.hstgr.cloud; Path=/gestudio-api/api/login; HttpOnly; Secure; SameSite=Strict');
    headers.append('Set-Cookie', 'unrelated=discard; Path=/');
    return new Response('{}', { headers });
  });
  const response = await gestudio({ request: new Request('https://scalaris.com.ar/gestudio-api/api/login/refresh', { method: 'POST', body: '{}', headers: { Cookie: 'fourbubbles_demo_refresh=other; gestudio_scalaris_refresh=demo-session; scalaris=private', Origin: 'https://scalaris.com.ar', Authorization: 'Bearer demo-access' } }) });
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.getSetCookie().length, 1);
  assert.match(response.headers.get('Set-Cookie'), /Path=\/gestudio-api\/api\/login; HttpOnly; Secure/);
  assert.doesNotMatch(response.headers.get('Set-Cookie'), /Domain=|unrelated/);
});

test('public demos reject mutations and cross-site login before contacting the backend', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('blocked request reached backend'));
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const response = await fourbubbles({ request: new Request('https://scalaris.com.ar/fourbubbles-api/api/orders', { method }) });
    assert.equal(response.status, 405);
  }
  assert.equal((await gestudio({ request: new Request('https://scalaris.com.ar/gestudio-api/api/login', { method: 'POST', headers: { Origin: 'https://another.example' } }) })).status, 403);
  assert.equal((await pharmahome({ request: new Request('https://scalaris.com.ar/tienda/') })).status, 404);
});

test('switching a Gestudio organization remains an allowed authenticated session operation', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://srv2083548.hstgr.cloud/gestudio-api/api/login/tenant');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.get('Authorization'), 'Bearer tenant-session');
    return Response.json({ tenantId: 'synthetic-beta' });
  });
  const response = await gestudio({ request: new Request('https://scalaris.com.ar/gestudio-api/api/login/tenant', { method: 'POST', body: '{"tenantId":"synthetic-beta"}', headers: { Authorization: 'Bearer tenant-session', Origin: 'https://scalaris.com.ar' } }) });
  assert.equal(response.status, 200);
});

test('redirects cannot send demo visitors or credentials to another site', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.redirect('https://srv2083548.hstgr.cloud/pharmahome/nuevo', 302));
  let response = await pharmahome({ request: new Request('https://scalaris.com.ar/pharmahome/') });
  assert.equal(response.headers.get('Location'), 'https://scalaris.com.ar/pharmahome/nuevo');
  globalThis.fetch.mock.mockImplementation(async () => Response.redirect('https://attacker.example/', 302));
  response = await pharmahome({ request: new Request('https://scalaris.com.ar/pharmahome/') });
  assert.equal(response.status, 502);
});
