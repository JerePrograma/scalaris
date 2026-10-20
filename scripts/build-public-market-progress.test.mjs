import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { buildPublicMarketProgress, publicReferenceUrl } from "./build-public-market-progress.mjs";

const at = "2026-10-20T18:30:00.000Z";
const observedAt = "2026-10-20T18:00:00.000Z";
const catalog = { version: 1, products: [{ id: "p-1" }, { id: "p-2" }] };
const research = (products = [{ id: "p-1", searchStatus: "indexed", searchedAt: observedAt }]) => ({ version: 1, generatedAt: at, products });
const seed = (overrides = {}) => ({ id: "p-1", status: "verified", matchExact: true, variantVerified: true, paymentComparable: true, priceVerifiedOnPage: true, available: true, currency: "ARS", priceARS: 25000, payment: "transferencia", observedAt, url: "https://comercio.com.ar/producto/modelo", ...overrides });
const build = (data = research(), seeds = []) => buildPublicMarketProgress(catalog, data, seeds, at);

test("salida whitelist: ningún costo, proveedor, margen, snippet o precio parcial sale del reporte privado", () => {
  const sentinel = "PRIVATE_SENTINEL";
  const data = research([{ id: "p-1", searchStatus: "indexed", searchedAt: observedAt, supplier: sentinel, cost: sentinel, references: [{ verifiedProductPrice: true, priceARS: 999, snippet: sentinel }] }]);
  data.summary = { searchSuccessfulProducts: 999, private: sentinel };
  data.secret = sentinel;
  const result = build(data, [seed({ supplier: sentinel, cost: sentinel, margin: sentinel, rawSnippet: sentinel })]);
  assert.deepEqual(Object.keys(result), ["version", "updatedAt", "summary", "products"]);
  assert.deepEqual(Object.keys(result.summary), ["totalProducts", "researchedProducts", "productsWithVerifiedReferences", "verifiedReferences"]);
  assert.deepEqual(Object.keys(result.products[0]), ["id", "references"]);
  assert.deepEqual(Object.keys(result.products[0].references[0]), ["url", "priceARS", "currency", "observedAt"]);
  assert.equal(result.summary.researchedProducts, 1);
  assert.ok(!JSON.stringify(result).includes(sentinel));
  assert.ok(!JSON.stringify(result).includes("999"));
  assert.deepEqual(build(data).products, []);
});

test("sólo seeds estrictos, vigentes, por transferencia y elegibles se publican", () => {
  const invalid = [{ status: "candidate" }, { matchExact: false }, { variantVerified: false }, { priceVerifiedOnPage: false }, { available: false }, { paymentComparable: false }, { currency: "USD" }, { payment: "tarjeta" }, { fromSnippet: true }, { evidenceSource: "snippet" }, { priceARS: "25000" }, { verifiedProductPrice: true, status: "verified_product_price" }, { observedAt: "2026-10-19T18:00:00Z" }, { observedAt: "2026-10-21T00:00:00Z" }, { id: "not-public" }];
  for (const value of invalid) assert.deepEqual(build(research(), [seed(value)]).products, [], JSON.stringify(value));
  const result = build(research(), { references: [seed()] });
  assert.equal(result.summary.verifiedReferences, 1);
  assert.equal(result.products[0].references[0].observedAt, observedAt);
  assert.equal(result.products[0].references[0].priceARS, 25000);
});

test("rechaza URL de acción, credenciales/sesión, privada, proveedor, marketplace o categoría", () => {
  const invalid = ["javascript:alert(1)", "https://user:password@comercio.com.ar/producto/x", "http://127.0.0.1/producto/x", "https://comercio.com.ar/checkout/", "https://comercio.com.ar/producto/x?add-to-cart=123", "https://comercio.com.ar/cart/?action=buy", "https://www.nb.com.ar/producto/x", "https://articulo.mercadolibre.com.ar/MLA-123", "https://comercio.com.ar/categoria-producto/equipos"];
  for (const key of ["token", "access_token", "api_key", "Password", "auth", "auth-token", "session_id", "PHPSESSID", "X-Amz-Signature", "client_secret", "sid", "code"]) invalid.push(`https://comercio.com.ar/producto/x?${key}=PRIVATE_SENTINEL`);
  invalid.push("https://comercio.com.ar/producto/x?%2574oken=PRIVATE_SENTINEL", "https://comercio.com.ar/producto/x;%73essionid=PRIVATE_SENTINEL", "https://comercio.com.ar/producto/x%3Bjsessionid%3DPRIVATE_SENTINEL", "https://comercio.com.ar/producto/x?%2525252574oken=PRIVATE_SENTINEL");
  for (const url of invalid) {
    assert.equal(publicReferenceUrl(url), null, url);
    assert.deepEqual(build(research(), [seed({ url })]).products, [], url);
  }
  assert.equal(publicReferenceUrl("https://comercio.com.ar/producto/x?utm_source=search#section"), "https://comercio.com.ar/producto/x");
});

