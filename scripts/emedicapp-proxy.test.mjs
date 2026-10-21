import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { onRequest } from "../functions/e-medicapp/[[path]].js";

test("E-MEDICAPP canonical path preserves query parameters", async () => {
  const response = await onRequest({ request: new Request("https://scalaris.com.ar/e-medicapp?source=demo") });
  assert.equal(response.status, 308);
  assert.equal(response.headers.get("Location"), "https://scalaris.com.ar/e-medicapp/?source=demo");
});

test("E-MEDICAPP serves the fixed public build without forwarding browser credentials", async (t) => {
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requests.push({ url, options });
    return new Response('{"commit":"current"}', { headers: { "Content-Type": "application/json", "Set-Cookie": "upstream=ignored" } });
  });
  const response = await onRequest({ request: new Request("https://scalaris.com.ar/e-medicapp/deployment.json?check=123", {
    headers: { Cookie: "private=scalaris", Authorization: "Bearer private", "X-Auth-Session": "private" },
  }) });
  assert.equal(requests[0].url, "https://jereprograma.github.io/E-MEDICAPP/deployment.json?check=123");
  assert.equal(requests[0].options.headers, undefined);
  assert.equal(requests[0].options.cf.cacheTtl, 0);
  assert.equal(response.headers.get("Set-Cookie"), null);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(await response.text(), '{"commit":"current"}');
});

test("E-MEDICAPP forwards asset paths and HEAD, and preserves missing-file responses", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://jereprograma.github.io/E-MEDICAPP/assets/missing.js");
    assert.equal(options.method, "HEAD");
    return new Response(null, { status: 404 });
  });
  const response = await onRequest({ request: new Request("https://scalaris.com.ar/e-medicapp/assets/missing.js", { method: "HEAD" }) });
  assert.equal(response.status, 404);
});

test("E-MEDICAPP rewrites only redirects within its fixed publication", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.redirect("https://jereprograma.github.io/E-MEDICAPP/catalog/?x=1", 301));
  const response = await onRequest({ request: new Request("https://scalaris.com.ar/e-medicapp/catalog") });
  assert.equal(response.headers.get("Location"), "https://scalaris.com.ar/e-medicapp/catalog/?x=1");
  globalThis.fetch.mock.mockImplementation(async () => Response.redirect("https://other.example/", 302));
  assert.equal((await onRequest({ request: new Request("https://scalaris.com.ar/e-medicapp/") })).status, 502);
});

test("E-MEDICAPP limits methods and handles publication failures", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { throw new Error("offline"); });
  assert.equal((await onRequest({ request: new Request("https://scalaris.com.ar/e-medicapp/", { method: "POST" }) })).status, 405);
  assert.equal((await onRequest({ request: new Request("https://scalaris.com.ar/tienda/") })).status, 404);
  assert.equal((await onRequest({ request: new Request("https://scalaris.com.ar/e-medicapp/") })).status, 502);
  const routes = JSON.parse(readFileSync(new URL("../public/_routes.json", import.meta.url)));
  assert.deepEqual(routes.include, ["/e-medicapp", "/e-medicapp/*"]);
  assert.deepEqual(routes.exclude, []);
});
