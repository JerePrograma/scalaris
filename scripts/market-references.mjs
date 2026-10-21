/** Read-only public research. Writes only private checkpoints; never publishes a price. */
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, renameSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

export const FETCH_CONCURRENCY = 4;
export const FETCH_BATCH_SIZE = 10;
export const MAX_RATE_RETRIES = 2;
const BLOCKED_HOSTS = ["mercadolibre.com.ar", "mercadolibre.com", "mercadolivre.com", "facebook.com", "instagram.com", "tiktok.com", "youtube.com", "pinterest.com", "reddit.com", "x.com", "twitter.com", "google.com", "google.com.ar", "bing.com", "yahoo.com", "nb.com.ar", "distriland.com.ar", "tecnoprices.com.ar", "tecnoprice.com.ar", "cuandocomprar.com.ar", "hardgamers.com.ar", "historial.com.ar", "comparar.com.ar", "mercadotrack.com", "idealo.com", "scribd.com", "manuals.plus", "listado.mercadolibre.com.ar", "geniusnet.com", "logitech.com", "trust.com", "tp-link.com", "intel.com", "amd.com", "asus.com"];
const RELATED = /^(?:productos? (?:relacionados?|similares|recomendados)|mas productos|tambien (?:te (?:puede|podria|podrian)|podria|podrian|te recomendamos|compraron)|te puede interesar|te recomendamos|otros (?:productos|clientes)|completa tu compra|quienes compraron|related products|you may also like|recently viewed|visto recientemente|recomendados para vos)/;
const fold = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const unique = values => [...new Set(values)];

export function canonicalUrl(value) {
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    if (/^(?:localhost|127\.|10\.|192\.168\.|0\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(url.hostname) || /\.(?:local|internal)$/.test(url.hostname) || !url.hostname.includes(".")) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (/^(?:utm_|srsltid|gclid|fbclid|msclkid)/i.test(key)) url.searchParams.delete(key);
    url.hostname = url.hostname.toLowerCase();
    return url.href;
  } catch { return null; }
}

function decodedUrlPart(value) {
  let decoded = String(value);
  for (let count = 0; count < 3; count++) {
    try { const next = decodeURIComponent(decoded); if (next === decoded) break; decoded = next; } catch { break; }
  }
  return decoded.toLowerCase();
}

function hasPurchaseOrMutationAction(url) {
  const compact = value => decodedUrlPart(value).replace(/[^a-z0-9]/g, "");
  const actions = new Set(["addtocart", "addtobasket", "buynow", "removeitem", "removefromcart", "deleteitem", "emptycart", "clearcart", "updatecart", "wcajax", "action", "cart", "checkout"]);
  for (const key of url.searchParams.keys()) if (actions.has(compact(decodedUrlPart(key).split("[")[0]))) return true;
  const endpoints = new Set([...actions, "basket", "carrito", "finalizarcompra", "orderpay", "orderreceived", "cartphp", "checkoutphp"]);
  return decodedUrlPart(url.pathname).split(/[\\/]+/).some(part => endpoints.has(compact(part)));
}