test("dedup por URL canónica conserva última observación y jamás fusiona IDs", () => {
  const seeds = [seed({ observedAt: "2026-10-20T17:00:00Z", priceARS: 20000 }), seed({ url: "https://comercio.com.ar/producto/modelo?utm_source=x", priceARS: 26000 }), seed({ id: "p-2", priceARS: 27000 })];
  const result = build(research(), seeds);
  assert.equal(result.products.length, 2);
  assert.equal(result.summary.verifiedReferences, 2);
  assert.equal(result.products[0].references[0].priceARS, 26000);
  assert.deepEqual(build(research(), [seed(), seed({ priceARS: 26000 })]).products, []);
});

test("agregados se calculan por IDs únicos, cuentan vacíos y no copian errores o sumarios privados", () => {
  const rows = [
    { id: "p-1", searchStatus: "error", searchedAt: "2026-10-20T17:00:00Z" },
    { id: "p-1", searchStatus: "indexed", searchedAt: observedAt },
    { id: "p-1", searchStatus: "indexed", searchedAt: observedAt },
    { id: "p-2", searchStatus: "noIndexedResults", searchedAt: observedAt },
    { id: "private-id", searchStatus: "indexed", searchedAt: observedAt },
  ];
  assert.equal(build(research(rows)).summary.researchedProducts, 2);
  assert.throws(() => buildPublicMarketProgress({ products: [{ id: "x" }, { id: "x" }] }, research(), [], at), /IDs/);
  assert.equal(build(research([{ id: "p-1", searchStatus: "error", searchedAt: observedAt }])).summary.researchedProducts, 0);
});

test("fechas inválidas o futuras no presentan avance conocido; fecha pública es ISO", () => {
  assert.equal(build().updatedAt, at);
  assert.equal(build(null).summary.researchedProducts, null);
  assert.equal(build({ ...research(), generatedAt: "invalid" }).updatedAt, null);
  assert.equal(build({ ...research(), generatedAt: "2026-10-21T00:00:00Z" }).summary.researchedProducts, null);
  assert.equal(build(research([{ id: "p-1", searchStatus: "indexed", searchedAt: "2026-10-21T00:00:00Z" }])).summary.researchedProducts, 0);
  assert.throws(() => buildPublicMarketProgress(catalog, research(), [], "invalid"), /fecha/);
});

// Run the actual storefront module with a small DOM and controlled fetch promises.
// This exercises independent loading, an already-open dialog and expiry without a browser/network.
class Node {
  constructor(tag = "div") { this.tagName = tag; this.children = []; this.listeners = {}; this.attributes = {}; this.value = ""; this.hidden = false; this.dataset = {}; this.open = false; this._text = ""; }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent || "").join(""); }
  append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
  replaceChildren(...children) { this._text = ""; this.children = []; this.append(...children); }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key] ?? null; }
  hasAttribute(key) { return key in this.attributes; }
  removeAttribute(key) { delete this.attributes[key]; }
  addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
  emit(name) { for (const fn of this.listeners[name] || []) fn({ target: this, preventDefault() {} }); }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(selector.startsWith(".") ? (child.className || "").split(" ").includes(selector.slice(1)) : child.tagName === selector) ? [child] : [], ...child.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
  focus() {}
  showModal() { this.open = true; }
  close() { this.open = false; this.emit("close"); }
}

