import test from "node:test";
import assert from "node:assert/strict";
import { createPricingPolicy, createEvidencePolicy, normalizeMarketEvidence, proposeStorePrices, sanitizePublicCatalog, PUBLIC_PRODUCT_KEYS } from "./build-store-prices.mjs";

const at = "2026-10-20T15:00:00.000Z";
// Fictional deterministic settings; production business rates remain private.
const fixtureSettings = { status: "proposed", confirmedChoices: { payment: "transferencia", customerShipping: "separate", supplierInboundShipping: "free" }, proposal: {
  categoryTargetMarginRates: { "Notebooks y computadoras": 0.2, "Periféricos": 0.25, "Herramientas e insumos": 0.3, "Almacenamiento y memorias": 0.2, "Repuestos de celulares": 0.3 },
  sourceCategoryTargetMarginRates: {}, fallbackTargetMarginRate: 0.25, reserveRate: 0.03, paymentFeeRate: 0,
  inboundShippingInProductPriceARS: 0, outboundShippingInProductPriceARS: 0, packagingAllowanceInProductPriceARS: 0,
  minimumProfitPerUnitARS: 0, minimumProfitPerOrderMetricARS: 3000, proposedMinimumOrderARS: 15000, minimumOrderEnforced: false,
  marketTargetFactor: 0.98, maximumEvidenceAgeHours: 24, supplierMaxAgeDays: 7,
} };
const policy = (date = at) => createPricingPolicy(date, fixtureSettings);
const product = (overrides = {}) => ({ id: "test-1", supplier: "nb", name: "Producto de prueba", category: "Periféricos", cost: { currency: "ARS", gross: 10000, vatIncluded: true }, ...overrides });
const catalog = (...products) => ({ version: 1, importedAt: "2026-10-20", products });
const seed = (overrides = {}) => ({ id: "test-1", matchExact: true, variantVerified: true, paymentComparable: true, priceVerifiedOnPage: true, available: true, currency: "ARS", priceARS: 20000, status: "verified", payment: "transferencia", observedAt: "2026-10-20T14:00:00Z", url: "https://retailer.example/product", ...overrides });

test("propuesta incluye todos los IDs y cubre costo, reserva y margen sin duplicar IVA", () => {
  const result = proposeStorePrices(catalog(product()), [], policy());
  assert.equal(result.products.length, 1);
  const p = result.products[0];
  assert.equal(p.proposedPrice, 13900);
  assert.equal(p.priceBasis, "cost-policy");
  assert.equal(p.orderable, true);
  assert.ok(p.profitContributionRate >= 0.25);
  assert.equal(p.profitContribution, 3483);
  assert.equal(p.assumptions.minimumProfitPerUnitARS, 0);
});

test("chip barato no recibe ganancia mínima de 3000 por unidad ni mínimo de pedido impuesto", () => {
  const p = proposeStorePrices(catalog(product({ supplier: "distriland", category: "Repuestos de celulares", cost: { currency: "ARS", gross: 100, vatIncluded: true } })), [], policy()).products[0];
  assert.equal(p.proposedPrice, 150);
  assert.ok(p.profitContribution < 3000);
  assert.equal(p.assumptions.minimumProfitPerOrderMetricARS, 3000);
  assert.equal(p.assumptions.proposedMinimumOrderARS, 15000);
  assert.equal(p.assumptions.minimumOrderEnforced, false);
});

test("márgenes por categoría y redondeos por costo respetan límites", () => {
  const cases = [
    [9999, "Notebooks y computadoras", 50, 0.2],
    [10000, "Periféricos", 100, 0.25],
    [100000, "Herramientas e insumos", 100, 0.3],
    [100001, "Almacenamiento y memorias", 500, 0.2],
  ];
  for (const [gross, category, step, margin] of cases) {
    const p = proposeStorePrices(catalog(product({ category, cost: { currency: "ARS", gross, vatIncluded: true } })), [], policy()).products[0];
    assert.equal(p.assumptions.roundTo, step);
    assert.equal(p.assumptions.targetMarginRate, margin);
    assert.ok(p.profitContributionRate >= margin);
    assert.equal(p.proposedPrice % step, 0);
  }
});

test("VENCIDO y stock fuente cero conservan cálculo privado pero bloquean compra", () => {
  const result = proposeStorePrices(catalog(
    product({ id: "expired", supplier: "tecnoprices", name: "CARTUCHO VENCIDO" }),
    product({ id: "zero-stock", supplierStockSnapshot: 0 }),
  ), [], policy());
  for (const p of result.products) { assert.equal(p.orderable, false); assert.ok(p.proposedPrice > 0); }
  assert.ok(result.products[0].blockReasons.includes("expired-product"));
  assert.ok(result.products[1].blockReasons.includes("supplier-stock-zero-in-source"));
});