export function classifyCandidateUrl(value) {
  const canonical = canonicalUrl(value);
  if (!canonical) return { eligible: false, reason: "invalid_or_nonpublic_url", url: null };
  const url = new URL(canonical);
  const host = url.hostname.replace(/^www\./, "");
  if (hasPurchaseOrMutationAction(url)) return { eligible: false, reason: "purchase_cart_or_mutation_action_url", url: canonical };
  if (BLOCKED_HOSTS.some(blocked => host === blocked || host.endsWith("." + blocked))) return { eligible: false, reason: "marketplace_supplier_social_or_aggregator", url: canonical };
  if (/^(?:nb|distriland|tecnoprices|tecnoprice)\./.test(host)) return { eligible: false, reason: "supplier_not_retail_benchmark", url: canonical };
  if (/\.(?:mx|cl|co|br|uy|pe|es|bo|py|ec|ve|cr|pa|us|uk|cn)$/.test(host)) return { eligible: false, reason: "non_argentine_country_domain", url: canonical };
  if (/\.(?:pdf|xlsx?|csv|docx?|zip|rar|jpg|png|webp)(?:$|\?)/i.test(url.pathname)) return { eligible: false, reason: "not_product_page", url: canonical };
  if (url.pathname === "/" || /\/(?:search|buscar|busqueda|catalogo|categorias?|categoria-producto|product-category|tag|marcas?|brands?|shop|tienda)\/?$/i.test(url.pathname) || /\/(?:page|pagina)\/\d+\/?$/i.test(url.pathname) || /(?:^|[?&])(?:s|q|search|query|buscar)=/i.test(url.search)) return { eligible: false, reason: "search_or_category_page", url: canonical };
  if (/\/(?:search|buscar|busqueda|categorias?|categoria-producto|product-category|tag|marcas?|brands?)\//i.test(url.pathname)) return { eligible: false, reason: "search_or_category_page", url: canonical };
  return { eligible: true, reason: "candidate_product_page_not_yet_verified", url: canonical };
}

export function selectCandidates(record, maximum = 2) {
  const accepted = [], rejected = [], seen = new Set();
  for (const result of [...(record.storeResults || []), ...(record.results || [])]) {
    const checked = classifyCandidateUrl(result.url || result.link);
    if (!checked.eligible) { rejected.push({ url: checked.url || result.url || result.link || null, reason: checked.reason }); continue; }
    if (seen.has(checked.url)) continue;
    seen.add(checked.url);
    accepted.push({ url: checked.url, titleFromIndex: String(result.title || ""), discoveryOnly: true });
    if (accepted.length === maximum) break;
  }
  return { accepted, rejected: rejected.slice(0, 15) };
}

export function unwrapToolResponse(value) {
  if (value?.structuredContent && typeof value.structuredContent === "object") return value.structuredContent;
  if (Array.isArray(value?.results) || Array.isArray(value?.errors)) return value;
  for (const block of value?.content || []) {
    if (block.type !== "text") continue;
    try { const parsed = JSON.parse(block.text); if (parsed && typeof parsed === "object") return parsed; } catch { /* Preserve unstructured error below. */ }
  }
  return { results: [], errors: [{ error: (value?.content || []).map(x => x.text || "").join(" ") || String(value?.error || "unrecognised_fetch_response") }] };
}

export function flattenDocument(node, output = []) {
  if (node == null) return output;
  if (typeof node === "string") { if (node.trim()) output.push({ type: "paragraph", text: node.trim() }); return output; }
  if (Array.isArray(node)) { for (const child of node) flattenDocument(child, output); return output; }
  if (typeof node !== "object") return output;
  if (typeof node.text === "string" && node.text.trim()) output.push({ type: node.type || "paragraph", level: Number(node.level) || null, text: node.text.trim() });
  if (Array.isArray(node.items)) for (const item of node.items) flattenDocument(item, output);
  if (Array.isArray(node.children)) for (const child of node.children) flattenDocument(child, output);
  if (typeof node.content === "string" || Array.isArray(node.content)) flattenDocument(node.content, output);
  return output;
}

export function productScope(page) {
  const blocks = flattenDocument(page.text ?? page.content ?? page.markdown);
  const headingIndex = blocks.findIndex(block => block.type === "heading" && block.level === 1);
  if (headingIndex < 0) return { title: String(page.title || ""), blocks: [], text: "", priceText: "", proven: false, reason: "missing_product_h1" };
  const main = [];
  let boundaryDetected = false;
  const originalTitle = fold(blocks[headingIndex].text);
  for (let i = headingIndex; i < blocks.length; i++) {
    const block = blocks[i];
    const headingText = fold(block.text).replace(/^[^A-Z0-9]+/, "");
    const newProductCard = block.type === "heading" && /^(?:MOUSE|TECLADO|BASE COOLER|MEMORIA|DISCO|AURICULAR|NOTEBOOK|MONITOR|PLACA|POWERBANK|PROCESADOR|GABINETE|KIT TECLADO|CARGADOR)\b/.test(headingText) && !originalTitle.includes(headingText) && !headingText.includes(originalTitle);
    if (i > headingIndex && ((block.type === "heading" && block.level === 1) || RELATED.test(headingText.toLowerCase()) || newProductCard)) {
      boundaryDetected = true;
      if (newProductCard && /^\S+\s+(?:EN STOCK|BAJO STOCK|SIN STOCK)$/.test(fold(main.at(-1)?.text))) main.pop();
      break;
    }
    main.push(block);
  }
  const priceBlocks = [];
  for (const block of main) {
    if (block.type === "heading" && block.level !== 1 && /^(?:DESCRIPCION|CARACTERISTICAS|ESPECIFICACIONES|INFORMACION ADICIONAL|DETALLES TECNICOS|VALORACIONES|OPINIONES)/.test(fold(block.text).replace(/^[^A-Z0-9]+/, ""))) break;
    priceBlocks.push(block);
  }
  return { title: main[0]?.text || page.title || "", blocks: main, text: main.map(x => x.text).join("\n").slice(0, 24000), priceText: priceBlocks.map(x => x.text).join("\n").slice(0, 10000), proven: true, boundaryDetected, reason: null };
}

export function parseArgentineAmount(value) {
  let text = String(value).replace(/[^\d.,-]/g, "");
  if (!text || text.includes("-")) return null;
  if (text.includes(",")) text = text.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(?:\.\d{3})+$/.test(text)) text = text.replace(/\./g, "");
  const amount = Number(text);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function metadataEntries(object, prefix = "", output = []) {
  if (!object || typeof object !== "object") return output;
  for (const [key, value] of Object.entries(object)) {
    const path = prefix ? prefix + ":" + key : key;
    if (value && typeof value === "object") metadataEntries(value, path, output);
    else output.push({ key: path.toLowerCase(), value: String(value ?? "") });
  }
  return output;
}

export function extractPrice(page, scope = productScope(page)) {
  const entries = metadataEntries(page.page_metadata || page.metadata || {});
  const currencies = unique(entries.filter(x => /currency/.test(x.key)).map(x => fold(x.value)));
  const explicitARS = currencies.includes("ARS") || /(?:\bARS\b|AR\$|PESOS ARGENTINOS)/.test(fold(scope.priceText));
  const foreign = currencies.some(x => /^(?:USD|EUR|BRL|CLP|MXN)$/.test(x)) || /(?:\bUSD\b|U\$S|US\$|\bEUR\b)/.test(fold(scope.priceText));
  const currencyStatus = explicitARS && !foreign ? "ARS_confirmed" : foreign ? "foreign_or_multiple_currencies" : "currency_unconfirmed";
  const metadataPrices = unique(entries.filter(x => /(?:price[:_-]?amount|tiendanube:price|product:price|offers?:price$|^price$)/.test(x.key) && !/currency|discount|install|cuota|lowprice|highprice/.test(x.key)).map(x => {
    const n = Number(x.value.replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : null;
  }).filter(Boolean));
  const visibleCandidates = [];
  if (scope.proven) {
    const lines = scope.priceText.split("\n");
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      const context = fold(lines.slice(Math.max(0, index - 1), index + 2).join(" "));
      for (const match of line.matchAll(/(?:AR\$|ARS|\$)\s*([\d][\d.,]*)/gi)) {
        const amount = parseArgentineAmount(match[1]);
        if (!amount) continue;
        const local = fold(line);
        const role = /SIN IMPUESTOS|SIN IVA|PRECIO NETO|\bS\s*\/\s*IMP\.?/.test(local) ? "tax_excluded" : /\b\d+\s*(?:CUOTAS?|PAGOS?)\b|CUOTA (?:DE|PROMOCIONADA)/.test(local) ? "installment" : /ENVIO|FLETE|DELIVERY/.test(local) ? "shipping" : /AHORR[AÁ]S|AHORRO|DESCUENTO DE/.test(local) ? "saving" : /LISTA|ANTES|PRECIO REGULAR/.test(local) ? "list" : /TRANSFERENCIA/.test(context) ? "transfer" : /EFECTIVO/.test(context) ? "cash" : "offer_unlabelled";
        visibleCandidates.push({ amountARS: amount, role, evidence: line.slice(0, 200) });
      }
    }
  }
  const totals = visibleCandidates.filter(x => !["tax_excluded", "installment", "shipping", "saving"].includes(x.role));
  const visibleValues = unique(totals.map(x => x.amountARS));
  const conflict = metadataPrices.length > 1 || (metadataPrices.length > 0 && visibleValues.length > 0 && metadataPrices.some(value => !visibleValues.includes(value)));
  const preferred = totals.filter(x => ["transfer", "cash"].includes(x.role));
  const preferredValues = unique(preferred.map(x => x.amountARS));
  const ambiguous = preferredValues.length > 1 || (!preferredValues.length && visibleValues.length > 1);
  const selected = preferredValues.length === 1 ? preferredValues[0] : visibleValues.length === 1 ? visibleValues[0] : visibleValues.length === 0 && metadataPrices.length === 1 && scope.proven ? metadataPrices[0] : null;
  return { priceARS: conflict || ambiguous || currencyStatus !== "ARS_confirmed" ? null : selected, priceCandidateARS: selected, currencyStatus, visibleCandidates: visibleCandidates.slice(0, 20), metadataPrices, conflict, ambiguous, status: conflict ? "price_conflict" : ambiguous ? "price_ambiguous" : !selected ? "price_missing" : currencyStatus !== "ARS_confirmed" ? "currency_unconfirmed" : "price_observed" };
}

function hasToken(text, value) {
  const wanted = fold(value);
  if (!wanted) return false;
  const pattern = (wanted.match(/[A-Z0-9]+|\+/g) || []).map(escapeRegExp).join("[\\s_-]*").replace(/(\d)([A-Z])/g, "$1\\s*$2");
  return Boolean(pattern) && new RegExp("(?:^|[^A-Z0-9])" + pattern + "(?=$|[^A-Z0-9])").test(fold(text));
}
const COLOR_NAMES = { NEGRO: ["NEGRO", "BLACK"], BLACK: ["NEGRO", "BLACK"], BLANCO: ["BLANCO", "WHITE"], WHITE: ["BLANCO", "WHITE"], GRIS: ["GRIS", "GREY", "GRAY"], GREY: ["GRIS", "GREY", "GRAY"], GRAY: ["GRIS", "GREY", "GRAY"], AZUL: ["AZUL", "BLUE"], BLUE: ["AZUL", "BLUE"], VERDE: ["VERDE", "GREEN"], GREEN: ["VERDE", "GREEN"], ROJO: ["ROJO", "RED"], RED: ["ROJO", "RED"], ROSA: ["ROSA", "PINK"], PINK: ["ROSA", "PINK"], AMARILLO: ["AMARILLO", "YELLOW"], YELLOW: ["AMARILLO", "YELLOW"], PLATEADO: ["PLATEADO", "SILVER"], SILVER: ["PLATEADO", "SILVER"] };

// A terminal + is part of a manufacturer's model, rather than a separator.
const compactPartNumber = value => fold(value).replace(/[^A-Z0-9+]/g, "");
const CODE_SUFFIX = "(?:\\+|[ _-]*GEN[ _-]*\\d+|[ _-]+(?:V\\d+(?:\\.\\d+)?|R\\d+(?:\\.\\d+)?|REV(?:ISION)?\\.?[ _-]*\\d+(?:\\.\\d+)?|PLUS))";
function splitCodeSuffix(value) {
  const normalized = fold(value);
  const match = normalized.match(new RegExp("(" + CODE_SUFFIX + ")$"));
  return match ? { base: normalized.slice(0, match.index).trim(), suffix: compactPartNumber(match[1]), revision: /^REV/.test(match[1].trim()) } : { base: normalized, suffix: "", revision: false };
}
function suffixRelationship(expected, observed) {
  const left = splitCodeSuffix(expected), right = splitCodeSuffix(observed);
  const base = compactPartNumber(left.base);
  if (base !== compactPartNumber(right.base) || base.length < 5 || !/[A-Z]/.test(base) || !/\d/.test(base)) return null;
  return { differs: left.suffix !== right.suffix, revisionUnconfirmed: (left.revision || right.revision) && (!left.suffix || !right.suffix) };
}
function visiblePartNumbers(text, expected) {
  const { base } = splitCodeSuffix(expected);
  const pattern = [...compactPartNumber(base)].map(escapeRegExp).join("[ ._/-]*");
  if (!pattern) return [];
  const matcher = new RegExp("(?:^|[^A-Z0-9+])(" + pattern + "(?:" + CODE_SUFFIX + ")*)(?=$|[^A-Z0-9+])", "g");
  return String(text).split(/\r?\n/).flatMap(line => [...fold(line).matchAll(matcher)].map(match => match[1]));
}
function primaryCodeBranch(title, expected) {
  const parts = splitCodeSuffix(expected).base.split(/\s+/);
  // A complete two-part model such as H810M H has a meaningful short branch.
  // Seeing only its shared H810M family cannot confirm H instead of K.
  if (parts.length !== 2 || !/^[A-Z]$/.test(parts[1]) || !isUniqueModelToken(parts[0]) || compactPartNumber(parts[0]).length < 4) return null;
  const family = compactPartNumber(parts[0]), branch = parts[1];
  const pattern = [...family].map(escapeRegExp).join("[ ._/-]*");
  const matches = [...fold(title).matchAll(new RegExp("(?:^|[^A-Z0-9])" + pattern + "[ _-]*([A-Z0-9]+)(?=$|[^A-Z0-9])", "g"))];
  const observed = unique(matches.map(match => compactPartNumber(splitCodeSuffix(match[1]).base)));
  const conflicts = observed.filter(value => /^[A-Z]$/.test(value) && value !== branch).map(value => family + " " + value);
  return { conflicts, unconfirmed: conflicts.length === 0 && !observed.includes(branch) && (matches.length > 0 || visiblePartNumbers(title, parts[0]).length > 0) };
}
function comparableSkuFamily(expected, observed) {
  const left = compactPartNumber(expected), right = compactPartNumber(observed);
  if (suffixRelationship(expected, observed)?.differs) return true;
  // A retailer's numeric/internal SKU is not automatically a manufacturer MPN.
  // Only closely related, complete alphanumeric codes establish a shared family.
  if (Math.min(left.length, right.length) < 8 || !/[A-Z]/.test(left) || !/\d/.test(left) || !/[A-Z]/.test(right) || !/\d/.test(right)) return false;
  if (left.startsWith(right) || right.startsWith(left)) return false;
  let prefix = 0;
  while (left[prefix] && left[prefix] === right[prefix]) prefix++;
  return prefix >= Math.max(6, Math.ceil(Math.min(left.length, right.length) * 0.5)) && left.replace(/\D/g, "") === right.replace(/\D/g, "") && Math.min(left.length, right.length) / Math.max(left.length, right.length) >= 0.8;
}

function manufacturerCodeEvidence(text, expected) {
  if (!expected) return [];
  const fields = [];
  const pattern = /\b(MANUFACTURER PART NUMBER|CODIGO (?:DE )?FABRICANTE|NUMERO DE PARTE|PART[ _-]?NUMBER|PART[ _-]?NO\.?|MPN|P\/N|SKU|MODELO)\b\s*[:#=\-]?\s*/g;
  const expectedWords = new Set(fold(expected).split(/\s+/));
  // Parse each delimited field separately: folding the whole document would erase
  // line boundaries and silently turn the following description into a code.
  for (const line of String(text).split(/\r?\n/)) for (const field of line.split(/[|;\t]/)) {
    const normalized = fold(field), labels = [...normalized.matchAll(pattern)];
    for (let index = 0; index < labels.length; index++) {
      const match = labels[index], label = match[1];
      const raw = normalized.slice(match.index + match[0].length, labels[index + 1]?.index).split(/\s+(?:STOCK|ID|PRECIO|GARANTIA|DESCRIPCION|CATEGORIA|MARCA)\s*[:#=]/)[0].trim().replace(/[.,]+$/, "");
      // Descriptive UI text such as "Part number CPU" does not establish a code.
      if (!(/[A-Z]/.test(raw) && /\d/.test(raw)) && !/^\d{5,}$/.test(raw)) continue;
      const words = raw.split(/\s+/);
      // "SKU Original HP: ..." and "Modelo OEM que reemplaza: ..." describe
      // compatibility, whereas the code must immediately follow its field label.
      if (!/[:#=]/.test(match[0]) && !/\d/.test(words[0]) && !expectedWords.has(words[0])) continue;
      const manufacturerLabel = !["SKU", "MODELO"].includes(label);
      const delimitedCode = /^[A-Z0-9][A-Z0-9._/+ -]*$/.test(raw) && words.every(word => expectedWords.has(word) || /\d/.test(word) || /^(?:K|H|D|E|P|V|R|GEN|REV\.?|REVISION|PLUS|I{1,3}|IV)$/.test(word));
      if (!delimitedCode || /\S\s+\+\s+\S/.test(raw)) {
        const related = visiblePartNumbers(raw, expected).some(code => compactPartNumber(raw).startsWith(compactPartNumber(code))) || comparableSkuFamily(expected, words[0]);
        fields.push({ label, value: null, comparable: false, matches: false, basis: "ambiguous_code_field", unconfirmed: manufacturerLabel || related });
        continue;
      }
      const value = raw, matches = compactPartNumber(value) === compactPartNumber(expected);
      const comparable = manufacturerLabel || matches || comparableSkuFamily(expected, value);
      fields.push({ label, value, comparable, matches, basis: manufacturerLabel ? "manufacturer_label" : matches ? "same_code" : comparable ? "same_manufacturer_code_family" : "retailer_sku_unattributed" });
    }
  }
  return fields;
}

function isUniqueModelToken(value) {
  const token = fold(value);
  if (!/[A-Z].*\d|\d.*[A-Z]/.test(token)) return false;
  if (/^(?:LPDDR[2-9]X?|DDR[2-9]L?|GDDR[2-9]X?|(?:SO[- ]?)?DIMM|SDRAM|PCI(?:E)?\d(?:\.\d)?|USB\d(?:\.\d)?)$/.test(token)) return false;
  if (/^(?:VESA)?\d+(?:[.,]\d+)?X\d+(?:[.,]\d+)?(?:X\d+(?:[.,]\d+)?)?$/.test(token)) return false;
  return !/^(?:\d+(?:[.,]\d+)?(?:[GMK]?BPS|G|W|A|V|GB|TB|M|CM|MM|LM|L|KG|MAH|[GMK]?HZ|OHM|DBI))$/.test(token);
}

function keyboardFormFactor(value) {
  const text = fold(value);
  const formats = ["TKL", "MINI", "SF"].filter(format => hasToken(text, format));
  return formats.length === 1 ? formats[0] : null;
}

function keyboardLanguage(value) {
  const text = fold(value);
  const spanish = /\b(?:ES|ESP|ESPANOL|SPANISH)\b/.test(text);
  const english = /\b(?:US(?:[- ]EN)?|INGLES|ENGLISH)\b/.test(text);
  return spanish === english ? null : spanish ? "ES" : "US";
}

function repairDeviceModels(value, family) {
  const text = fold(value);
  if (family === "IPHONE") return unique([...text.matchAll(/(?:\bIPHONE\s+|\/\s*)(\d{1,2}S?)(?:\s+(PRO(?:\s+MAX)?|PLUS|MINI|AIR))?\b/g)].map(match => `IPHONE:${match[1]}:${match[2] || "BASE"}`));
  if (family === "MOTOROLA") return unique([
    ...[...text.matchAll(/\b([GE]\d+[A-Z]?)(?:\s+(POWER(?:\s+LITE)?|PLUS|PLAY|PRO|ULTRA|FUSION|LITE))?\b/g)].map(match => `MOTOROLA:${match[1]}:${match[2] || "BASE"}`),
    ...[...text.matchAll(/\bEDGE\s+(\d+)(?:\s+(PRO|ULTRA|FUSION|LITE|NEO|PLUS))?\b/g)].map(match => `EDGE:${match[1]}:${match[2] || "BASE"}`),
    ...[...text.matchAll(/\bONE\s+(VISION|FUSION|ACTION|MACRO)\b/g)].map(match => `ONE:${match[1]}`),
  ]);
  return [];
}

function processorModel(value) {
  const text = fold(value);
  const patterns = [
    ["RYZEN", /\bRYZEN\s+([3579])\s+(\d{4,5}[A-Z0-9]*)(?:\s+(PLUS))?\b/],
    ["CORE_ULTRA", /\bCORE\s+ULTRA\s*([3579])\s+(\d{3}[A-Z0-9]*)(?:\s+(PLUS))?\b/],
    ["CORE_I", /\bCORE\s+I([3579])[\s-]+(\d{4,5}[A-Z0-9]*)\b/],
  ];
  for (const [family, pattern] of patterns) {
    const match = text.match(pattern);
    if (match) return `${family}:${match[1]}:${match[2]}${match[3] ? ":PLUS" : ""}`;
  }
  return null;
}

function processorCooler(value) {
  const text = fold(value);
  if (/\b(?:SIN|S\s*\/|NO\s+INCLUYE)\s*(?:EL\s+)?COOLER\b/.test(text)) return "without";
  if (/\b(?:CON|C\s*\/|INCLUYE)\s*(?:EL\s+)?COOLER\b/.test(text)) return "with";
  return "unspecified";
}

export function matchIdentity(identity, scope) {
  const title = scope.title || "";
  const text = scope.text || "";
  const locks = identity.variant?.identityLocks || identity.variant || {};
  const mpn = identity.identifiers?.manufacturerPartNumber;
  const visibleExactMpn = mpn && visiblePartNumbers(text, mpn).some(code => compactPartNumber(code) === compactPartNumber(mpn));
  const missing = [], conflicts = [], evidence = [];
  if (!scope.proven) missing.push("product_scope");
  if (identity.brand && !hasToken(title, identity.brand)) missing.push("brand_in_product_title");
  // Repair parts must name the complete device in the primary title. Shared
  // G8/G9 prefixes, device codes or barcodes elsewhere cannot prove Power/Lite
  // variants, nor a different iPhone generation or Pro/Max model.
  if (identity.variant?.isRepairPart) {
    const family = /\bIPHONE\b/.test(fold(identity.name)) ? "IPHONE" : /\b(?:MOTOROLA|MOTO)\b/.test(fold(identity.name)) ? "MOTOROLA" : null;
    const wanted = repairDeviceModels(identity.name, family), observed = repairDeviceModels(title, family);
    if (wanted.length) {
      if (!observed.length) missing.push("repair_device_model_in_primary_title");
      else if (wanted.some(model => !observed.includes(model))) conflicts.push("repair_device_model:" + observed.join("/"));
      else evidence.push({ attribute: "repairDeviceModels", value: wanted.join("/") });
    }
  }
  // A polling rate or version does not establish a keyboard's physical variant.
  // Explicit primary Mini/TKL/SF and language claims outrank shared identifiers.
  const isKeyboard = /\b(?:TECLADO|KEYBOARD)\b/.test(fold(identity.name));
  if (isKeyboard) {
    for (const [attribute, read] of [["keyboard_form_factor", keyboardFormFactor], ["keyboard_language", keyboardLanguage]]) {
      const wanted = read(identity.name), observed = read(title);
      if (!wanted) continue;
      if (!observed) missing.push(attribute + ":" + wanted);
      else if (observed !== wanted) conflicts.push(attribute + ":" + observed);
      else evidence.push({ attribute, value: wanted });
    }
  }
  // A shared socket (AM5/LGA1700) or family (Core i7) does not identify a CPU.
  // Read its complete primary model, including numeric-only SKUs and suffixes.
  const isProcessor = /\b(?:PROCESADOR|MICROPROCESADOR|MICRO|CPU)\b/.test(fold(identity.name));
  const expectedProcessor = isProcessor && processorModel(identity.name);
  if (expectedProcessor) {
    const observedProcessor = processorModel(title);
    if (!observedProcessor) missing.push("processor_model_in_primary_title");
    else if (observedProcessor !== expectedProcessor) conflicts.push("processor_model:" + observedProcessor);
    else evidence.push({ attribute: "processorModel", value: expectedProcessor });
  }
  if (isProcessor) {
    const wantedCooler = processorCooler(identity.name), observedCooler = processorCooler(title);
    if (wantedCooler !== "unspecified") {
      if (observedCooler === "unspecified") missing.push("processor_cooler:" + wantedCooler);
      else if (observedCooler !== wantedCooler) conflicts.push("processor_cooler:" + observedCooler);
      else evidence.push({ attribute: "processorCooler", value: wantedCooler });
    }
  }
  for (const key of ["displayTechnologies", "qualityClaims", "networks", "modelTokens", "deviceCodes", "capacitiesAndElectricalRatings", "batteryFormats"]) {
    for (const value of locks[key] || []) {
      // An exact complete MPN also proves a literal component such as M.2;
      // do not broaden generic attribute/model matching to unrelated punctuation.
      const literalMpnAttribute = visibleExactMpn && new RegExp("(?:^|[^A-Z0-9])" + escapeRegExp(fold(value)) + "(?=$|[^A-Z0-9])").test(fold(mpn));
      if (hasToken(text, value) || literalMpnAttribute) evidence.push({ attribute: key, value });
      else missing.push(key + ":" + value);
    }
  }
  for (const value of locks.colors || []) {
    const aliases = COLOR_NAMES[fold(value)] || [value];
    const colorField = scope.blocks?.filter(block => /^COLOR(?: SELECCIONADO)?\s*[:=-]?\s*/.test(fold(block.text))).map(block => block.text).join("\n") || "";
    if (aliases.some(alias => hasToken(title, alias) || hasToken(colorField, alias))) evidence.push({ attribute: "colors", value });
    else missing.push("colors:" + value);
    const otherTitleColors = Object.entries(COLOR_NAMES).filter(([color]) => !aliases.includes(color)).filter(([color]) => hasToken(title, color)).map(([color]) => color);
    if (otherTitleColors.length && !aliases.some(alias => hasToken(title, alias))) conflicts.push("color:" + otherTitleColors[0]);
  }
  const frame = /\b(?:CON MARCO|C\s*\/\s*M(?:ARCO)?)\b/.test(fold(title)) ? "with" : /\b(?:SIN MARCO|S\s*\/\s*M(?:ARCO)?)\b/.test(fold(title)) ? "without" : "unspecified";
  if (["with", "without"].includes(locks.frame)) {
    if (frame === "unspecified") missing.push("frame:" + locks.frame);
    else if (frame !== locks.frame) conflicts.push("frame");
    else evidence.push({ attribute: "frame", value: frame });
  }
  if (identity.variant?.isRepairPart && /MODULO|PANTALLA|DISPLAY/.test(fold(identity.name)) && locks.frame === "unspecified") missing.push("source_frame_unspecified");
  for (const technology of ["INCELL", "OLED", "TFT", "AMOLED"]) {
    if (hasToken(title, technology) && (locks.displayTechnologies || []).length && !(locks.displayTechnologies || []).some(value => fold(value) === technology)) conflicts.push("displayTechnology:" + technology);
  }
  const wantedNetworks = locks.networks || [];
  for (const network of ["4G", "5G"]) if (hasToken(title, network) && wantedNetworks.length && !wantedNetworks.includes(network)) conflicts.push("network:" + network);
  if (wantedNetworks.length === 1 && wantedNetworks[0] === "4G" && hasToken(title, "5G")) conflicts.push("4G_vs_5G");
  const gtins = identity.identifiers?.barcodes?.filter(x => x.valid).map(x => x.value) || [];
  const manufacturerCodes = manufacturerCodeEvidence(text, mpn);
  for (const code of manufacturerCodes) {
    if (code.unconfirmed) missing.push("manufacturer_part_number_field_unconfirmed");
    if (code.comparable && !code.matches) {
      if (suffixRelationship(mpn, code.value)?.revisionUnconfirmed) missing.push("manufacturer_part_number_revision_unconfirmed");
      else conflicts.push("manufacturerPartNumber:" + code.value);
    }
    if (code.matches) evidence.push({ attribute: "manufacturerPartNumber", value: code.value });
  }
  // The complete model in the primary title takes precedence over a shared
  // chipset/model prefix or a GTIN repeated in the description.
  const titleCodes = mpn ? visiblePartNumbers(title, mpn) : [];
  for (const code of titleCodes) {
    const relationship = suffixRelationship(mpn, code);
    if (relationship?.differs) {
      if (relationship.revisionUnconfirmed) missing.push("manufacturer_part_number_revision_unconfirmed");
      else conflicts.push("manufacturerPartNumber:" + code);
    }
  }
  const primaryBranch = mpn && primaryCodeBranch(title, mpn);
  for (const code of primaryBranch?.conflicts || []) conflicts.push("manufacturerPartNumber:" + code);
  if (primaryBranch?.unconfirmed) missing.push("primary_manufacturer_part_number");
  const primarySuffix = mpn && (/[+]$|\s+(?:GEN\s*\d+|V\d+(?:\.\d+)?|R\d+(?:\.\d+)?|REV(?:ISION)?\.?\s*\d+(?:\.\d+)?|PLUS)$/.test(fold(mpn)));
  if (primarySuffix && !titleCodes.some(code => compactPartNumber(code) === compactPartNumber(mpn)) && !manufacturerCodes.some(code => code.matches)) missing.push("primary_manufacturer_part_number");
  // Intelaid's short IT-* models are distinct even when they share VESA sizes.
  // A complete conflicting primary code outranks identifiers elsewhere on a page.
  if (/^IT-[A-Z0-9]+$/i.test(mpn || "") && /\bINTELAID?\b/.test(fold(identity.name))) {
    const primaryModels = unique([...fold(title).matchAll(/\bIT[-_ ]+([A-Z0-9]+)(?=$|[^A-Z0-9])/g)].map(match => "IT-" + match[1]));
    const matches = primaryModels.filter(code => compactPartNumber(code) === compactPartNumber(mpn));
    const others = primaryModels.filter(code => compactPartNumber(code) !== compactPartNumber(mpn));
    if (!matches.length) conflicts.push(...others.map(code => "manufacturerPartNumber:" + code));
    else if (others.length) missing.push("multiple_primary_manufacturer_models");
  }
  const uniqueModels = (locks.modelTokens || []).filter(value => isUniqueModelToken(value) && !(isKeyboard && /^V\d+(?:\.\d+)?$/i.test(value)));
  const anchors = [...gtins, ...(locks.deviceCodes || []), ...uniqueModels];
  const matchedIdentifiers = unique(anchors.filter(value => hasToken(text, value)));
  if (visibleExactMpn && !matchedIdentifiers.includes(mpn)) matchedIdentifiers.push(mpn);
  if (!matchedIdentifiers.length) missing.push("unique_product_identifier");
  else evidence.push(...matchedIdentifiers.map(value => ({ attribute: "identifier", value })));
  if ((locks.batteryFormats || []).includes("AA") && hasToken(title, "AAA")) conflicts.push("AA_vs_AAA");
  if ((locks.batteryFormats || []).includes("AAA") && hasToken(title, "AA")) conflicts.push("AAA_vs_AA");
  return { matchExact: scope.proven && missing.length === 0 && conflicts.length === 0, status: conflicts.length ? "variant_conflict" : missing.length ? "variant_unconfirmed" : "exact_visible_attributes", missing: unique(missing), conflicts: unique(conflicts), evidence, manufacturerCodes, originalityAuthenticated: false, note: "Exactitud de atributos visibles; una afirmación Original del vendedor no autentica procedencia." };
}

export function fetchFailure(value, now = Date.now()) {
  const text = fold(typeof value === "string" ? value : JSON.stringify(value));
  if (/\b(?:401|403)\b|BOT[_ -]?BLOCKED|CAPTCHA|ACCESS DENIED|FORBIDDEN|CLOUDFLARE CHALLENGE|VERIFY (?:YOU ARE|THAT YOU)|INICI[AÁ] SESION PARA VER/.test(text)) return { status: "blocked", retryable: false, retryAfterSeconds: null };
  if (/\b429\b|RATE LIMIT|TOO MANY REQUEST/.test(text)) {
    const field = metadataEntries(value).find(entry => /(?:^|:)(?:retry[-_]?after(?:[-_]?seconds)?|retryafterseconds)$/.test(entry.key));
    const retryValue = field?.value ?? text.match(/RETRY (?:IN|AFTER)\s*:?\s*(\d+)/)?.[1];
    const seconds = retryValue !== undefined && /^\d+(?:\.\d+)?$/.test(String(retryValue)) ? Number(retryValue) : retryValue !== undefined && Number.isFinite(Date.parse(retryValue)) ? Math.max(0, Math.ceil((Date.parse(retryValue) - now) / 1000)) : 60;
    return { status: "rate_limited", retryable: true, retryAfterSeconds: seconds };
  }
  return { status: /TIMEOUT|TIMED OUT/.test(text) ? "timeout" : "fetch_error", retryable: false, retryAfterSeconds: null };
}

export function normalizeReference(identity, page, observedAt) {
  const url = canonicalUrl(page.final_url || page.url);
  const requestedEligibility = classifyCandidateUrl(page.url || page.final_url);
  const finalEligibility = classifyCandidateUrl(page.final_url || page.url);
  if ([requestedEligibility, finalEligibility].some(result => result.reason === "purchase_cart_or_mutation_action_url")) return { productId: identity.id, url, requestedUrl: requestedEligibility.url, observedAt, status: "unsafe_action_url", matchExact: false, verifiedProductPrice: false, retryable: false };
  const statusCode = Number(page.status_code ?? page.http_status ?? page.status);
  const failureText = [page.error, page.error ? page.message : null, statusCode >= 400 ? statusCode : null].filter(Boolean).map(value => typeof value === "object" ? JSON.stringify(value) : String(value)).join(" ");
  const blockText = fold([page.title, ...flattenDocument(page.text ?? page.content).slice(0, 5).map(x => x.text)].join(" ")).slice(0, 1500);
  const blocked = /CAPTCHA|ACCESS DENIED|JUST A MOMENT|ACCESS BLOCKED|FORTIGUARD|VERIFY (?:YOU ARE|THAT YOU)|CHECKING YOUR BROWSER|NO SOY UN ROBOT/.test(blockText);
  if (failureText || blocked) return { productId: identity.id, url, observedAt, ...fetchFailure({ ...page, errorDetails: page.error, error: failureText + " " + (blocked ? "CAPTCHA " + blockText : page.title || "") }, Date.parse(observedAt)), matchExact: false, verifiedProductPrice: false };
  if (!finalEligibility.eligible) return { productId: identity.id, url, observedAt, status: "redirected_to_ineligible_url", matchExact: false, verifiedProductPrice: false };
  const scope = productScope(page);
  const price = extractPrice(page, scope);
  const match = matchIdentity(identity, scope);
  const text = fold(scope.text);
  const negative = /SIN STOCK|AGOTAD[OA]|NO DISPONIBLE|OUT OF STOCK|PRODUCTO NO DISPONIBLE/.test(text);
  const positive = /EN STOCK|STOCK DISPONIBLE|\d+\s+(?:EN STOCK|DISPONIBLES)|ULTIM[OA]S?\s+(?:UNIDADES|\d)|ULTIM[OA] (?:UNIDAD|EN STOCK)/.test(text);
  const availability = negative && positive ? "conflicting" : negative ? "out_of_stock" : positive ? "available" : "unknown";
  const condition = /USADO|REACONDICIONADO|REFURBISHED|OUTLET/.test(fold(scope.title)) ? "used_refurbished_or_outlet" : /\bNUEVO\b|NEW CONDITION|NEWCONDITION/.test(text) ? "new" : "unspecified";
  const localOutlet = /OUTLET/.test(fold(identity.category || "") + " " + fold(identity.sourceCategory || "") + " " + fold(identity.name));
  if (localOutlet && condition !== "used_refurbished_or_outlet") { match.matchExact = false; match.status = "variant_unconfirmed"; match.missing.push("outlet_condition"); }
  if (/\bVENCID[OA]\b/.test(fold(identity.name))) { match.matchExact = false; match.status = "source_expired_not_comparable"; match.conflicts.push("source_expired"); }
  const paymentLines = scope.blocks.filter(x => /TRANSFERENCIA|EFECTIVO|CUOTA|DEBITO|CREDITO|MERCADO PAGO/.test(fold(x.text))).slice(0, 8).map(x => x.text.slice(0, 200));
  const shippingLines = scope.blocks.filter(x => /ENVIO|FLETE|RETIR|CODIGO POSTAL/.test(fold(x.text))).slice(0, 6).map(x => x.text.slice(0, 200));
  const status = !scope.proven ? "product_scope_missing" : !match.matchExact ? match.status : price.status !== "price_observed" ? price.status : availability === "out_of_stock" ? "out_of_stock" : availability === "conflicting" ? "stock_conflict" : availability !== "available" ? "stock_unconfirmed" : "verified_product_price";
  return { productId: identity.id, url, title: scope.title, observedAt, status, matchExact: match.matchExact, matchEvidence: match, priceARS: price.priceARS, priceCandidateARS: price.priceCandidateARS, priceEvidence: price, payment: { evidence: paymentLines, fullyConfirmed: false }, shipping: { evidence: shippingLines, amountARS: null, destination: null, confirmed: false }, condition: { state: condition, availability }, verifiedProductPrice: status === "verified_product_price", verifiedDeliveredPrice: false, sourceEvidence: { scopeProven: scope.proven, blockCount: scope.blocks.length, relatedBoundaryDetected: Boolean(scope.boundaryDetected) }, retryable: false };
}

function readJson(path) { return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, "")); }
function jsonFiles(directory) { return existsSync(directory) ? readdirSync(directory).filter(x => x.endsWith(".json")).sort().map(x => resolve(directory, x)) : []; }
function atomicJson(path, value) { mkdirSync(dirname(path), { recursive: true }); const temp = path + ".tmp"; writeFileSync(temp, JSON.stringify(value) + "\n", "utf8"); renameSync(temp, path); }

export function buildResearchState({ identities, searches, fetchBatches, now = Date.now() }) {
  const searchMap = new Map();
  for (const batch of searches) for (const record of batch.records || []) {
    const old = searchMap.get(record.id);
    if (!old || String(record.researchedAt || "") >= String(old.researchedAt || "")) searchMap.set(record.id, record);
  }
  const fetched = new Map();
  for (const batch of fetchBatches) {
    // Additional HTML reads are retained for manual review. They neither replace
    // structured observations nor resolve the normal JSON fetch queue by themselves.
    if (batch.evidenceOnly === true) continue;
    const response = unwrapToolResponse(batch.response ?? batch.result ?? batch);
    const pages = response.results || [];
    const errors = response.errors || [];
    for (const url of batch.urls || pages.map(x => x.url)) {
      const key = canonicalUrl(url);
      if (!key) continue;
      const page = pages.find(x => canonicalUrl(x.url) === key || canonicalUrl(x.final_url) === key);
      const error = errors.find(x => canonicalUrl(x.url) === key) || (!page ? errors[0] : null);
      const observedAt = batch.observedAt || batch.completedAt || batch.generatedAt || new Date(0).toISOString();
      // Keep the whole error envelope: status and Retry-After can be siblings of error.
      const value = { page: page || { ...(error && typeof error === "object" ? error : {}), url: key, error: error?.error || error?.message || error || "missing_url_result" }, observedAt, attempts: batch.attempts || 1 };
      const previous = fetched.get(key);
      if (!previous || observedAt >= previous.observedAt) fetched.set(key, value);
    }
  }
  const products = [], queue = new Map();
  for (const identity of identities.products || identities) {
    const search = searchMap.get(identity.id);
    const selected = search ? selectCandidates(search) : { accepted: [], rejected: [] };
    const references = [];
    for (const candidate of selected.accepted) {
      const observation = fetched.get(candidate.url);
      if (!observation) {
        if (!queue.has(candidate.url)) queue.set(candidate.url, { url: candidate.url, productIds: [], attempt: 1 });
        queue.get(candidate.url).productIds.push(identity.id);
        references.push({ productId: identity.id, url: candidate.url, status: "fetch_pending", matchExact: false, verifiedProductPrice: false });
        continue;
      }
      const reference = normalizeReference(identity, observation.page, observation.observedAt);
      reference.attempts = observation.attempts;
      references.push(reference);
      if (reference.retryable && observation.attempts <= MAX_RATE_RETRIES) {
        const retryAt = Date.parse(observation.observedAt) + (reference.retryAfterSeconds ?? 60) * 1000;
        if (now >= retryAt) {
          if (!queue.has(candidate.url)) queue.set(candidate.url, { url: candidate.url, productIds: [], attempt: observation.attempts + 1 });
          queue.get(candidate.url).productIds.push(identity.id);
        }
      }
    }
    const status = !search ? "not_searched" : search.status === "error" && !selected.accepted.length ? "search_error" : !((search.results || []).length || (search.storeResults || []).length) ? "no_indexed_results" : !selected.accepted.length ? "no_eligible_retail_candidate" : references.some(x => x.verifiedProductPrice) ? "has_verified_product_price" : references.some(x => x.status === "fetch_pending") ? "fetch_pending" : "researched_unverified";
    products.push({ id: identity.id, name: identity.name, searchStatus: search?.status || "pending", searchedAt: search?.researchedAt || null, status, references, rejected: selected.rejected });
  }
  const references = products.flatMap(x => x.references);
  const summary = { catalogProducts: products.length, searchAttemptedProducts: products.filter(x => x.searchStatus !== "pending").length, searchSuccessfulProducts: products.filter(x => ["indexed", "noIndexedResults"].includes(x.searchStatus)).length, searchErrorProducts: products.filter(x => x.searchStatus === "error").length, notSearchedProducts: products.filter(x => x.searchStatus === "pending").length, productsWithRetailCandidates: products.filter(x => x.references.length).length, selectedUniqueUrls: unique(references.map(x => x.url)).length, fetchedUniqueUrls: fetched.size, productsWithFetchObservation: products.filter(x => x.references.some(r => r.status !== "fetch_pending")).length, verifiedProductPriceReferences: references.filter(x => x.verifiedProductPrice).length, productsWithVerifiedProductPrice: products.filter(x => x.references.some(r => r.verifiedProductPrice)).length, verifiedDeliveredPriceReferences: 0, blockedReferences: references.filter(x => x.status === "blocked").length, pendingUniqueUrls: queue.size, referenceStatusCounts: Object.fromEntries(unique(references.map(x => x.status)).map(status => [status, references.filter(x => x.status === status).length])) };
  return { report: { version: 1, generatedAt: new Date(now).toISOString(), scope: "Public page candidates. Index prices are never verified offers. Shipping and final delivered total remain unconfirmed.", summary, products }, queue: [...queue.values()] };
}

export function loadResearchState(baseDirectory, options = {}) {
  const identities = readJson(resolve(baseDirectory, "product-identities.json"));
  const searches = jsonFiles(resolve(baseDirectory, "search-batches")).map(readJson);
  const fetchBatches = jsonFiles(resolve(baseDirectory, "fetch-batches")).map(readJson);
  return buildResearchState({ identities, searches, fetchBatches, ...options });
}

export function planFetches(state, limit = 40) {
  const eligibleQueue = state.queue.filter(item => classifyCandidateUrl(item.url).eligible);
  const queue = eligibleQueue.slice(0, Math.max(0, Math.min(Number(limit) || 40, 200)));
  const jobs = [];
  for (const attemptGroup of unique(queue.map(x => x.attempt)).sort()) {
   const attemptQueue = queue.filter(x => x.attempt === attemptGroup);
   for (let index = 0; index < attemptQueue.length; index += FETCH_BATCH_SIZE) {
    const items = attemptQueue.slice(index, index + FETCH_BATCH_SIZE);
    const urls = items.map(x => x.url);
    const attempt = Math.max(...items.map(x => x.attempt));
    const id = createHash("sha256").update(JSON.stringify(urls)).digest("hex").slice(0, 16) + "-attempt-" + attempt;
    jobs.push({ batchId: id, urls, attempts: attempt, productsByUrl: Object.fromEntries(items.map(x => [x.url, x.productIds])), fetchArgs: { urls, format: "json", ttl: 0, per_url_timeout_ms: 20000, links: false, image_links: false, iframe_links: false, page_metadata: true, purpose: "Leer la ficha pública de cada URL. Conservar encabezado de producto, precio final ARS, forma de pago, stock y variante/modelo; separar artículos relacionados. No hacer compras, iniciar sesión ni eludir bloqueos." } });
   }
  }
  return { version: 1, maxConcurrency: FETCH_CONCURRENCY, allowedTool: "tinyfish_fetch_content", paidAutomationAllowed: false, queueRemaining: eligibleQueue.length, jobs, summary: state.report.summary };
}

/**
 * Injectable tool runner: fetchContent must be the free TinyFish fetch_content tool.
 * No HTTP API key, browser automation, LLM API or index-price fallback is used here.
 * A host can inject the connected tool and a private checkpoint writer.
 */
export async function executeFetchPlan(plan, { fetchContent, saveBatch, delay = milliseconds => new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds)), onProgress = () => {}, now = () => new Date().toISOString() }) {
  if (typeof fetchContent !== "function" || typeof saveBatch !== "function") throw new TypeError("Se requieren fetch_content gratuito y un escritor de checkpoints privados.");
  const jobs = [...(plan.jobs || [])];
  if (jobs.some(job => (job.urls || []).some(url => !classifyCandidateUrl(url).eligible))) throw new Error("El plan contiene una URL de acción o una ficha no elegible; regenerar el plan antes de Fetch.");
  let cursor = 0;
  const stats = { toolCalls: 0, savedBatches: 0, requestedUrls: 0, rateRetries: 0 };
  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      let urls = [...job.urls], attempt = job.attempts || 1;
      if (!urls.length || urls.length > FETCH_BATCH_SIZE) throw new RangeError("Cada llamada admite de 1 a 10 URLs.");
      while (urls.length && attempt <= 1 + MAX_RATE_RETRIES) {
        const fetchArgs = { ...job.fetchArgs, urls, format: "json", ttl: 0, links: false, image_links: false, iframe_links: false, page_metadata: true };
        let response;
        try { response = await fetchContent(fetchArgs); }
        catch (error) { response = { results: [], errors: urls.map(url => ({ url, error: String(error?.message || error) })) }; }
        stats.toolCalls++; stats.requestedUrls += urls.length;
        const batchId = createHash("sha256").update(JSON.stringify(urls)).digest("hex").slice(0, 16) + "-attempt-" + attempt;
        const batch = { version: 1, batchId, observedAt: now(), urls: [...urls], attempts: attempt, response };
        await saveBatch(batch);
        stats.savedBatches++;
        await onProgress({ batchId, urls: urls.length, attempts: attempt, stats: { ...stats } });
        const unpacked = unwrapToolResponse(response);
        const errors = unpacked.errors || [];
        const rateErrors = urls.map(url => {
          const page = (unpacked.results || []).find(result => canonicalUrl(result.url) === canonicalUrl(url));
          if (page && !page.error && !(Number(page.status_code ?? page.http_status ?? page.status) >= 400)) return null;
          const error = page || errors.find(result => canonicalUrl(result.url) === canonicalUrl(url)) || errors[0];
          const failure = fetchFailure(error || "missing_url_result");
          return failure.status === "rate_limited" ? { url, waitSeconds: failure.retryAfterSeconds } : null;
        }).filter(Boolean);
        if (!rateErrors.length || attempt >= 1 + MAX_RATE_RETRIES) break;
        const wait = Math.max(...rateErrors.map(x => x.waitSeconds ?? 60)) * 1000;
        // Respect Retry-After with bounded wait slices so hosts can surface progress.
        for (let remaining = wait; remaining > 0; remaining -= 60000) await delay(Math.min(60000, remaining));
        urls = rateErrors.map(x => x.url);
        attempt++; stats.rateRetries++;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(FETCH_CONCURRENCY, jobs.length) }, worker));
  return stats;
}

