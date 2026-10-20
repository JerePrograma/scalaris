import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, renameSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { calculatePrice } from "./pricing.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const DAY_MS = 24 * 60 * 60 * 1000;
const MARGINS = {
  "Notebooks y computadoras": 0.20,
  "Componentes de PC": 0.20,
  "Almacenamiento y memorias": 0.20,
  "Monitores y pantallas": 0.20,
  "Celulares y tablets": 0.20,
  "Componentes electrónicos": 0.20,
  "Accesorios": 0.25,
  "Periféricos": 0.25,
  "Audio": 0.25,
  "Redes y conectividad": 0.25,
  "Impresión": 0.25,
  "Hogar y seguridad": 0.25,
  "Consolas y accesorios": 0.25,
  "Accesorios para celulares y tablets": 0.25,
  "Repuestos de celulares": 0.30,
  "Repuestos de tablets": 0.30,
  "Repuestos de consolas": 0.30,
  "Herramientas e insumos": 0.30,
  "Accesorios y repuestos de notebooks": 0.30,
  "Repuestos y accesorios": 0.30,
  "Repuestos y accesorios de periféricos": 0.30,
  "Outlet": 0.25,
};
const fold = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
const finitePositive = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;

export function createPricingPolicy(generatedAt = new Date().toISOString()) {
  const at = new Date(generatedAt);
  if (!Number.isFinite(at.getTime())) throw new TypeError("generatedAt debe ser una fecha válida.");
  return {
    version: 1,
    status: "proposed",
    generatedAt: at.toISOString(),
    priceValidUntil: new Date(at.getTime() + 7 * DAY_MS).toISOString(),
    confirmedChoices: { payment: "transferencia", customerShipping: "separate", supplierInboundShipping: "free" },
    proposal: {
      categoryTargetMarginRates: { ...MARGINS },
      sourceCategoryTargetMarginRates: { "PROCESADORES OUTLET": 0.20 },
      fallbackTargetMarginRate: 0.25,
      reserveRate: 0.03,
      paymentFeeRate: 0,
      inboundShippingInProductPriceARS: 0,
      outboundShippingInProductPriceARS: 0,
      packagingAllowanceInProductPriceARS: 0,
      packagingTreatment: "Provisión presupuestada dentro de la reserva. El costo real no fue informado ni se presume igual a cero.",
      minimumProfitPerUnitARS: 0,
      minimumProfitPerOrderMetricARS: 3000,
      proposedMinimumOrderARS: 15000,
      minimumOrderEnforced: false,
      minimumOrderNote: "Propuesta para evaluar el ticket; no es una garantía de ganancia neta ni un mínimo impuesto al cliente.",
      roundingByCostARS: [
        { fromInclusive: 0, toExclusive: 10000, step: 50 },
        { fromInclusive: 10000, toInclusive: 100000, step: 100 },
        { above: 100000, step: 500 },
      ],
      marketTargetFactor: 0.98,
      maximumEvidenceAgeHours: 24,
      supplierMaxAgeDays: 7,
      supplierFreshnessNote: "No se renueva un costo por regenerar precios. La validez individual queda limitada por la fecha del costo o confirmación; fecha de fuente tiene prioridad sobre reimportación.",
      marketReferenceSource: "normalized-seeds.json only; raw references remain candidates",
      marketNote: "Mediana de precios exactos comparables por transferencia, sin envío. Nunca se reduce el precio por debajo del piso rentable.",
      availabilityNote: "A pedido: orderable permite solicitar el producto; no afirma stock propio ni disponibilidad inmediata. Confirmar disponibilidad y plazo antes de cobrar.",
      profitNote: "Contribución después del costo, comisión y reserva presupuestados. No es ganancia contable neta de todos los gastos del negocio.",
    },
  };
}