test("moneda distinta, costo inválido o final no confirmado no se convierten silenciosamente", () => {
  for (const cost of [
    { currency: "USD", gross: 32, vatIncluded: true },
    { currency: "EUR", gross: 32, vatIncluded: true },
    { currency: "ARS", gross: "10000", vatIncluded: true },
    { currency: "ARS", gross: -1, vatIncluded: true },
    { currency: "ARS", gross: NaN, vatIncluded: true },
    { currency: "ARS", gross: 10000, vatIncluded: null },
  ]) {
    const p = proposeStorePrices(catalog(product({ cost })), [], policy()).products[0];
    assert.equal(p.proposedPrice, null);
    assert.equal(p.orderable, false);
  }
  const missing = proposeStorePrices(catalog(product({ missingFromLatestNbList: true, costRequiresConfirmation: true })), [], policy()).products[0];
  assert.equal(missing.proposedPrice, null);
  assert.equal(missing.orderable, false);
});

test("mercado usa mediana de URLs únicas y jamás reduce el piso rentable", () => {
  const expensive = proposeStorePrices(catalog(product()), [seed({ priceARS: 1000 })], policy()).products[0];
  assert.equal(expensive.proposedPrice, 13900);
  assert.equal(expensive.marketStatus, "not-competitive-at-market-target");
  const suitable = proposeStorePrices(catalog(product()), [seed(), seed(), seed({ url: "https://other.example/p", priceARS: 30000 })], policy()).products[0];
  assert.equal(suitable.marketEvidenceCount, 2);
  assert.equal(suitable.marketMedianARS, 25000);
  assert.equal(suitable.proposedPrice, 24500);
  assert.equal(suitable.priceBasis, "market-comparable");
  assert.ok(suitable.proposedPrice >= suitable.profitableFloorARS);
});

test("evidencias exigen flags booleanos exactos, página, fecha, moneda, transferencia y disponibilidad", () => {
  assert.ok(normalizeMarketEvidence(seed(), "test-1", policy()));
  const invalid = [
    { matchExact: "true" }, { variantVerified: 1 }, { paymentComparable: false }, { priceVerifiedOnPage: false },
    { available: "true" }, { available: false }, { status: "candidate" }, { payment: "tarjeta" },
    { currency: "USD" }, { priceARS: "20000" }, { evidenceSource: "snippet" }, { fromSnippet: true },
    { observedAt: "2026-10-19T14:00:00Z" }, { observedAt: "2026-10-21T14:00:00Z" }, { observedAt: "not-a-date" },
    { url: "javascript:alert(1)" }, { id: "other-product" },
  ];
  for (const override of invalid) assert.equal(normalizeMarketEvidence(seed(override), "test-1", policy()), null, JSON.stringify(override));
  assert.equal(normalizeMarketEvidence({ id: "test-1", benchmarkEligible: true, priceARS: 1000 }, "test-1", policy()), null);
});

test("tasas 20 en lugar de0.20 y strings se rechazan; política permanece propuesta", () => {
  for (const value of [20, "0.2", NaN, -0.1, 1]) {
    const invalid = policy(); invalid.proposal.fallbackTargetMarginRate = value;
    assert.throws(() => proposeStorePrices(catalog(product()), [], invalid));
  }
  assert.equal(policy().status, "proposed");
  assert.equal(policy().priceValidUntil, "2026-10-27T15:00:00.000Z");
});

test("no deduplica GTIN: todos los productos y proveedores conservan su ID", () => {
  const p = [product({ id: "nb-1", ean: "097855117991" }), product({ id: "tp-1", supplier: "tecnoprices", ean: "097855117991" })];
  const result = proposeStorePrices(catalog(...p), [], policy());
  assert.deepEqual(result.products.map((p) => p.id), ["nb-1", "tp-1"]);
  assert.throws(() => proposeStorePrices(catalog(product(), product()), [], policy()), /duplicado/);
});

test("reconstruir precios no renueva costos viejos y vigencia se limita a la fuente", () => {
  const original = catalog(product({ costUpdatedAt: "2026-10-15" }));
  const p = proposeStorePrices(original, [], policy()).products[0];
  assert.equal(p.orderable, true);
  assert.equal(p.priceUpdatedAt, at);
  assert.equal(p.priceValidUntil, "2026-10-22T03:00:00.000Z");
  const stale = proposeStorePrices(original, [], policy("2026-10-23T15:00:00Z")).products[0];
  assert.equal(stale.orderable, false);
  assert.equal(stale.proposedPrice, null);
  assert.ok(stale.blockReasons.includes("supplier-cost-stale"));
  assert.equal(stale.priceValidUntil, p.priceValidUntil);
});

test("fecha de fuente anterior vence aunque se haya reimportado hoy; confirmación expresa es distinguible", () => {
  const data = catalog(product({ supplier: "tecnoprices" }));
  data.sources = [{ id: "tecnoprices", sourceDate: "2026-10-01T04:10:00-03:00" }];
  assert.ok(proposeStorePrices(data, [], policy()).products[0].blockReasons.includes("supplier-cost-stale"));
  data.products[0].costFinalConfirmedByOwner = { confirmedAt: "2026-10-20" };
  assert.equal(proposeStorePrices(data, [], policy()).products[0].orderable, true);
  const noDate = { version: 1, products: [product()] };
  assert.ok(proposeStorePrices(noDate, [], policy()).products[0].blockReasons.includes("supplier-cost-date-unknown"));
});

