import test from "node:test";
import assert from "node:assert/strict";
import { Script, createContext } from "node:vm";
import { renderPriceCalculator } from "./build-price-calculator.mjs";
import { browserPricingSource, calculatePrice } from "./pricing.mjs";

const fixture = { version: 1, importedAt: "2026-10-20", products: [
  { id: "nb-usd", supplier: "nb", name: "Teclado NB en USD", cost: { currency: "USD", gross: 32.04, vatIncluded: true }, quantityPrices: [{ minQuantity: 1, gross: 32.04 }] },
  { id: "nb-ars", supplier: "nb", name: "Teclado NB con precio en pesos confirmado", cost: { currency: "ARS", gross: 48000, vatIncluded: true }, quantityPrices: [{ minQuantity: 1, gross: 48000 }] },
  { id: "nb-missing", supplier: "nb", name: "Producto ausente de última lista NB", cost: { currency: "USD", gross: 20, vatIncluded: true }, quantityPrices: [{ minQuantity: 1, gross: 20 }], missingFromLatestNbList: true, costRequiresConfirmation: true },
  { id: "tp-test", supplier: "tecnoprices", name: "Router de prueba", cost: { currency: "ARS", gross: 10000, vatIncluded: true }, quantityPrices: [{ minQuantity: 1, gross: 10000 }, { minQuantity: 3, gross: 9000 }] },
  { id: "dl-test", supplier: "distriland", name: "Pantalla de prueba", cost: { currency: "ARS", gross: 20000, vatIncluded: null }, quantityPrices: [{ minQuantity: 1, gross: 20000 }] },
] };

function appHarness(catalog = fixture) {
  const html = renderPriceCalculator(catalog);
  const events = new Map();
  class Element {
    constructor() { this.value = ""; this.children = []; this.dataset = {}; this.checked = false; this.hidden = false; this.required = false; this.textContent = ""; this.className = ""; }
    addEventListener(name, fn) { const handlers = events.get(this) || {}; (handlers[name] ||= []).push(fn); events.set(this, handlers); }
    emit(name) { for (const fn of events.get(this)?.[name] || []) fn({ preventDefault() {} }); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    focus() {}
  }
  const elements = {};
  for (const match of html.split("<script>")[0].matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) {
    const node = new Element();
    node.value = match[0].match(/\bvalue="([^"]*)"/)?.[1] || "";
    node.dataset.label = match[0].match(/\bdata-label="([^"]*)"/)?.[1];
    node.type = match[0].match(/\btype="([^"]*)"/)?.[1];
    node.required = /\brequired\b/.test(match[0]);
    node.hidden = /\bhidden\b/.test(match[0]);
    elements[match[1]] = node;
  }
  elements["quote-form"].reportValidity = () => Object.values(elements).every((node) => !node.required || (node.type === "checkbox" ? node.checked : node.value !== ""));
  const document = { getElementById: (id) => elements[id], createElement: () => new Element() };
  const source = html.match(/<script>([\s\S]*)<\/script>/)[1];
  const script = new Script(source, { filename: "cotizador.html" });
  script.runInContext(createContext({ document, Intl }));
  const set = (id, value) => {
    elements[id].value = String(value);
    elements[id].emit("input");
    elements["quote-form"].emit("input");
  };
  const choose = (id) => {
    set("search", id);
    assert.equal(elements.products.children.length, 1);
    elements.products.children[0].emit("click");
  };
  const fillExpenses = () => {
    for (const [id, value] of Object.entries({ outboundShipping: 5000, packaging: 500, fixedFees: 0, paymentFeeRate: 0 })) set(id, value);
  };
  const submit = () => elements["quote-form"].emit("submit");
  return { html, elements, set, choose, fillExpenses, submit };
}

test("motor serializado calcula exactamente con la misma implementación del módulo", () => {
  const context = createContext({});
  new Script(`${browserPricingSource()}\nglobalThis.quote = calculatePrice;`).runInContext(context);
  const input = { unitCost: 10000, currency: "ARS", quantity: 3, inboundShipping: 0, outboundShipping: 5000, packaging: 500, fixedFees: 0, paymentFeeRate: 0.1, reserveRate: 0.03, targetMarginRate: 0.2, minimumProfit: 3000, roundTo: 100 };
  assert.deepEqual(JSON.parse(JSON.stringify(context.quote(input))), calculatePrice(input));
});