function validatePolicy(policy) {
  const p = policy?.proposal;
  if (!p || policy.status !== "proposed") throw new TypeError("Se necesita una política explícita con status proposed.");
  for (const rate of [p.reserveRate, p.paymentFeeRate, p.fallbackTargetMarginRate, ...Object.values(p.categoryTargetMarginRates || {}), ...Object.values(p.sourceCategoryTargetMarginRates || {})]) {
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate < 0 || rate >= 1) throw new TypeError("Las tasas deben ser proporciones numéricas en [0,1), no porcentajes enteros ni texto.");
  }
  if (p.reserveRate + p.paymentFeeRate + Math.max(p.fallbackTargetMarginRate, ...Object.values(p.categoryTargetMarginRates || {}), ...Object.values(p.sourceCategoryTargetMarginRates || {})) >= 1) throw new RangeError("Comisión, reserva y margen deben sumar menos que uno.");
  if (!finitePositive(p.marketTargetFactor) || p.marketTargetFactor > 1) throw new TypeError("marketTargetFactor debe estar en (0,1].");
  if (!finitePositive(p.maximumEvidenceAgeHours)) throw new TypeError("maximumEvidenceAgeHours debe ser positivo.");
  if (!finitePositive(p.supplierMaxAgeDays)) throw new TypeError("supplierMaxAgeDays debe ser positivo.");
  if (!Number.isFinite(Date.parse(policy.generatedAt)) || !Number.isFinite(Date.parse(policy.priceValidUntil))) throw new TypeError("La política requiere fechas válidas.");
  for (const name of ["inboundShippingInProductPriceARS", "outboundShippingInProductPriceARS", "packagingAllowanceInProductPriceARS", "minimumProfitPerUnitARS"]) {
    if (typeof p[name] !== "number" || !Number.isFinite(p[name]) || p[name] < 0) throw new TypeError(`${name} debe ser un importe explícito no negativo.`);
  }
}

/** Strict ingestion: no fuzzy matching, inference from raw text or snippet prices. */
export function normalizeMarketEvidence(seed, productId, policy) {
  if (!seed || typeof seed !== "object" || Array.isArray(seed)) return null;
  const id = seed.id || seed.productId;
  if (id !== productId || seed.matchExact !== true || seed.variantVerified !== true || seed.paymentComparable !== true || seed.priceVerifiedOnPage !== true || seed.available !== true) return null;
  if (seed.status !== "verified" || seed.currency !== "ARS" || !finitePositive(seed.priceARS)) return null;
  if (seed.evidenceSource === "snippet" || seed.fromSnippet === true) return null;
  const payment = typeof seed.payment === "string" ? seed.payment : seed.payment?.method;
  if (!["transferencia", "bank-transfer"].includes(payment)) return null;
  const observed = Date.parse(seed.observedAt);
  const generated = Date.parse(policy.generatedAt);
  const age = generated - observed;
  if (!Number.isFinite(observed) || !Number.isFinite(generated) || age < 0 || age > policy.proposal.maximumEvidenceAgeHours * 60 * 60 * 1000) return null;
  let url;
  try { url = new URL(seed.url); } catch { return null; }
  if (!["https:", "http:"].includes(url.protocol)) return null;
  return { url: url.href, priceARS: seed.priceARS, observedAt: new Date(observed).toISOString() };
}