test("aplicación pública es whitelist, nunca exporta costos y oculta precios bloqueados", () => {
  const privateCatalog = catalog(product(), product({ id: "expired", supplier: "tecnoprices", name: "VENCIDO" }));
  const proposal = proposeStorePrices(privateCatalog, [], policy());
  const publicCatalog = { version: 1, products: privateCatalog.products.map((p) => ({ id: p.id, name: p.name, category: p.category, price: null, cost: p.cost, secret: "private" })) };
  const result = sanitizePublicCatalog(publicCatalog, proposal);
  assert.equal(result.products[0].price, 13900);
  assert.equal(result.products[1].price, null);
  assert.equal(result.products[1].orderable, false);
  assert.equal(result.products[0].priceUpdatedAt, at);
  assert.equal(result.products[0].priceValidUntil, "2026-10-27T03:00:00.000Z");
  for (const p of result.products) for (const key of Object.keys(p)) assert.ok(PUBLIC_PRODUCT_KEYS.includes(key), key);
  assert.ok(!JSON.stringify(result).includes("secret"));
  assert.ok(!JSON.stringify(result).includes("gross"));
  assert.ok(!JSON.stringify(result).includes("profitContribution"));
  assert.throws(() => sanitizePublicCatalog({ products: [] }, proposal), /IDs/);
});

const markupPolicy = (extra = {}) => createPricingPolicy(at, { ...fixtureSettings, status: "active", proposal: { ...fixtureSettings.proposal,
  pricingMethod: "cost-markup", categoryMarkupRates: { "Demo": 0.25 }, sourceCategoryMarkupRates: { "DEMO OVERRIDE": 0.6 }, fallbackMarkupRate: 0.45,
  marketAdjustmentEnabled: false, ...extra,
} });

test("recargo se aplica al costo final, reserva se descuenta de la venta y no duplica IVA", () => {
  const p = proposeStorePrices(catalog(product({ category: "Demo" })), [], markupPolicy()).products[0];
  assert.equal(p.proposedPrice, 12500);
  assert.equal(p.assumptions.minimumMarkupRate, 0.25);
  assert.equal(p.reserveAllowanceARS, 375);
  assert.equal(p.profitContribution, 2125);
  assert.equal(p.assumptions.policyStatus, "active");
  assert.equal(proposeStorePrices(catalog(product({ sourceCategory: "demo override" })), [], markupPolicy()).products[0].proposedPrice, 16000);
  assert.equal(proposeStorePrices(catalog(product({ category: "unknown" })), [], markupPolicy()).products[0].proposedPrice, 14500);
  assert.equal(proposeStorePrices(catalog(product()), [], markupPolicy({ fallbackMarkupRate: 1.1 })).products[0].proposedPrice, 21000);
});

test("recargo insuficiente para comisión/reserva, texto o tasa inválida no publica precios", () => {
  for (const value of ["0.4", NaN, -0.1, 0.01]) assert.throws(() => proposeStorePrices(catalog(product()), [], markupPolicy({ fallbackMarkupRate: value })));
  assert.throws(() => createPricingPolicy(at), /configuración privada/);
  assert.throws(() => proposeStorePrices(catalog(product()), [], createEvidencePolicy(at)), /política explícita/);
});

test("referencias previas son informativas cuando la regla de costo quedó fijada", () => {
  const p = proposeStorePrices(catalog(product({ category: "Demo" })), [seed({ priceARS: 50000 })], markupPolicy()).products[0];
  assert.equal(p.proposedPrice, 12500);
  assert.equal(p.marketEvidenceCount, 1);
  assert.equal(p.priceBasis, "cost-policy");
  assert.equal(p.marketStatus, "reference-only-cost-policy");
});

test("recalcular sin cambios conserva fechas y no renueva la fuente; cambios usan fecha argentina", () => {
  const initialProposal = proposeStorePrices(catalog(product()), [], policy());
  const original = sanitizePublicCatalog({ version: 1, products: [{ id: "test-1", name: "Demo" }] }, initialProposal);
  const recalculated = proposeStorePrices(catalog(product()), [], policy("2026-10-21T02:00:00Z"));
  assert.deepEqual(sanitizePublicCatalog(original, recalculated), original);
  const changed = proposeStorePrices(catalog(product({ cost: { currency: "ARS", gross: 11000, vatIncluded: true } })), [], policy("2026-10-21T02:00:00Z"));
  const result = sanitizePublicCatalog(original, changed);
  assert.equal(result.updatedAt, "2026-10-20");
  assert.equal(result.products[0].priceUpdatedAt, "2026-10-21T02:00:00.000Z");
  assert.equal(result.products[0].priceValidUntil, original.products[0].priceValidUntil);
});
