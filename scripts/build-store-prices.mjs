import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, renameSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { calculatePrice } from "./pricing.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const DAY_MS = 24 * 60 * 60 * 1000;
const fold = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
const finitePositive = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;

export function createEvidencePolicy(generatedAt = new Date().toISOString()) {
  const at = new Date(generatedAt);
  if (!Number.isFinite(at.getTime())) throw new TypeError("generatedAt debe ser una fecha válida.");
  return { generatedAt: at.toISOString(), proposal: { maximumEvidenceAgeHours: 24 } };
}

/** Business rates live only in the ignored, local pricing settings. */
export function createPricingPolicy(generatedAt = new Date().toISOString(), settings) {
  const { generatedAt: at } = createEvidencePolicy(generatedAt);
  if (!settings?.proposal || !settings.confirmedChoices) throw new TypeError("Falta la configuración privada explícita de precios.");
  return {
    version: 1,
    status: settings.status,
    generatedAt: at,
    priceValidUntil: new Date(Date.parse(at) + settings.proposal.supplierMaxAgeDays * DAY_MS).toISOString(),
    confirmedChoices: structuredClone(settings.confirmedChoices),
    proposal: structuredClone(settings.proposal),
  };
}

function validatePolicy(policy) {
  const p = policy?.proposal;
  if (!p || !["proposed", "active"].includes(policy.status)) throw new TypeError("Se necesita una política explícita propuesta o activa.");
  const markupMode = p.pricingMethod === "cost-markup";
  const marginRates = markupMode ? [] : [p.fallbackTargetMarginRate, ...Object.values(p.categoryTargetMarginRates || {}), ...Object.values(p.sourceCategoryTargetMarginRates || {})];
  for (const rate of [p.reserveRate, p.paymentFeeRate, ...marginRates]) {
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate < 0 || rate >= 1) throw new TypeError("Las tasas deben ser proporciones numéricas en [0,1), no porcentajes enteros ni texto.");
  }
  if (p.reserveRate + p.paymentFeeRate + Math.max(0, ...marginRates) >= 1) throw new RangeError("Comisión, reserva y margen deben sumar menos que uno.");
  if (markupMode) for (const rate of [p.fallbackMarkupRate, ...Object.values(p.categoryMarkupRates || {}), ...Object.values(p.sourceCategoryMarkupRates || {})]) {
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate < 0) throw new TypeError("El recargo debe ser una proporción numérica no negativa.");
    if ((1 + rate) * (1 - p.reserveRate - p.paymentFeeRate) <= 1) throw new RangeError("El recargo no cubre comisión y reserva.");
  }
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
    const markupMode = settings.pricingMethod === "cost-markup";
    const categoryRates = markupMode ? settings.categoryMarkupRates : settings.categoryTargetMarginRates;
    const sourceRates = markupMode ? settings.sourceCategoryMarkupRates : settings.sourceCategoryTargetMarginRates;
    const sourceRate = sourceRates?.[fold(product.sourceCategory)];
    const categoryRate = categoryRates?.[product.category];
    const rate = sourceRate ?? categoryRate ?? (markupMode ? settings.fallbackMarkupRate : settings.fallbackTargetMarginRate);
    const markupRate = markupMode ? rate : null;
    const targetMarginRate = markupMode ? 1 - settings.reserveRate - settings.paymentFeeRate - 1 / (1 + markupRate) : rate;
    const marginBasis = sourceRate !== undefined ? "source-category" : categoryRate !== undefined ? "category" : "fallback";
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
      policyStatus: policy.status,
      pricingMethod: markupMode ? "cost-markup" : "target-margin",
      minimumMarkupRate: markupRate,
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
      targetMarginRate: markupMode ? 0 : targetMarginRate,
      minimumProfit: settings.minimumProfitPerUnitARS,
      roundTo,
    });
    if (markupMode) {
      const markupFloor = Math.ceil(quote.orderCostArs * (1 + markupRate) / roundTo - 1e-10) * roundTo;
      quote.unitPrice = Math.max(quote.unitPrice, markupFloor);
    }
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
      if (settings.marketAdjustmentEnabled === false) {
        entry.marketStatus = "reference-only-cost-policy";
      } else if (marketTargetARS >= quote.unitPrice) {
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
    status: policy.status === "active" ? "calculated-from-active-policy" : "proposed-not-automatically-published",
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
  let changed = false;
  const products = publicCatalog.products.map((product) => {
    const source = proposed.get(product.id);
    const result = Object.fromEntries(PUBLIC_PRODUCT_KEYS.filter((key) => key in product).map((key) => [key, product[key]]));
    result.price = source.orderable ? source.proposedPrice : null;
    if (source.orderable && !finitePositive(result.price)) throw new Error(`Precio público inválido para ${product.id}`);
    result.currency = "ARS";
    result.orderable = source.orderable;
    result.priceBasis = source.priceBasis;
    result.priceValidUntil = source.priceValidUntil;
    const unchanged = ["price", "currency", "orderable", "priceBasis", "priceValidUntil"].every(key => result[key] === product[key]);
    result.priceUpdatedAt = unchanged && Number.isFinite(Date.parse(product.priceUpdatedAt)) ? product.priceUpdatedAt : source.priceUpdatedAt;
    if (!unchanged) changed = true;
    if (!Number.isFinite(Date.parse(result.priceUpdatedAt)) || !Number.isFinite(Date.parse(result.priceValidUntil))) throw new Error(`Fechas públicas inválidas para ${product.id}`);
    return result;
  });
  const dateParts = Object.fromEntries(new Intl.DateTimeFormat("en", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(proposal.generatedAt)).map(part => [part.type, part.value]));
  return {
    version: publicCatalog.version || 1,
    updatedAt: !changed && publicCatalog.updatedAt ? publicCatalog.updatedAt : `${dateParts.year}-${dateParts.month}-${dateParts.day}`,
    products,
  };
}