async function storefront() {
  const html = readFileSync(new URL("../public/tienda/index.html", import.meta.url), "utf8");
  const nodes = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(match => [match[1], new Node()]));
  for (const id of ["product-dialog", "selection-dialog"]) { const close = new Node("button"); close.className = "close-dialog"; nodes.get(id).append(close); }
  nodes.get("sort").value = "featured";
  nodes.get("market-progress").hidden = true;
  const document = new Node();
  document.getElementById = id => nodes.get(id);
  document.createElement = tag => new Node(tag);
  document.createElementNS = (_, tag) => new Node(tag);
  const requests = [];
  let resolveProgress, rejectProgress, now = Date.parse(at);
  const progress = new Promise((resolve, reject) => { resolveProgress = resolve; rejectProgress = reject; });
  const product = { id: "p-1", name: "Teclado", description: "Descripción", category: "Periféricos", image: null, price: 100, orderable: true };
  const location = new URL("https://scalaris.example/tienda/index.html");
  const context = {
    document, location, window: { location }, URL, URLSearchParams, console, setTimeout, clearTimeout,
    Date: class extends Date { static now() { return now; } },
    Option: class extends Node { constructor(text, value) { super("option"); this.textContent = text; this.value = value; } },
    history: { replaceState() {} }, sessionStorage: { getItem: () => "[]", setItem() {} },
    navigator: {}, PAGE_SIZE: 24, MAX_PRODUCTS: 20, MAX_QUANTITY: 20,
    filterProducts: products => products, sanitizeSelection: selection => selection, inquiryMessage: () => "pedido",
    displayPrice: product => `$ ${product.price}`, canOrder: product => product.orderable,
    selectionTotals: selection => ({ subtotal: selection.reduce((sum, row) => sum + row.quantity * 100, 0), hasUnavailable: false }), money: value => `$ ${value}`,
    fetch: async (url, options) => { requests.push({ url, options }); return url.includes("market-progress") ? progress : { ok: true, json: async () => ({ version: 1, products: [product] }) }; },
  };
  const source = readFileSync(new URL("../public/tienda/tienda.js", import.meta.url), "utf8").replace(/^import[^\n]+\n/, "");
  vm.runInNewContext(source, context);
  const flush = async () => { await new Promise(resolve => setImmediate(resolve)); };
  await flush();
  return { nodes, document, requests, resolveProgress, rejectProgress, flush, setNow: value => { now = Date.parse(value); } };
}

test("un error del avance no bloquea catálogo, precios ni carrito; petición independiente sin caché", async () => {
  const app = await storefront();
  app.rejectProgress(new Error("offline"));
  await app.flush();
  assert.equal(app.requests.find(row => row.url.includes("market-progress")).options.cache, "no-store");
  assert.equal(app.nodes.get("market-progress").hidden, true);
  assert.equal(app.nodes.get("product-grid").children.length, 1);
  app.nodes.get("product-grid").querySelector(".add-product").emit("click");
  assert.equal(app.nodes.get("selection-count").textContent, "1");
  assert.ok(app.nodes.get("bar-count").textContent.includes("$ 100"));
});

test("detalle abierto recibe referencias vigentes sin reemplazar el pedido; vencidas y credenciales se ocultan", async () => {
  const app = await storefront();
  app.nodes.get("product-grid").querySelector(".product-visual").emit("click");
  const detail = app.nodes.get("detail-content");
  const add = detail.querySelector(".add-product");
  app.resolveProgress({ ok: true, json: async () => ({ version: 1, updatedAt: at, summary: { totalProducts: 1, researchedProducts: 1 }, products: [{ id: "p-1", references: [
    { currency: "ARS", priceARS: 250, observedAt, url: "https://comercio.com.ar/producto/modelo" },
    { currency: "ARS", priceARS: 200, observedAt: "2026-10-19T18:00:00Z", url: "https://vencido.com.ar/producto/x" },
    { currency: "ARS", priceARS: 200, observedAt, url: "https://credencial.com.ar/producto/x?access_token=SECRET" },
    { currency: "ARS", priceARS: 200, observedAt, url: "https://credencial.com.ar/producto/x?%2574oken=SECRET" },
    { currency: "ARS", priceARS: 200, observedAt, url: "https://credencial.com.ar/producto/x;%73essionid=SECRET" },
    { currency: "ARS", priceARS: 200, observedAt, url: "https://credencial.com.ar/producto/x%3Bjsessionid%3DSECRET" },
  ] }] }) });
  await app.flush();
  assert.equal(app.nodes.get("market-progress").hidden, false);
  assert.equal(detail.querySelector(".add-product"), add);
  assert.equal(detail.querySelector(".market-references").querySelectorAll("a").length, 1);
  assert.equal(detail.querySelector(".market-references").querySelector("a").href, "https://comercio.com.ar/producto/modelo");
  assert.ok(!detail.textContent.includes("SECRET"));
  app.setNow("2026-10-21T18:31:00Z");
  app.document.emit("visibilitychange");
  assert.equal(detail.querySelector(".market-references"), null);
  assert.equal(app.nodes.get("product-grid").children.length, 1);
});