export function renderDashboard(report) {
  const data = { generatedAt: report.generatedAt, summary: report.summary, products: report.products.map(product => ({ id: product.id, name: product.name || product.id, searchStatus: product.searchStatus, status: product.status, references: product.references.map(reference => ({ url: reference.url, title: reference.title || "", status: reference.status, priceARS: reference.priceARS ?? null, verifiedProductPrice: Boolean(reference.verifiedProductPrice) })) })) };
  const embedded = JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
  return `<!doctype html><html lang="es-AR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Investigación de precios · Scalaris</title>
<style>*{box-sizing:border-box}body{margin:0;background:#f3f7fb;color:#102b43;font:15px/1.5 system-ui,sans-serif}main{max-width:1400px;margin:auto;padding:32px 24px}h1{margin:0;font-size:32px}p{color:#496479}.stamp{font-size:12px}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:26px 0}.metric{background:white;border:1px solid #d7e3ed;border-radius:12px;padding:20px}.metric strong{display:block;font-size:30px;color:#145cdb}.metric span{font-size:12px}.controls{display:flex;gap:16px;margin:22px 0;flex-wrap:wrap}label{font-size:12px}input,select,button{font:inherit;border:1px solid #b8ccdc;border-radius:6px;padding:9px;background:#fff;color:#102b43}input{display:block;min-width:300px}select{display:block;min-width:220px}button{cursor:pointer}button:disabled{opacity:.5;cursor:default}a{color:#145cdb}.table-wrap{overflow:auto;border:1px solid #d7e3ed;border-radius:10px;background:#fff}table{border-collapse:collapse;width:100%;font-size:12px}th,td{text-align:left;padding:13px;border-bottom:1px solid #e1eaf2;vertical-align:top}th{background:#eaf1f8}td:first-child{min-width:260px;max-width:390px}td strong{display:block}small{display:block;color:#496479}td a{display:block;margin-bottom:6px;overflow-wrap:anywhere}.pagination{display:flex;align-items:center;gap:16px;margin:20px 0}.note{background:#eaf1f8;padding:18px;border-radius:8px;font-size:13px}details{margin-top:18px}pre{white-space:pre-wrap;font-size:12px}@media(max-width:700px){main{padding:22px 14px}.metrics{grid-template-columns:1fr 1fr}.metric{padding:14px}.metric strong{font-size:25px}h1{font-size:27px}.controls>label{width:100%}input,select{width:100%;min-width:0}}</style>
<main><h1>Investigación de precios</h1><p>Búsqueda, lectura de fichas y verificación técnica se cuentan por separado.</p><p class="stamp" id="stamp"></p><div class="metrics" id="metrics"></div><div class="note">Este tablero es privado. Las coincidencias incompletas, los bloqueos y los precios ambiguos siguen pendientes. Un precio de producto verificado no acredita el envío al domicilio ni todas las condiciones de pago. Ningún resultado del buscador se convierte por sí solo en precio confirmado.</div><div class="controls"><label>Buscar producto o ID<input id="query" type="search" placeholder="Por ejemplo: nb-119109 o Logitech"></label><label>Estado<select id="status"><option value="">Todos los estados</option></select></label></div><p id="count" role="status"></p><div class="table-wrap"><table><thead><tr><th>Producto</th><th>Búsqueda</th><th>Fichas leídas</th><th>Precios verificados</th><th>Estado y referencias</th></tr></thead><tbody id="rows"></tbody></table></div><div class="pagination"><button id="previous">← Anterior</button><span id="page"></span><button id="next">Siguiente →</button></div><details><summary>Conteos técnicos de esta actualización</summary><pre id="summary"></pre></details></main>
<script>const data=${embedded};
const $=id=>document.getElementById(id), fmt=n=>Number(n||0).toLocaleString('es-AR');
const labels={not_searched:'Sin investigar',search_error:'Error de búsqueda',no_indexed_results:'Sin resultados indexados',no_eligible_retail_candidate:'Sin ficha minorista elegible',fetch_pending:'Lectura pendiente',researched_unverified:'Investigado, sin precio verificado',has_verified_product_price:'Tiene precio de producto verificado'};
$('stamp').textContent='Actualización: '+new Date(data.generatedAt).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'});
for(const [value,label]of[[data.summary.catalogProducts,'Productos del catálogo'],[data.summary.searchSuccessfulProducts,'Productos con búsqueda completada'],[data.summary.productsWithFetchObservation,'Productos con alguna ficha leída'],[data.summary.productsWithVerifiedProductPrice,'Productos con precio verificado']]){const div=document.createElement('div');div.className='metric';const strong=document.createElement('strong');strong.textContent=fmt(value);const span=document.createElement('span');span.textContent=label;div.append(strong,span);$('metrics').append(div)}
for(const status of [...new Set(data.products.map(p=>p.status))].sort()){const option=document.createElement('option');option.value=status;option.textContent=labels[status]||status;$('status').append(option)}
$('summary').textContent=JSON.stringify(data.summary,null,2);let page=1;const size=50;const fold=t=>String(t).normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase();
function render(){const query=fold($('query').value);const list=data.products.filter(p=>(!$('status').value||p.status===$('status').value)&&(!query||fold(p.id+' '+p.name).includes(query)));const pages=Math.max(1,Math.ceil(list.length/size));page=Math.min(page,pages);$('rows').replaceChildren();for(const p of list.slice((page-1)*size,page*size)){const tr=document.createElement('tr');const first=document.createElement('td');const name=document.createElement('strong');name.textContent=p.name;const id=document.createElement('small');id.textContent=p.id;first.append(name,id);tr.append(first);for(const value of[p.searchStatus,fmt(p.references.filter(r=>r.status!=='fetch_pending').length)+' / '+fmt(p.references.length),fmt(p.references.filter(r=>r.verifiedProductPrice).length)]){const td=document.createElement('td');td.textContent=value;tr.append(td)}const final=document.createElement('td');const state=document.createElement('strong');state.textContent=labels[p.status]||p.status;final.append(state);for(const r of p.references){const a=document.createElement('a');a.href=r.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=new URL(r.url).hostname+' · '+r.status+(r.verifiedProductPrice?' · '+new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(r.priceARS):'');final.append(a)}tr.append(final);$('rows').append(tr)}$('count').textContent=fmt(list.length)+' productos coinciden con los filtros';$('page').textContent='Página '+page+' de '+pages;$('previous').disabled=page===1;$('next').disabled=page===pages}
$('query').addEventListener('input',()=>{page=1;render()});$('status').addEventListener('change',()=>{page=1;render()});$('previous').addEventListener('click',()=>{page--;render()});$('next').addEventListener('click',()=>{page++;render()});render();</script></html>\n`;
}

