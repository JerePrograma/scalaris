import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createEvidencePolicy, normalizeMarketEvidence } from "./build-store-prices.mjs";
import { classifyCandidateUrl } from "./market-references.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const date = value => typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;

function decodedComponent(value) {
  let current = value;
  for (let pass = 0; pass < 4; pass++) {
    let decoded;
    try { decoded = decodeURIComponent(current); } catch { return null; }
    if (decoded === current) return current;
    current = decoded;
  }
  return /%[0-9a-f]{2}/i.test(current) ? null : current;
}

function credentialKey(key) {
  const decoded = decodedComponent(key);
  if (decoded === null) return true;
  const name = decoded.toLowerCase().replace(/[^a-z0-9]/g, "");
  return /token|apikey|accesskey|privatekey|clientkey|password|passwd|passphrase|passcode|secret|credential|auth|session|sessid|jwt|csrf|nonce|signature/.test(name) || ["pwd", "sid", "key", "code"].includes(name);
}

// Reject credentials before canonicalization can remove any query parameters.
export function publicReferenceUrl(value) {
  let url;
  try { url = new URL(value); } catch { return null; }
  const path = decodedComponent(url.pathname);
  if (url.username || url.password || path === null || path.split(/[;/]/).some(part => part.includes("=") && credentialKey(part.split("=", 1)[0]))) return null;
  for (const key of url.searchParams.keys()) if (credentialKey(key)) return null;
  const candidate = classifyCandidateUrl(url.href);
  return candidate.eligible ? candidate.url : null;
}

/** Only explicit public aggregates and strictly accepted, safe references leave here. */
export function buildPublicMarketProgress(publicCatalog, research, seedData = [], generatedAt = new Date().toISOString()) {
  const policy = createEvidencePolicy(generatedAt);
  const now = Date.parse(policy.generatedAt);
  if (!Array.isArray(publicCatalog?.products)) throw new TypeError("Catálogo público inválido.");
  const ids = publicCatalog.products.map(product => product?.id);
  if (ids.some(id => typeof id !== "string" || !id) || new Set(ids).size !== ids.length) throw new TypeError("Los IDs públicos deben ser únicos y válidos.");
  const publicIds = new Set(ids);
  const researchDate = date(research?.generatedAt);
  const researchAvailable = Array.isArray(research?.products) && researchDate && Date.parse(researchDate) <= now;
  const researchedIds = new Set();
  if (researchAvailable) {
    const latest = new Map();
    for (const row of research.products) {
      if (!publicIds.has(row?.id)) continue;
      const observed = date(row.searchedAt);
      if (!observed || Date.parse(observed) > Date.parse(researchDate)) continue;
      if (!latest.has(row.id) || observed >= latest.get(row.id).observed) latest.set(row.id, { observed, status: row.searchStatus });
    }
    for (const [id, row] of latest) if (["indexed", "noIndexedResults"].includes(row.status)) researchedIds.add(id);
  }
  const seeds = Array.isArray(seedData) ? seedData : Array.isArray(seedData?.references) ? seedData.references : [];
  const byId = new Map();
  for (const seed of seeds) {
    const id = seed?.id || seed?.productId;
    if (!publicIds.has(id)) continue;
    const evidence = normalizeMarketEvidence(seed, id, policy);
    if (!evidence) continue;
    const url = publicReferenceUrl(evidence.url);
    if (!url) continue;
    if (!byId.has(id)) byId.set(id, new Map());
    const urls = byId.get(id);
    const prior = urls.get(url);
    if (!prior || evidence.observedAt > prior.observedAt) urls.set(url, { url, priceARS: evidence.priceARS, currency: "ARS", observedAt: evidence.observedAt });
    else if (evidence.observedAt === prior.observedAt && evidence.priceARS !== prior.priceARS) urls.set(url, { ...prior, conflict: true });
  }
  const products = ids.flatMap(id => {
    const references = [...(byId.get(id)?.values() || [])].filter(reference => !reference.conflict).sort((a, b) => a.url.localeCompare(b.url));
    return references.length ? [{ id, references }] : [];
  });
  const updatedDates = [researchAvailable ? researchDate : null, ...products.flatMap(product => product.references.map(reference => reference.observedAt))].filter(Boolean).sort();
  return {
    version: 1,
    updatedAt: updatedDates.at(-1) || null,
    summary: {
      totalProducts: ids.length,
      researchedProducts: researchAvailable ? researchedIds.size : null,
      productsWithVerifiedReferences: products.length,
      verifiedReferences: products.reduce((count, product) => count + product.references.length, 0),
    },
    products,
  };
}

export function buildPublicMarketProgressFile({ generatedAt } = {}) {
  const readJson = path => JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
  const folder = resolve(ROOT, ".private/market-research");
  const researchPath = resolve(folder, "market-references.json");
  const seedPath = resolve(folder, "normalized-seeds.json");
  const result = buildPublicMarketProgress(
    readJson(resolve(ROOT, "legacy/hardware-store/catalog.json")),
    existsSync(researchPath) ? readJson(researchPath) : null,
    existsSync(seedPath) ? readJson(seedPath) : [],
    generatedAt,
  );
  const target = resolve(ROOT, "legacy/hardware-store/market-progress.json");
  const temporary = target + ".tmp";
  writeFileSync(temporary, JSON.stringify(result, null, 2) + "\n", "utf8");
  renameSync(temporary, target);
  return { output: target, summary: result.summary };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length > 2) throw new Error("Uso: node scripts/build-public-market-progress.mjs");
    console.log(JSON.stringify(buildPublicMarketProgressFile(), null, 2));
  } catch (error) {
    console.error(`No se pudo preparar el avance público: ${error.message}`);
    process.exitCode = 1;
  }
}
