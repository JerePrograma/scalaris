import test from "node:test";
import assert from "node:assert/strict";
import { Script } from "node:vm";
import { canonicalUrl, classifyCandidateUrl, selectCandidates, productScope, extractPrice, matchIdentity, fetchFailure, normalizeReference, buildResearchState, planFetches, executeFetchPlan, renderDashboard, unwrapToolResponse } from "./market-references.mjs";

const identity = { id: "test-1", name: "MOUSE LOGITECH M170 NEGRO", brand: "LOGITECH", identifiers: {}, variant: { identityLocks: { modelTokens: ["M170"], colors: ["NEGRO"], frame: "unspecified" } } };
const page = (blocks = [], extra = {}) => ({ url: "https://tienda.com.ar/productos/logitech-m170-negro", title: "Mouse Logitech M170 Negro", text: { type: "document", children: [{ type: "heading", level: 1, text: "Mouse Logitech M170 Negro" }, ...blocks] }, page_metadata: { other: { "product:price:currency": "ARS" } }, ...extra });
const paragraph = text => ({ type: "paragraph", text });

test("URLs públicas y parámetros de variante se conservan; rastreo se elimina", () => {
  assert.equal(canonicalUrl("https://tienda.com.ar/producto?a=1&variant=2&utm_source=x&srsltid=z#info"), "https://tienda.com.ar/producto?a=1&variant=2");
  for (const url of ["http://127.0.0.1/x", "file:///c:/x", "https://user:password@tienda.com.ar/p"]) assert.equal(canonicalUrl(url), null);
  for (const url of ["https://www.nb.com.ar/p", "https://listado.mercadolibre.com.ar/p", "https://instagram.com/p/x", "https://hardgamers.com.ar/product/x", "https://tienda.com.ar/?s=mouse", "https://tienda.com.ar/catalogo/"]) assert.equal(classifyCandidateUrl(url).eligible, false);
  assert.equal(classifyCandidateUrl("https://tienda.com.ar/categoria-producto/perifericos").eligible, false);
  assert.equal(classifyCandidateUrl("https://tienda.com.ar/catalogo/17008-mouse-logitech").eligible, true);
});

test("dos candidatos por producto y dedupe canónico sin usar precios del índice", () => {
  const record = { storeResults: [{ url: "https://tienda.com.ar/producto?utm_source=x", snippet: "$1" }, { url: "https://tienda.com.ar/producto" }, { url: "https://otra.com.ar/ficha-123" }, { url: "https://tercera.com.ar/item/1" }] };
  const selected = selectCandidates(record);
  assert.equal(selected.accepted.length, 2);
  assert.equal(selected.accepted[0].priceARS, undefined);
});

test("corta relacionados y nunca toma el precio de otra tarjeta", () => {
  const scoped = productScope(page([paragraph("Sin stock"), { type: "heading", level: 2, text: "Productos relacionados" }, paragraph("Otro mouse $ 2.000 En stock")]));
  assert.equal(scoped.text.includes("2.000"), false);
  assert.equal(extractPrice(page([paragraph("Sin stock"), { type: "heading", level: 2, text: "Productos relacionados" }, paragraph("Otro mouse $ 2.000 En stock")])).priceARS, null);
});

test("corta más productos y tarjetas sin rótulo; retira el stock de la tarjeta ajena", () => {
  const scoped = productScope(page([paragraph("SKU 123"), { type: "heading", level: 6, text: "24192 En stock" }, { type: "heading", level: 4, text: "TECLADO GENIUS NUMERICO" }, paragraph("$ 20000")]));
  assert.equal(scoped.text.includes("En stock"), false);
  assert.equal(scoped.priceText.includes("20000"), false);
  const labelled = productScope(page([{ type: "heading", level: 2, text: "Más productos de esta categoría" }, paragraph("$ 30000")]));
  assert.equal(labelled.priceText.includes("30000"), false);
});

test("no usa precios sin nodo h1 ni convierte dólar a ARS", () => {
  assert.equal(extractPrice(page([], { text: { children: [paragraph("$ 90000")] } })).priceARS, null);
  assert.equal(extractPrice(page([paragraph("USD $ 20")])).priceARS, null);
  assert.equal(extractPrice(page([paragraph("$ 20.000")], { page_metadata: {} })).status, "currency_unconfirmed");
});