export function buildStorePriceFiles({ generatedAt, applyArchive = false, applyPublic = false } = {}) {
  if (applyPublic) throw new Error("La tienda pública fue retirada. Usá applyArchive o --apply-archive para actualizar sólo el archivo histórico.");
  const folder = resolve(ROOT, ".private/market-research");
  const readJson = (file) => JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  const catalog = readJson(resolve(ROOT, ".private/catalog-costs.json"));
  const seedPath = resolve(folder, "normalized-seeds.json");
  const seedData = existsSync(seedPath) ? readJson(seedPath) : [];
  const seeds = Array.isArray(seedData) ? seedData : seedData.references;
  const settings = readJson(resolve(folder, "pricing-settings.json"));
  const policy = createPricingPolicy(generatedAt, settings);
  const proposal = proposeStorePrices(catalog, seeds, policy);
  mkdirSync(folder, { recursive: true });
  const policyPath = resolve(folder, "pricing-policy.json");
  const proposalPath = resolve(folder, "store-price-proposal.json");
  writeFileSync(policyPath, JSON.stringify(policy, null, 2) + "\n", "utf8");
  writeFileSync(proposalPath, JSON.stringify(proposal, null, 2) + "\n", "utf8");
  let archiveBackup = null;
  if (applyArchive) {
    const archivePath = resolve(ROOT, "legacy/hardware-store/catalog.json");
    const sanitized = sanitizePublicCatalog(readJson(archivePath), proposal);
    const stamp = policy.generatedAt.replace(/[^0-9TZ]/g, "");
    archiveBackup = resolve(folder, `catalog.archive.before-prices-${stamp}.json`);
    copyFileSync(archivePath, archiveBackup);
    const temporaryPath = archivePath + ".pricing-tmp";
    writeFileSync(temporaryPath, JSON.stringify(sanitized, null, 2) + "\n", "utf8");
    renameSync(temporaryPath, archivePath);
  }
  return { policyPath, proposalPath, archiveApplied: applyArchive, archiveBackup, summary: proposal.summary };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.includes("--apply-public")) throw new Error("La tienda pública fue retirada. --apply-archive actualiza sólo el archivo histórico fuera de public/.");
    if (args.some((arg) => arg !== "--apply-archive") || args.length > 1) throw new Error("Uso: node scripts/build-store-prices.mjs [--apply-archive]. Sin bandera, solo genera propuestas privadas.");
    console.log(JSON.stringify(buildStorePriceFiles({ applyArchive: args.includes("--apply-archive") }), null, 2));
  } catch (error) {
    console.error(`No se pudo proponer precios: ${error.message}`);
    process.exitCode = 1;
  }
}