test("HTML autónomo sin recursos externos y datos escapados contra cierre de script", () => {
  const html = renderPriceCalculator({ ...fixture, products: [{ ...fixture.products[0], name: "</script><script>injected()</script>" }] });
  assert.equal([...html.matchAll(/<script>/g)].length, 1);
  assert.equal([...html.matchAll(/<\/script>/g)].length, 1);
  assert.ok(html.includes("connect-src 'none'"));
  assert.ok(!/\b(?:src|href)="https?:/i.test(html));
  assert.ok(!/\b(?:fetch|XMLHttpRequest|localStorage|sessionStorage)\s*\(/.test(html));
  new Script(html.match(/<script>([\s\S]*)<\/script>/)[1]);
});

test("NB USD no se precarga como ARS; exige costo real pesos y gastos explícitos", () => {
  const app = appHarness();
  app.choose("nb-usd");
  assert.equal(app.elements.unitCost.value, "");
  assert.match(app.elements["source-note"].textContent, /USD/);
  app.submit();
  assert.equal(app.elements.result.hidden, true);
  app.set("unitCost", 48060);
  app.fillExpenses();
  app.submit();
  assert.equal(app.elements.error.textContent, "");
  assert.equal(app.elements.result.hidden, false);
  assert.match(app.elements["suggested-price"].textContent, /69\.600/);
  app.set("outboundShipping", "");
  assert.equal(app.elements.result.hidden, true);
  app.submit();
  assert.notEqual(app.elements.error.textContent, "");
});

test("NB con costo ARS confirmado se precarga; TecnoPrices respeta escalas", () => {
  const app = appHarness();
  app.choose("nb-ars");
  assert.equal(app.elements.unitCost.value, "48000");
  app.choose("tp-test");
  assert.equal(app.elements.unitCost.value, "10000");
  app.set("quantity", 3);
  assert.equal(app.elements.unitCost.value, "9000");
  app.set("unitCost", 8500);
  app.set("quantity", 5);
  assert.equal(app.elements.unitCost.value, "8500", "No debe pisar un costo manual confirmado al cambiar cantidad");
});

test("DistriLand requiere confirmación de costo final e impuestos para calcular", () => {
  const app = appHarness();
  app.choose("dl-test");
  assert.equal(app.elements["supplier-confirmation"].hidden, false);
  app.fillExpenses();
  app.submit();
  assert.equal(app.elements.result.hidden, true);
  app.elements.supplierFinalCostConfirmed.checked = true;
  app.submit();
  assert.equal(app.elements.error.textContent, "");
  assert.equal(app.elements.result.hidden, false);
});

test("NB ausente no precarga USD como pesos y exige confirmar costo vigente", () => {
  const app = appHarness();
  app.choose("nb-missing");
  assert.equal(app.elements.unitCost.value, "");
  assert.match(app.elements["source-note"].textContent, /no figura en la última lista NB/);
  assert.match(app.elements["source-note"].textContent, /USD/);
  assert.equal(app.elements["supplier-confirmation"].hidden, false);
  app.fillExpenses();
  app.set("unitCost", 35000);
  app.submit();
  assert.equal(app.elements.result.hidden, true);
  assert.match(app.elements.error.textContent, /no figura en la última lista NB/);
  app.elements.supplierFinalCostConfirmed.checked = true;
  app.submit();
  assert.equal(app.elements.error.textContent, "");
  assert.equal(app.elements.result.hidden, false);
});

test("referencia baja muestra no viable y conserva el precio rentable", () => {
  const app = appHarness();
  app.choose("tp-test");
  app.fillExpenses();
  app.set("marketReference", 1000);
  app.submit();
  assert.equal(app.elements.error.textContent, "");
  assert.match(app.elements.comparison.className, /not-viable/);
  assert.match(app.elements["suggested-price"].textContent, /20\.200/);
});