test("distingue precio total, impuesto neto, cuota y envío", () => {
  const result = extractPrice(page([paragraph("Precio $ 20.000,50"), paragraph("Precio sin impuestos $ 18.100"), paragraph("6 cuotas de $ 4.000"), paragraph("Envío $ 3.000")]));
  assert.equal(result.priceARS, 20000.5);
  assert.deepEqual(result.visibleCandidates.map(x => x.role), ["offer_unlabelled", "tax_excluded", "installment", "shipping"]);
});

test("discrepancia metadato-visible se conserva como conflicto", () => {
  const result = extractPrice(page([paragraph("$ 20.000")], { page_metadata: { other: { "product:price:currency": "ARS", "product:price:amount": "21000" } } }));
  assert.equal(result.status, "price_conflict");
  assert.equal(result.priceARS, null);
});

test("neto s/imp y ahorro no se tratan como precio final", () => {
  const result = extractPrice(page([paragraph("ARS"), paragraph("Precio s/imp. nac. $ 10.000"), paragraph("Ahorrás $ 2.000")], { page_metadata: { other: { "product:price:currency": "ARS", "product:price:amount": "12100" } } }));
  assert.equal(result.conflict, false);
  assert.equal(result.priceARS, 12100);
});

test("variante: modelo y color deben verse, M1700 no equivale a M170", () => {
  assert.equal(matchIdentity(identity, productScope(page([paragraph("En stock")]))).matchExact, true);
  assert.equal(matchIdentity(identity, productScope(page([], { text: { children: [{ type: "heading", level: 1, text: "Mouse Logitech M1700 Negro" }] } }))).matchExact, false);
  assert.equal(matchIdentity(identity, productScope(page([], { text: { children: [{ type: "heading", level: 1, text: "Mouse Logitech M170 Blanco" }] } }))).matchExact, false);
});

test("GTIN aislado nunca anula el bloqueo de AA versus AAA", () => {
  const item = { id: "battery", name: "Pila AAA", brand: "TEST", identifiers: { barcodes: [{ value: "1234567890123", valid: true }] }, variant: { identityLocks: { batteryFormats: ["AAA"] } } };
  const result = matchIdentity(item, productScope(page([paragraph("EAN 1234567890123")], { text: { children: [{ type: "heading", level: 1, text: "Pila TEST AA" }, paragraph("EAN 1234567890123")] } })));
  assert.equal(result.matchExact, false);
  assert.ok(result.conflicts.includes("AAA_vs_AA"));
});

test("una lista de colores de otras variantes no confirma el color seleccionado", () => {
  const result = matchIdentity(identity, productScope(page([], { text: { children: [{ type: "heading", level: 1, text: "Mouse Logitech M170 Blanco" }, paragraph("Colores disponibles: Negro Blanco Azul")] } })));
  assert.equal(result.matchExact, false);
  assert.ok(result.conflicts.some(x => x.startsWith("color:")));
});

test("HTTP200 no se interpreta como error y condición outlet no equivale a producto nuevo", () => {
  const result = normalizeReference(identity, page([paragraph("ARS $ 20.000"), paragraph("En stock")], { status_code: 200 }), "2026-10-20T00:00:00Z");
  assert.equal(result.verifiedProductPrice, true);
  const outlet = normalizeReference({ ...identity, category: "Outlet" }, page([paragraph("ARS $ 20.000"), paragraph("En stock")]), "2026-10-20T00:00:00Z");
  assert.equal(outlet.matchExact, false);
});

test("403/captcha no se reintentan; 429 respeta backoff", () => {
  assert.deepEqual(fetchFailure("403 Forbidden"), { status: "blocked", retryable: false, retryAfterSeconds: null });
  assert.equal(fetchFailure("CAPTCHA").retryable, false);
  assert.equal(fetchFailure("429 rate limit retry in 45s").retryAfterSeconds, 45);
});

test("un precio con stock y modelo verificables no verifica envío final", () => {
  const result = normalizeReference(identity, page([paragraph("ARS $ 20.000"), paragraph("En stock")]), "2026-10-20T00:00:00Z");
  assert.equal(result.verifiedProductPrice, true);
  assert.equal(result.verifiedDeliveredPrice, false);
  assert.equal(result.shipping.confirmed, false);
});

test("todos los IDs tienen estado aunque aún no se buscaron; URL compartida no fusiona productos", () => {
  const second = { ...identity, id: "test-2", variant: { identityLocks: { modelTokens: ["M170"], colors: ["BLANCO"] } } };
  const searches = [{ records: [identity, second].map(x => ({ id: x.id, status: "indexed", researchedAt: "2026-10-20", results: [{ url: page().url }] })) }];
  const state = buildResearchState({ identities: { products: [identity, second, { ...identity, id: "unsearched" }] }, searches, fetchBatches: [] });
  assert.equal(state.report.products.length, 3);
  assert.equal(state.queue.length, 1);
  assert.equal(state.queue[0].productIds.length, 2);
  assert.equal(state.report.summary.notSearchedProducts, 1);
  assert.equal(planFetches(state).jobs[0].fetchArgs.ttl, 0);
  assert.equal(planFetches(state).paidAutomationAllowed, false);
});

