import test from "node:test";
import assert from "node:assert/strict";
import { Script } from "node:vm";
import { buildMarketDashboardData, renderMarketDashboard } from "./build-market-dashboard.mjs";

const generatedAt = "2026-10-20T15:00:00Z";
const catalog = { version: 1, importedAt: "2026-10-20", products: [
  { id: "nb-1", supplier: "nb", name: "Teclado de prueba", category: "Periféricos", cost: { currency: "ARS", gross: 10000 } },
  { id: "tp-1", supplier: "tecnoprices", name: "Cartucho vencido", category: "Impresión", cost: { currency: "ARS", gross: 1000 } },
  { id: "dl-1", supplier: "distriland", name: "Pantalla de prueba", category: "Repuestos de celulares", cost: { currency: "ARS", gross: 5000 } },
] };
const proposal = { generatedAt, products: catalog.products.map((p) => ({ id: p.id, orderable: p.id !== "tp-1", proposedPrice: 15000, priceBasis: "cost-policy", profitContribution: 3000, assumptions: { targetMarginRate: 0.25 }, blockReasons: p.id === "tp-1" ? ["expired-product"] : [], priceValidUntil: "2026-10-27T03:00:00Z" })) };
const data = (extra = {}) => buildMarketDashboardData({ catalog, proposal, generatedAt, ...extra });

test("todos los IDs aparecen sin deduplicar y precios bloqueados quedan identificados", () => {
  const result = data();
  assert.deepEqual(result.products.map((p) => p.id), catalog.products.map((p) => p.id));
  assert.deepEqual(result.summary, { total: 3, active: 2, blocked: 1, searchIndexed: 0, searchErrors: 0, searchPending: 3, strictProducts: 0, candidateProducts: 0, pendingValidationProducts: 0, pipelineProductPriceReviewed: 0 });
  assert.throws(() => buildMarketDashboardData({ catalog, proposal: { products: [] }, generatedAt }), /Falta propuesta/);
});

test("índice, errores y pendientes se contabilizan como estados reales", () => {
  const result = data({ searchBatches: [{ batchNumber: 1, generatedAt, records: [
    { id: "nb-1", researchedAt: generatedAt, status: "indexed", results: [{ title: "Teclado", url: "https://shop.example/p", snippet: "$123" }] },
    { id: "tp-1", researchedAt: generatedAt, status: "error", error: "rate limit", results: [] },
  ] }] });
  assert.equal(result.summary.searchIndexed, 1);
  assert.equal(result.summary.searchErrors, 1);
  assert.equal(result.summary.searchPending, 1);
  assert.equal(result.products[0].references[0].priceARS, null, "Un snippet jamás se convierte en precio observado");
});

test("referencia parcial verificada por proceso no se convierte en evidencia estricta", () => {
  const result = data({ marketReferences: { products: [{ id: "nb-1", searchStatus: "indexed", references: [{ url: "https://shop.example/p", title: "Teclado", priceARS: 22100, status: "verified_product_price", matchExact: true, verifiedProductPrice: true }] }] } });
  assert.equal(result.summary.pipelineProductPriceReviewed, 1);
  assert.equal(result.summary.strictProducts, 0);
  assert.equal(result.products[0].researchState, "validation");
  assert.equal(result.products[0].references[0].priceARS, 22100);
});

test("muestras observadas no falsean cobertura de búsqueda por lote", () => {
  const result = data({ rawResearch: [{ references: [{ id: "dl-1", url: "https://parts.example/p", priceARS: 19000, status: "out_of_stock", matchExact: true }] }] });
  assert.equal(result.summary.searchPending, 3);
  assert.equal(result.summary.strictProducts, 0);
  assert.equal(result.products[2].researchState, "validation");
  assert.equal(result.products[2].references[0].strict, false);
});

test("HTML autónomo escapa cierre de script y descarta enlaces peligrosos", () => {
  const malicious = { ...catalog, products: [{ ...catalog.products[0], name: "</script><script>injected()</script>" }, ...catalog.products.slice(1)] };
  const result = buildMarketDashboardData({ catalog: malicious, proposal, generatedAt, rawResearch: [{ references: [{ id: "nb-1", url: "javascript:alert(1)", title: "Peligroso" }] }] });
  assert.equal(result.products[0].references.length, 0);
  const html = renderMarketDashboard(result);
  assert.equal([...html.matchAll(/<script>/g)].length, 1);
  assert.equal([...html.matchAll(/<\/script>/g)].length, 1);
  assert.ok(html.includes("connect-src 'none'"));
  assert.ok(!/\b(?:src|href)="https?:/.test(html));
  assert.ok(!/\bfetch\s*\(|\bimport\s*\(|@font-face/.test(html));
  new Script(html.match(/<script>([\s\S]*)<\/script>/)[1]);
});