function median(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function costFreshness(product, catalog, policy) {
  const sourceId = product.costSource?.sourceId || product.supplier;
  const source = (catalog.sources || []).find((entry) => entry.id === sourceId);
  const candidates = [
    ["product.costUpdatedAt", product.costUpdatedAt],
    ["owner-confirmation", product.costFinalConfirmedByOwner?.confirmedAt],
    ["source-date", source?.sourceDate || source?.confirmedAt],
    ["catalog-importedAt", catalog.importedAt],
  ];
  const known = candidates.find(([, value]) => value !== undefined && value !== null && value !== "");
  if (!known) return { blockReason: "supplier-cost-date-unknown", basis: null, observedAt: null, validUntil: null };
  const [basis, value] = known;
  // Supplier list dates with no time are local Argentine dates, never the host's timezone.
  const observed = typeof value === "string" ? Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00-03:00` : value) : NaN;
  const now = Date.parse(policy.generatedAt);
  if (!Number.isFinite(observed) || observed > now) return { blockReason: "supplier-cost-date-invalid", basis, observedAt: null, validUntil: null };
  const expires = observed + policy.proposal.supplierMaxAgeDays * DAY_MS;
  return {
    blockReason: now > expires ? "supplier-cost-stale" : null,
    basis,
    observedAt: new Date(observed).toISOString(),
    validUntil: new Date(Math.min(expires, Date.parse(policy.priceValidUntil))).toISOString(),
  };
}

export function proposeStorePrices(catalog, normalizedSeeds = [], policy = createPricingPolicy()) {
  if (catalog?.version !== 1 || !Array.isArray(catalog.products)) throw new TypeError("Catálogo privado inválido.");
  if (!Array.isArray(normalizedSeeds)) throw new TypeError("normalizedSeeds debe ser un arreglo.");
  validatePolicy(policy);
  const settings = policy.proposal;
  const ids = new Set();
  const seedIndex = new Map();
  for (const seed of normalizedSeeds) {
    const id = seed?.id || seed?.productId;
    if (!seedIndex.has(id)) seedIndex.set(id, []);
    seedIndex.get(id).push(seed);
  }
  const products = catalog.products.map((product) => {
    if (typeof product.id !== "string" || !product.id || ids.has(product.id)) throw new Error(`ID inválido o duplicado: ${product.id}`);
    ids.add(product.id);
    const sourceMargin = settings.sourceCategoryTargetMarginRates[fold(product.sourceCategory)];
    const categoryMargin = settings.categoryTargetMarginRates[product.category];
    const targetMarginRate = sourceMargin ?? categoryMargin ?? settings.fallbackTargetMarginRate;
    const marginBasis = sourceMargin !== undefined ? "source-category" : categoryMargin !== undefined ? "category" : "fallback";
    const unitCost = product.cost?.gross;
    const blockReasons = [];
    if (product.cost?.currency !== "ARS") blockReasons.push("cost-not-final-ars");
    if (!finitePositive(unitCost)) blockReasons.push("invalid-final-cost");
    if (product.cost?.vatIncluded !== true) blockReasons.push("final-tax-treatment-unconfirmed");
    if (product.missingFromLatestNbList === true) blockReasons.push("missing-from-latest-nb-list");
    if (product.costRequiresConfirmation === true) blockReasons.push("cost-requires-confirmation");
    if (product.supplier === "tecnoprices" && /\bVENCID[OA]S?\b/.test(fold(product.name))) blockReasons.push("expired-product");
    if (product.supplierStockSnapshot === 0) blockReasons.push("supplier-stock-zero-in-source");
    const freshness = costFreshness(product, catalog, policy);
    if (freshness.blockReason) blockReasons.push(freshness.blockReason);
    const roundTo = unitCost < 10000 ? 50 : unitCost <= 100000 ? 100 : 500;
    const assumptions = {
      policyStatus: "proposed",
      targetMarginRate,
      marginBasis,
      reserveRate: settings.reserveRate,
      paymentFeeRate: settings.paymentFeeRate,
      inboundShippingInProductPriceARS: settings.inboundShippingInProductPriceARS,
      outboundShippingInProductPriceARS: settings.outboundShippingInProductPriceARS,
      customerShippingBilledSeparately: true,
      packagingAllowanceInProductPriceARS: settings.packagingAllowanceInProductPriceARS,
      packagingProvisionWithinReserve: true,
      actualPackagingCostKnown: false,
      minimumProfitPerUnitARS: settings.minimumProfitPerUnitARS,
      minimumProfitPerOrderMetricARS: settings.minimumProfitPerOrderMetricARS,
      proposedMinimumOrderARS: settings.proposedMinimumOrderARS,
      minimumOrderEnforced: false,
      roundTo,
      supplierCostDateBasis: freshness.basis,
      supplierCostLastKnownAt: freshness.observedAt,
      supplierMaxAgeDays: settings.supplierMaxAgeDays,
    };
    const entry = {
      id: product.id,
      proposedPrice: null,
      priceBasis: "cost-policy",
      marketEvidenceCount: 0,
      marketStatus: "not-researched-or-no-verified-reference",
      currency: "ARS",
      orderable: blockReasons.length === 0,
      blockReasons,
      assumptions,
      profitContribution: null,
      priceUpdatedAt: policy.generatedAt,
      priceValidUntil: freshness.validUntil || policy.generatedAt,
    };
    const cannotPrice = blockReasons.some((reason) => reason !== "expired-product" && reason !== "supplier-stock-zero-in-source");
    if (cannotPrice) {
      entry.marketStatus = "blocked-unconfirmed-cost";
      return entry;
    }
    const quote = calculatePrice({
      unitCost, currency: "ARS", quantity: 1,
      inboundShipping: settings.inboundShippingInProductPriceARS,
      outboundShipping: settings.outboundShippingInProductPriceARS,
      packaging: settings.packagingAllowanceInProductPriceARS,
      fixedFees: 0,
      paymentFeeRate: settings.paymentFeeRate,
      reserveRate: settings.reserveRate,
      targetMarginRate,
      minimumProfit: settings.minimumProfitPerUnitARS,
      roundTo,
    });
    entry.proposedPrice = quote.unitPrice;
    const uniqueEvidence = new Map();
    for (const seed of seedIndex.get(product.id) || []) {
      const evidence = normalizeMarketEvidence(seed, product.id, policy);
      if (evidence && !uniqueEvidence.has(evidence.url)) uniqueEvidence.set(evidence.url, evidence);
    }
    const evidence = [...uniqueEvidence.values()];
    entry.marketEvidenceCount = evidence.length;
    if (evidence.length) {
      const medianPriceARS = median(evidence.map((reference) => reference.priceARS));
      const marketTargetARS = medianPriceARS * settings.marketTargetFactor;
      entry.marketMedianARS = medianPriceARS;
      entry.marketTargetARS = marketTargetARS;
      entry.marketSources = evidence;
      if (marketTargetARS >= quote.unitPrice) {
        entry.proposedPrice = Math.ceil(marketTargetARS / roundTo) * roundTo;
        entry.priceBasis = "market-comparable";
        entry.marketStatus = "comparable-target-above-profitable-floor";
      } else {
        entry.marketStatus = "not-competitive-at-market-target";
      }
    } else if ((seedIndex.get(product.id) || []).length) {
      entry.marketStatus = "candidates-rejected-by-strict-validation";
    }
    entry.profitableFloorARS = quote.unitPrice;
    entry.profitContribution = entry.proposedPrice * (1 - settings.paymentFeeRate - settings.reserveRate) - quote.orderCostArs;
    entry.profitContributionRate = entry.profitContribution / entry.proposedPrice;
    entry.reserveAllowanceARS = entry.proposedPrice * settings.reserveRate;
    entry.unitsForOrderContributionMetric = entry.profitContribution > 0 ? Math.ceil(settings.minimumProfitPerOrderMetricARS / entry.profitContribution) : null;
    if (!Number.isFinite(entry.proposedPrice) || !Number.isFinite(entry.profitContribution)) throw new RangeError(`Cálculo fuera de rango para ${product.id}`);
    return entry;
  });
  return {
    version: 1,
    status: "proposed-not-automatically-published",
    generatedAt: policy.generatedAt,
    priceValidUntil: policy.priceValidUntil,
    policyStatus: policy.status,
    summary: {
      totalProducts: products.length,
      pricedProducts: products.filter((product) => product.proposedPrice !== null).length,
      orderableProducts: products.filter((product) => product.orderable).length,
      blockedProducts: products.filter((product) => !product.orderable).length,
      marketComparableProducts: products.filter((product) => product.priceBasis === "market-comparable").length,
      productsWithVerifiedMarketEvidence: products.filter((product) => product.marketEvidenceCount > 0).length,
      notCompetitiveAtMarketTarget: products.filter((product) => product.marketStatus === "not-competitive-at-market-target").length,
      blockReasons: products.reduce((counts, product) => { for (const reason of product.blockReasons) counts[reason] = (counts[reason] || 0) + 1; return counts; }, {}),
    },
    products,
  };
}

export const PUBLIC_PRODUCT_KEYS = ["id", "name", "category", "brand", "image", "description", "price", "currency", "orderable", "priceBasis", "priceUpdatedAt", "priceValidUntil"];

/** Explicit local application only. Copy public keys, never private assumptions or costs. */
export function sanitizePublicCatalog(publicCatalog, proposal) {
  if (!Array.isArray(publicCatalog?.products) || !Array.isArray(proposal?.products)) throw new TypeError("Catálogo público o propuesta inválidos.");
  const proposed = new Map(proposal.products.map((product) => [product.id, product]));
  const publicIds = new Set(publicCatalog.products.map((product) => product.id));
  if (proposed.size !== proposal.products.length || publicIds.size !== publicCatalog.products.length || proposed.size !== publicIds.size || [...publicIds].some((id) => !proposed.has(id))) throw new Error("Los IDs públicos y privados no coinciden exactamente; no se aplicó nada.");
  return {
    version: publicCatalog.version || 1,
    updatedAt: proposal.generatedAt.slice(0, 10),
    products: publicCatalog.products.map((product) => {
      const source = proposed.get(product.id);
      const result = Object.fromEntries(PUBLIC_PRODUCT_KEYS.filter((key) => key in product).map((key) => [key, product[key]]));
      result.price = source.orderable ? source.proposedPrice : null;
      if (source.orderable && !finitePositive(result.price)) throw new Error(`Precio público inválido para ${product.id}`);
      result.currency = "ARS";
      result.orderable = source.orderable;
      result.priceBasis = source.priceBasis;
      result.priceUpdatedAt = source.priceUpdatedAt;
      result.priceValidUntil = source.priceValidUntil;
      if (!Number.isFinite(Date.parse(result.priceUpdatedAt)) || !Number.isFinite(Date.parse(result.priceValidUntil))) throw new Error(`Fechas públicas inválidas para ${product.id}`);
      return result;
    }),
  };
}

export function buildStorePriceFiles({ generatedAt, applyPublic = false } = {}) {
  const folder = resolve(ROOT, ".private/market-research");
  const readJson = (file) => JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  const catalog = readJson(resolve(ROOT, ".private/catalog-costs.json"));
  const seedPath = resolve(folder, "normalized-seeds.json");
  const seedData = existsSync(seedPath) ? readJson(seedPath) : [];
  const seeds = Array.isArray(seedData) ? seedData : seedData.references;
  const policy = createPricingPolicy(generatedAt);
  const proposal = proposeStorePrices(catalog, seeds, policy);
  mkdirSync(folder, { recursive: true });
  const policyPath = resolve(folder, "pricing-policy.json");
  const proposalPath = resolve(folder, "store-price-proposal.json");
  writeFileSync(policyPath, JSON.stringify(policy, null, 2) + "\n", "utf8");
  writeFileSync(proposalPath, JSON.stringify(proposal, null, 2) + "\n", "utf8");
  let publicBackup = null;
  if (applyPublic) {
    const publicPath = resolve(ROOT, "public/tienda/catalog.json");
    const sanitized = sanitizePublicCatalog(readJson(publicPath), proposal);
    const stamp = policy.generatedAt.replace(/[^0-9TZ]/g, "");
    publicBackup = resolve(folder, `catalog.public.before-prices-${stamp}.json`);
    copyFileSync(publicPath, publicBackup);
    const temporaryPath = publicPath + ".pricing-tmp";
    writeFileSync(temporaryPath, JSON.stringify(sanitized, null, 2) + "\n", "utf8");
    renameSync(temporaryPath, publicPath);
  }
  return { policyPath, proposalPath, publicApplied: applyPublic, publicBackup, summary: proposal.summary };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.some((arg) => arg !== "--apply-public") || args.length > 1) throw new Error("Uso: node scripts/build-store-prices.mjs [--apply-public]. Sin bandera, solo genera propuestas privadas.");
    console.log(JSON.stringify(buildStorePriceFiles({ applyPublic: args.includes("--apply-public") }), null, 2));
  } catch (error) {
    console.error(`No se pudo proponer precios: ${error.message}`);
    process.exitCode = 1;
  }
}