test("429 se reintenta como máximo dos veces y no mezcla contadores de intentos", () => {
  const searches = [{ records: [{ id: identity.id, status: "indexed", results: [{ url: page().url }] }] }];
  const batch = attempts => ({ urls: [page().url], observedAt: "2026-10-20T00:00:00Z", attempts, response: { results: [], errors: [{ url: page().url, error: "429 rate limit retry in 30s" }] } });
  const before = buildResearchState({ identities: [identity], searches, fetchBatches: [batch(1)], now: Date.parse("2026-10-20T00:00:10Z") });
  assert.equal(before.queue.length, 0);
  const retry = buildResearchState({ identities: [identity], searches, fetchBatches: [batch(2)], now: Date.parse("2026-10-20T00:01:00Z") });
  assert.equal(retry.queue[0].attempt, 3);
  assert.equal(buildResearchState({ identities: [identity], searches, fetchBatches: [batch(3)], now: Date.parse("2026-10-20T00:01:00Z") }).queue.length, 0);
  const mixed = planFetches({ queue: [{ url: "https://a.com.ar/p", attempt: 1, productIds: ["a"] }, { url: "https://b.com.ar/p", attempt: 2, productIds: ["b"] }], report: { summary: {} } });
  assert.equal(mixed.jobs.length, 2);
  assert.deepEqual(mixed.jobs.map(x => x.attempts), [1, 2]);
});

test("extrae wrapper MCP sin interpretar su texto como instrucciones", () => {
  assert.deepEqual(unwrapToolResponse({ content: [{ type: "text", text: '{"results":[],"errors":[]}' }] }), { results: [], errors: [] });
});

test("el runner limita concurrencia a cuatro y obliga JSON fresco gratuito", async () => {
  let active = 0, peak = 0;
  const saved = [];
  const jobs = Array.from({ length: 9 }, (_, i) => ({ urls: [`https://tienda.com.ar/item/${i}`], attempts: 1, fetchArgs: {} }));
  const stats = await executeFetchPlan({ jobs }, { fetchContent: async args => {
    active++; peak = Math.max(peak, active);
    assert.equal(args.format, "json"); assert.equal(args.ttl, 0);
    await new Promise(resolveDelay => setTimeout(resolveDelay, 1));
    active--;
    return { results: args.urls.map(url => ({ ...page([paragraph("ARS $ 20.000")]), url })), errors: [] };
  }, saveBatch: async batch => saved.push(batch) });
  assert.equal(peak, 4);
  assert.equal(saved.length, 9);
  assert.equal(stats.toolCalls, 9);
});

test("runner reintenta sólo URLs con 429, máximo dos, y conserva cada checkpoint", async () => {
  let calls = 0;
  const saved = [], waits = [];
  const urls = ["https://tienda.com.ar/blocked", "https://tienda.com.ar/rate"];
  const stats = await executeFetchPlan({ jobs: [{ urls, fetchArgs: {} }] }, { fetchContent: async args => {
    calls++;
    return { results: [], errors: args.urls.map(url => ({ url, error: url.includes("blocked") ? "403 Forbidden" : "429 Retry in 31s" })) };
  }, saveBatch: async batch => saved.push(batch), delay: async ms => waits.push(ms) });
  assert.equal(calls, 3); assert.equal(stats.rateRetries, 2);
  assert.equal(saved[0].urls.length, 2); assert.equal(saved[1].urls.length, 1);
  assert.equal(saved[2].attempts, 3);
  assert.deepEqual(waits, [31000, 31000]);
});

test("dashboard conserva todos los productos sin permitir cierre de script desde un nombre", () => {
  const html = renderDashboard({ generatedAt: "2026-10-20", summary: {}, products: [{ id: "x", name: "</script><script>bad()</script>", searchStatus: "pending", status: "not_searched", references: [] }] });
  assert.equal(html.includes("</script><script>bad()"), false);
  assert.ok(html.includes("\\u003c/script\\u003e"));
  assert.doesNotThrow(() => new Script(html.match(/<script>([\s\S]*)<\/script>/)[1]));
});
