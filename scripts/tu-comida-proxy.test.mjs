import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { onRequest } from "../functions/tu-comida/[[path]].js";

test("Tu Comida canonical route preserves its query without affecting other Scalaris pages", async (t) => {
  t.mock.method(globalThis, "fetch", () => { throw new Error("unexpected fetch"); });
  const canonical = await onRequest({ request: new Request("https://scalaris.com.ar/tu-comida?from=portfolio") });
  assert.equal(canonical.status, 308);
  assert.equal(canonical.headers.get("Location"), "https://scalaris.com.ar/tu-comida/?from=portfolio");
  assert.equal((await onRequest({ request: new Request("https://scalaris.com.ar/tienda/") })).status, 404);
  assert.equal((await onRequest({ request: new Request("https://scalaris.com.ar/e-medicapp/") })).status, 404);
});

test("Tu Comida serves its fixed static origin and strips browser credentials", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://tu-comida-web.jeremias-j-riv.workers.dev/assets/catalog.js?version=1");
    assert.deepEqual([...options.headers], []);
    assert.equal(options.redirect, "manual");
    assert.equal(options.cf.cacheTtl, 0);
    return new Response("script", { headers: { "Content-Type": "text/javascript", "Set-Cookie": "private=ignored" } });
  });
  const response = await onRequest({ request: new Request("https://scalaris.com.ar/tu-comida/assets/catalog.js?version=1", { headers: { Cookie: "scalaris=private", Authorization: "Bearer scalaris-private" } }) });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "script");
  assert.equal(response.headers.get("Set-Cookie"), null);
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
});

test("Tu Comida preserves the API path, body, origin and bearer without forwarding cookies", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://tu-comida-api.jeremias-j-riv.workers.dev/api/admin?period=month");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.get("Authorization"), "Bearer app-session");
    assert.equal(options.headers.get("Origin"), "https://scalaris.com.ar");
    assert.equal(options.headers.get("Content-Type"), "application/json");
    assert.equal(options.headers.get("Cookie"), null);
    assert.equal(options.headers.get("X-Auth-Session"), null);
    assert.equal(await new Response(options.body).text(), '{"type":"config"}');
    return Response.json({ ok: true });
  });
  const response = await onRequest({ request: new Request("https://scalaris.com.ar/tu-comida/backend/api/admin?period=month", { method: "POST", headers: { Cookie: "scalaris=private", Authorization: "Bearer app-session", "Content-Type": "application/json", Origin: "https://scalaris.com.ar", "X-Auth-Session": "private" }, body: '{"type":"config"}' }) });
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), { ok: true });
});

test("Tu Comida editor and management use independent fixed origins", async (t) => {
  const urls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => { urls.push(url); return new Response(options.method === "HEAD" ? null : "ok"); });
  await onRequest({ request: new Request("https://scalaris.com.ar/tu-comida/editor-api/catalog", { headers: { Authorization: "Bearer editor-session" } }) });
  await onRequest({ request: new Request("https://scalaris.com.ar/tu-comida/gestion/admin/", { method: "HEAD" }) });
  await onRequest({ request: new Request("https://scalaris.com.ar/tu-comida/backend/admin/login?return_to=public") });
  assert.deepEqual(urls, [
    "https://tu-comida-catalog-editor.jeremias-j-riv.workers.dev/catalog",
    "https://tu-comida-management.jeremias-j-riv.workers.dev/admin/",
    "https://tu-comida-api.jeremias-j-riv.workers.dev/admin/login?return_to=public",
  ]);
});

test("Tu Comida maps safe upstream redirects and keeps login fragments on the public domain", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.redirect("https://tu-comida-web.jeremias-j-riv.workers.dev/editar/?source=menu", 301));
  let response = await onRequest({ request: new Request("https://scalaris.com.ar/tu-comida/editar") });
  assert.equal(response.headers.get("Location"), "https://scalaris.com.ar/tu-comida/editar/?source=menu");
  globalThis.fetch.mock.mockImplementation(async () => Response.redirect("https://tu-comida-management.jeremias-j-riv.workers.dev/admin/#admin_token=fixture-session", 302));
  response = await onRequest({ request: new Request("https://scalaris.com.ar/tu-comida/backend/admin/login") });
  assert.equal(response.headers.get("Location"), "https://scalaris.com.ar/tu-comida/gestion/admin/#admin_token=fixture-session");
  globalThis.fetch.mock.mockImplementation(async () => Response.redirect("https://scalaris.com.ar/tu-comida/gestion/admin/#admin_token=fixture-session", 302));
  response = await onRequest({ request: new Request("https://scalaris.com.ar/tu-comida/backend/admin/login") });
  assert.equal(response.headers.get("Location"), "https://scalaris.com.ar/tu-comida/gestion/admin/#admin_token=fixture-session");
  for (const location of ["https://evil.example/", "https://scalaris.com.ar/tienda/", "https://tu-comida-web.jeremias-j-riv.workers.dev.evil.example/"]) {
    globalThis.fetch.mock.mockImplementation(async () => Response.redirect(location, 302));
    assert.equal((await onRequest({ request: new Request("https://scalaris.com.ar/tu-comida/") })).status, 502);
  }
});

test("Tu Comida keeps static JSON fresh, preserves errors and restricts methods", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, options) => new Response(options.method === "HEAD" ? null : "missing", { status: 404 }));
  const response = await onRequest({ request: new Request("https://scalaris.com.ar/tu-comida/catalog.json") });
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal((await onRequest({ request: new Request("https://scalaris.com.ar/tu-comida/", { method: "POST" }) })).status, 405);
  assert.equal((await onRequest({ request: new Request("https://scalaris.com.ar/tu-comida/backend/api/admin", { method: "DELETE" }) })).status, 405);
  globalThis.fetch.mock.mockImplementation(async () => new Response(null, { status: 204 }));
  assert.equal((await onRequest({ request: new Request("https://scalaris.com.ar/tu-comida/backend/api/admin", { method: "OPTIONS" }) })).status, 204);
  globalThis.fetch.mock.mockImplementation(async () => { throw new Error("offline"); });
  assert.equal((await onRequest({ request: new Request("https://scalaris.com.ar/tu-comida/") })).status, 502);
});

test("Pages retains Tu Comida routes and supports public Worker fetches", () => {
  const routes = JSON.parse(readFileSync(new URL("../public/_routes.json", import.meta.url)));
  for (const prefix of ["/e-medicapp", "/e-medicapp/*", "/tu-comida", "/tu-comida/*"]) assert.ok(routes.include.includes(prefix));
  assert.ok(routes.include.every(route => route !== '/*'));
  assert.deepEqual(routes.exclude, []);
  const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url)));
  assert.equal(config.name, "scalaris");
  assert.equal(config.pages_build_output_dir, "./public");
  assert.ok(config.compatibility_flags.includes("global_fetch_strictly_public"));
});