export function runCli(args) {
  const command = args[0] || "report";
  const get = (name, fallback) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : fallback; };
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const base = resolve(get("--directory", resolve(root, ".private/market-research")));
  if (base === resolve(root, "public") || base.startsWith(resolve(root, "public") + "/") || base.startsWith(resolve(root, "public") + "\\")) throw new Error("La investigación contiene datos privados y no puede escribirse bajo public/.");
  const state = loadResearchState(base);
  if (command === "plan") console.log(JSON.stringify(planFetches(state, Number(get("--limit", "40")))));
  else if (["report", "dashboard"].includes(command)) {
    atomicJson(resolve(base, "market-references.json"), state.report);
    atomicJson(resolve(base, "fetch-checkpoint.json"), { version: 1, generatedAt: state.report.generatedAt, summary: state.report.summary, pending: state.queue });
    if (command === "dashboard") { const path = resolve(base, "market-evidence-dashboard.html"); writeFileSync(path, renderDashboard(state.report), "utf8"); console.log(JSON.stringify({ dashboardPath: path, summary: state.report.summary })); }
    else console.log(JSON.stringify(state.report.summary));
  }
  else throw new Error("Uso: node scripts/market-references.mjs plan [--limit 40] | report | dashboard [--directory ruta_privada]");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { runCli(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
