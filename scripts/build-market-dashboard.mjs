import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPricingPolicy, normalizeMarketEvidence } from "./build-store-prices.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const positive = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;
const safeLink = (value) => {
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
};

function compactReference(reference, origin, strict = false) {
  const url = safeLink(reference.url);
  if (!url) return null;
  const price = positive(reference.priceARS) ? reference.priceARS : null;
  return {
    url,
    title: reference.title || reference.model || url,
    priceARS: origin === "search-index" ? null : price,
    status: reference.status || (origin === "search-index" ? "index_candidate_only" : "unverified_candidate"),
    origin,
    strict,
    observedAt: reference.latestLiveFetch?.at || reference.observedAt || null,
    payment: typeof reference.payment === "string" ? reference.payment : reference.payment?.basis || reference.payment?.method || null,
    condition: typeof reference.condition === "string" ? reference.condition : reference.condition?.availability || reference.condition?.state || reference.condition?.item || null,
    matchNote: typeof reference.matchEvidence === "string" ? reference.matchEvidence : reference.matchEvidence?.note || null,
    matchExact: reference.matchExact === true,
    productPriceReviewed: reference.verifiedProductPrice === true,
  };
}

/** Build a complete private view; discovery and partial price checks never become strict evidence. */
export function buildMarketDashboardData({ catalog, proposal, marketReferences = {}, searchBatches = [], rawResearch = [], normalizedSeeds = [], policy, generatedAt = new Date().toISOString() }) {
  if (!Array.isArray(catalog?.products) || !Array.isArray(proposal?.products)) throw new TypeError("Se necesitan catálogo y propuesta privados.");
  if (!Number.isFinite(Date.parse(generatedAt))) throw new TypeError("Fecha de generación inválida.");
  const evaluationPolicy = { ...(policy || createPricingPolicy(generatedAt)), generatedAt };
  const quotes = new Map(proposal.products.map((product) => [product.id, product]));
  if (quotes.size !== proposal.products.length) throw new Error("La propuesta tiene IDs duplicados.");
  const market = new Map((marketReferences.products || []).map((product) => [product.id, product]));
  const batchRecords = new Map();
  const batches = [];
  for (const batch of searchBatches) {
    const records = batch.records || [];
    batches.push({ number: batch.batchNumber || null, generatedAt: batch.generatedAt || null, records: records.length, requests: batch.stats?.requests || 0, systemicStop: batch.systemicStop === true });
    for (const record of records) {
      const previous = batchRecords.get(record.id);
      if (!previous || Date.parse(record.researchedAt || batch.generatedAt) >= Date.parse(previous.researchedAt || "1970-01-01")) batchRecords.set(record.id, record);
    }
  }
  const rawById = new Map();
  for (const document of rawResearch) for (const reference of document.references || []) {
    const id = reference.id || reference.productId;
    if (!rawById.has(id)) rawById.set(id, []);
    rawById.get(id).push(reference);
  }
  const normalizedById = new Map();
  for (const reference of normalizedSeeds) {
    const id = reference.id || reference.productId;
    if (!normalizedById.has(id)) normalizedById.set(id, []);
    normalizedById.get(id).push(reference);
  }
  const seen = new Set();
  const products = catalog.products.map((product) => {
    if (seen.has(product.id)) throw new Error(`ID de catálogo duplicado: ${product.id}`);
    seen.add(product.id);
    const quote = quotes.get(product.id);
    if (!quote) throw new Error(`Falta propuesta para ${product.id}`);
    const research = market.get(product.id);
    const batch = batchRecords.get(product.id);
    let searchStatus = research?.searchStatus || "pending";
    let searchedAt = research?.searchedAt || null;
    const batchAt = batch?.researchedAt || null;
    if (batch && (!searchedAt || (Date.parse(batchAt) || 0) >= (Date.parse(searchedAt) || 0))) {
      const hasResults = (batch.results || []).length + (batch.mlResults || []).length + (batch.storeResults || []).length > 0;
      searchStatus = (batch.error && !hasResults) || /error|failed/.test(String(batch.status)) ? "error" : "indexed";
      searchedAt = batchAt;
    }
    const references = [];
    const push = (reference) => { if (reference) references.push(reference); };
    for (const ref of research?.references || []) push(compactReference(ref, "page-batch"));
    for (const ref of rawById.get(product.id) || []) push(compactReference(ref, "manual-sample"));
    const discovered = new Set(references.map((ref) => ref.url));
    for (const result of [...(batch?.results || []), ...(batch?.mlResults || []), ...(batch?.storeResults || [])]) {
      const url = safeLink(result.url);
      if (!url || discovered.has(url)) continue;
      discovered.add(url);
      push(compactReference({ ...result, url, priceARS: null, observedAt: searchedAt }, "search-index"));
    }
    const strictUrls = new Set();
    for (const ref of normalizedById.get(product.id) || []) {
      if (!normalizeMarketEvidence(ref, product.id, evaluationPolicy) || strictUrls.has(ref.url)) continue;
      strictUrls.add(ref.url);
      push(compactReference(ref, "normalized-confirmed", true));
    }
    const hasObservedCandidate = references.some((ref) => !ref.strict && ref.origin !== "search-index" && !["fetch_pending", "index_candidate_only"].includes(ref.status));
    const researchState = strictUrls.size ? "strict" : hasObservedCandidate ? "validation" : searchStatus === "indexed" ? "indexed" : searchStatus === "error" ? "error" : "pending";
    return {
      id: product.id,
      name: product.name,
      supplier: product.supplier,
      category: product.category,
      costARS: product.cost?.currency === "ARS" && positive(product.cost.gross) ? product.cost.gross : null,
      proposedPrice: positive(quote.proposedPrice) ? quote.proposedPrice : null,
      orderable: quote.orderable === true,
      marginRate: quote.assumptions?.targetMarginRate ?? null,
      profitContribution: quote.profitContribution ?? null,
      priceBasis: quote.priceBasis,
      priceValidUntil: quote.priceValidUntil,
      blockReasons: quote.blockReasons || [],
      searchStatus,
      searchedAt,
      researchState,
      strictReferenceCount: strictUrls.size,
      references,
    };
  });
  if (products.length !== quotes.size) throw new Error("La propuesta contiene IDs que no están en el catálogo.");
  return {
    generatedAt,
    sourceDates: { catalog: catalog.importedAt || null, proposal: proposal.generatedAt || null, market: marketReferences.generatedAt || null },
    fetchProgress: {
      selectedUrls: marketReferences.summary?.selectedUniqueUrls || 0,
      fetchedUrls: marketReferences.summary?.fetchedUniqueUrls || 0,
      pendingUrls: marketReferences.summary?.pendingUniqueUrls || 0,
    },
    summary: {
      total: products.length,
      active: products.filter((product) => product.orderable).length,
      blocked: products.filter((product) => !product.orderable).length,
      searchIndexed: products.filter((product) => product.searchStatus === "indexed").length,
      searchErrors: products.filter((product) => product.searchStatus === "error").length,
      searchPending: products.filter((product) => product.searchStatus === "pending").length,
      strictProducts: products.filter((product) => product.strictReferenceCount > 0).length,
      candidateProducts: products.filter((product) => product.references.some((ref) => !ref.strict)).length,
      pendingValidationProducts: products.filter((product) => product.researchState === "validation").length,
      pipelineProductPriceReviewed: products.filter((product) => product.references.some((ref) => ref.productPriceReviewed)).length,
    },
    batches,
    products,
  };
}

function dashboardApp(data) {
  const element = (id) => document.getElementById(id);
  const node = (tag, text, className) => { const result = document.createElement(tag); if (text !== undefined) result.textContent = text; if (className) result.className = className; return result; };
  const money = (value) => value === null ? "—" : new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(value);
  const count = (value) => Number(value).toLocaleString("es-AR");
  const date = (value) => value ? new Date(value).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short", timeStyle: "short" }) : "Sin fecha";
  const percent = (value) => value === null ? "—" : `${(value * 100).toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`;
  const fold = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const names = { nb: "NB", distriland: "DistriLand", tecnoprices: "TecnoPrices" };
  const researchNames = { pending: "Sin búsqueda por lote", indexed: "Indexado · sin validar", validation: "Fuentes por validar", strict: "Referencia estricta", error: "Error de búsqueda" };
  const origins = { "page-batch": "Lectura de página por lote", "manual-sample": "Muestra observada", "search-index": "Resultado de búsqueda", "normalized-confirmed": "Evidencia estricta aceptada" };
  const reasons = { "cost-not-final-ars": "Sin costo final en pesos", "invalid-final-cost": "Costo inválido", "final-tax-treatment-unconfirmed": "Costo final sin confirmar", "missing-from-latest-nb-list": "Ausente de la última lista NB", "cost-requires-confirmation": "Costo pendiente de confirmación", "expired-product": "Producto vencido", "supplier-stock-zero-in-source": "Sin stock en la lista", "supplier-cost-stale": "Costo desactualizado", "supplier-cost-date-unknown": "Fecha del costo desconocida", "supplier-cost-date-invalid": "Fecha del costo inválida" };
  let page = 1;
  let selectedSize = 50;
  let filtered = data.products;
  for (const [id, value] of Object.entries({ total: data.summary.total, active: data.summary.active, blocked: data.summary.blocked, indexed: data.summary.searchIndexed, errors: data.summary.searchErrors, pending: data.summary.searchPending, strict: data.summary.strictProducts })) element(`count-${id}`).textContent = count(value);
  const attempts = data.summary.searchIndexed + data.summary.searchErrors;
  element("search-progress").value = attempts;
  element("search-progress").max = data.summary.total;
  element("progress-label").textContent = `${count(attempts)} de ${count(data.summary.total)} con intento de búsqueda (${(attempts / Math.max(1, data.summary.total) * 100).toLocaleString("es-AR", { maximumFractionDigits: 2 })}%). Indexar no equivale a validar un precio.`;
  element("built-at").textContent = date(data.generatedAt);
  element("pipeline-count").textContent = `${count(data.summary.pipelineProductPriceReviewed)} productos con importe de ficha revisado por el proceso; ${count(data.summary.strictProducts)} con referencia estricta aceptada para comparar precios.`;
  element("fetch-label").textContent = data.fetchProgress.selectedUrls
    ? `Fuentes del grupo ya seleccionado: ${count(data.fetchProgress.fetchedUrls)} de ${count(data.fetchProgress.selectedUrls)} URLs con intento de lectura; ${count(data.fetchProgress.pendingUrls)} pendientes dentro de ese grupo. Esto no cubre las búsquedas todavía pendientes del catálogo.`
    : "Todavía no se guardó un grupo de fuentes para lectura.";

  function showSources(product) {
    element("source-title").textContent = product.name;
    element("source-subtitle").textContent = `${names[product.supplier]} · ${product.id} · ${product.category}`;
    const body = element("source-body");
    body.replaceChildren();
    body.append(node("p", "Los importes observados son referencias y candidatos. Solo una evidencia marcada como estricta cumple los controles automáticos de coincidencia, pago, disponibilidad y fecha. Un descuento anunciado no se aplica por cuenta propia.", "source-explanation"));
    for (const reference of product.references) {
      const card = node("article", undefined, "source-card");
      const label = node("div", origins[reference.origin], reference.strict ? "tag strict" : "tag candidate");
      const heading = node("h3", reference.title);
      const link = node("a", "Abrir fuente ↗");
      link.href = reference.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      const priceText = reference.priceARS === null ? "Sin importe confirmado en esta observación" : `${money(reference.priceARS)} · importe observado${reference.strict ? "" : ", pendiente de validar como equivalente"}`;
      card.append(label, heading, node("p", priceText, "source-price"), node("p", `Estado registrado: ${reference.status}`, "source-meta"), node("p", `Observado: ${date(reference.observedAt)}`, "source-meta"));
      if (reference.payment) card.append(node("p", `Pago: ${reference.payment}`, "source-meta"));
      if (reference.condition) card.append(node("p", `Disponibilidad / condición: ${reference.condition}`, "source-meta"));
      if (reference.matchNote) card.append(node("p", reference.matchNote, "source-meta"));
      if (reference.productPriceReviewed && !reference.strict) card.append(node("p", "La ficha tiene una revisión parcial de importe y atributos. Esto todavía no equivale a una referencia estricta de transferencia.", "partial-note"));
      card.append(link);
      body.append(card);
    }
    if (!product.references.length) body.append(node("p", "Todavía no se incorporaron fuentes para este producto.", "source-meta"));
    element("sources-dialog").showModal();
  }

  function render() {
    const query = fold(element("search").value).trim().split(/\s+/).filter(Boolean);
    const supplier = element("supplier").value;
    const priceState = element("price-filter").value;
    const research = element("research-filter").value;
    filtered = data.products.filter((product) => {
      if (supplier && product.supplier !== supplier) return false;
      if (priceState === "active" && !product.orderable || priceState === "blocked" && product.orderable) return false;
      if (research === "pending" && product.searchStatus !== "pending" || research === "indexed" && product.searchStatus !== "indexed" || research === "error" && product.searchStatus !== "error" || research === "validation" && product.researchState !== "validation" || research === "strict" && product.strictReferenceCount === 0) return false;
      const text = fold(`${product.id} ${product.name} ${product.category} ${product.supplier}`);
      return query.every((word) => text.includes(word));
    });
    const totalPages = Math.max(1, Math.ceil(filtered.length / selectedSize));
    page = Math.max(1, Math.min(page, totalPages));
    const body = element("product-rows");
    body.replaceChildren();
    for (const product of filtered.slice((page - 1) * selectedSize, page * selectedSize)) {
      const row = node("tr");
      const name = node("td", undefined, "name-cell");
      name.append(node("strong", product.name), node("small", `${product.id} · ${product.category}`));
      const supplierCell = node("td", names[product.supplier] || product.supplier);
      const cost = node("td", product.costARS === null ? "Sin costo ARS" : money(product.costARS), "number");
      const price = node("td", undefined, "number");
      price.append(node("strong", money(product.proposedPrice)), node("small", product.orderable ? "Activo · transferencia" : "Bloqueado para pedido", product.orderable ? "active-text" : "blocked-text"));
      if (!product.orderable) price.title = product.blockReasons.map((reason) => reasons[reason] || reason).join("; ");
      const margin = node("td", percent(product.marginRate), "number");
      const status = node("td");
      status.append(node("span", researchNames[product.researchState], `tag ${product.researchState}`));
      if (product.searchStatus === "pending" && product.researchState === "validation") status.append(node("small", "Muestra adicional; búsqueda por lote pendiente"));
      const sourceCell = node("td");
      const button = node("button", product.references.length ? `Ver ${count(product.references.length)} fuentes` : "Sin fuentes", "sources-button");
      button.type = "button";
      button.disabled = !product.references.length;
      button.addEventListener("click", () => showSources(product));
      sourceCell.append(button);
      row.append(name, supplierCell, cost, price, margin, status, sourceCell);
      body.append(row);
    }
    if (!filtered.length) { const row = node("tr"); const cell = node("td", "No hay productos con estos filtros.", "empty"); cell.colSpan = 7; row.append(cell); body.append(row); }
    element("result-count").textContent = `${count(filtered.length)} productos · ${filtered.length ? count((page - 1) * selectedSize + 1) : 0} a ${count(Math.min(page * selectedSize, filtered.length))}`;
    element("page-number").textContent = `Página ${count(page)} de ${count(totalPages)}`;
    element("previous").disabled = page === 1;
    element("next").disabled = page === totalPages;
  }

  for (const id of ["search", "supplier", "price-filter", "research-filter"]) element(id).addEventListener(id === "search" ? "input" : "change", () => { page = 1; render(); });
  element("page-size").addEventListener("change", () => { selectedSize = Number(element("page-size").value); page = 1; render(); });
  element("previous").addEventListener("click", () => { page--; render(); });
  element("next").addEventListener("click", () => { page++; render(); });
  element("clear-filters").addEventListener("click", () => { for (const id of ["search", "supplier", "price-filter", "research-filter"]) element(id).value = ""; page = 1; render(); });
  element("close-sources").addEventListener("click", () => element("sources-dialog").close());
  const batchList = element("batch-list");
  for (const batch of data.batches) batchList.append(node("li", `Lote ${batch.number || "—"} · ${count(batch.records)} registros · ${date(batch.generatedAt)}${batch.systemicStop ? " · detenido por un límite o error del servicio" : ""}`));
  if (!data.batches.length) batchList.append(node("li", "Todavía no hay lotes de búsqueda guardados."));
  render();
}

export function renderMarketDashboard(data) {
  const encoded = JSON.stringify(data).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  return `<!DOCTYPE html>
<html lang="es-AR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'"><title>Scalaris · Control privado de precios</title>
<style>
:root{color-scheme:light;--navy:#0b1f33;--blue:#145cdb;--sky:#53c9f4;--muted:#496479;--line:#d7e3ed;--pale:#eef5fa}*{box-sizing:border-box}body{margin:0;background:#f4f7fa;color:var(--navy);font:14px/1.5 "Segoe UI",Arial,sans-serif}button,input,select{font:inherit}button,a,input,select{outline-offset:3px}button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #53c9f4}.top{background:var(--navy);color:#fff;padding:22px 4%;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{font-size:25px;letter-spacing:-1px;font-weight:750}.brand span{color:var(--sky)}.private{border:1px solid #526b83;border-radius:24px;font-size:11px;padding:7px 13px;color:#d6e8f9}.wrap{max-width:1600px;padding:32px 4%;margin:0 auto}.eyebrow{font-size:11px;font-weight:750;letter-spacing:.14em;text-transform:uppercase;color:var(--blue)}h1{font-size:clamp(29px,4vw,42px);letter-spacing:-1.5px;line-height:1.15;margin:10px 0 12px}.lead{color:var(--muted);max-width:990px;margin:0;font-size:15px}.snapshot{font-size:11px;color:var(--muted);margin-top:12px}.metrics{display:grid;grid-template-columns:repeat(7,1fr);gap:12px;margin:25px 0 18px}.metric{padding:17px 15px;background:#fff;border:1px solid var(--line);border-radius:12px}.metric small{display:block;color:var(--muted);font-size:11px;min-height:33px}.metric strong{display:block;font-size:26px;font-weight:700;letter-spacing:-.7px;margin-top:4px}.metric.blue{background:var(--blue);color:#fff;border-color:var(--blue)}.metric.blue small{color:#dce9ff}.progress-card,.policy,.table-card{background:#fff;border:1px solid var(--line);border-radius:14px}.progress-card{padding:18px 21px}progress{display:block;width:100%;height:8px;margin:12px 0;appearance:none;accent-color:var(--blue)}progress::-webkit-progress-bar{background:#eaf0f7;border-radius:8px}progress::-webkit-progress-value{background:var(--blue);border-radius:8px}.progress-card p{margin:0;color:var(--muted);font-size:12px}.progress-card strong{font-size:13px}.policy{padding:18px 21px;margin:17px 0 23px;background:#eef5fc}.policy h2{font-size:14px;margin:0 0 9px}.policy-grid{display:flex;gap:12px 22px;flex-wrap:wrap;font-size:12px}.policy-grid strong{color:var(--blue)}.policy-note{font-size:11px;color:var(--muted);margin:11px 0 0}.toolbar{display:grid;grid-template-columns:minmax(250px,2fr) repeat(3,minmax(150px,1fr));gap:12px;margin-bottom:16px}.control{display:grid;gap:5px}.control label{font-size:11px;font-weight:650}.control input,.control select{width:100%;padding:10px 11px;border:1px solid #bfd0df;border-radius:8px;background:#fff;min-width:0;color:var(--navy)}.table-head{padding:17px 20px;display:flex;align-items:center;justify-content:space-between;gap:18px;border-bottom:1px solid var(--line);font-size:12px}.table-head small{color:var(--muted)}.table-scroll{overflow:auto;max-height:740px}table{border-collapse:collapse;width:100%;min-width:1050px;text-align:left}thead{position:sticky;top:0;z-index:1;background:#eef3f8}th{padding:13px 14px;font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:#496479;font-weight:700;white-space:nowrap}td{padding:14px;border-top:1px solid #e6edf3;font-size:12px;vertical-align:middle}tbody tr:hover{background:#f7fbff}.name-cell{min-width:260px;max-width:410px}.name-cell strong{font-weight:600;display:block;font-size:12px}.name-cell small,td small{display:block;font-size:10px;color:var(--muted);margin-top:6px}.number{font-variant-numeric:tabular-nums;white-space:nowrap}.number strong{font-weight:650}.tag{display:inline-block;padding:5px 8px;border-radius:7px;font-size:10px;line-height:1.4;font-weight:650;max-width:200px}.tag.pending{background:#eef1f5;color:#617183}.tag.indexed{background:#eaf1fe;color:#2356a8}.tag.validation,.tag.candidate{background:#fff3db;color:#77551c}.tag.strict{background:#ddf1e8;color:#216b4a}.tag.error{background:#fbe7e7;color:#9f4141}.active-text{color:#216b4a}.blocked-text{color:#9f4141}.sources-button{background:#f2f7fd;border:1px solid #c7daf0;border-radius:7px;color:var(--blue);font-weight:600;font-size:11px;padding:8px 10px;white-space:nowrap;cursor:pointer}.sources-button:hover{background:#e3edfc}.sources-button:disabled{border-color:#e2e7ec;color:#7e8a97;background:#f6f7f8;cursor:default}.pagination{padding:16px 20px;border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;gap:15px;flex-wrap:wrap;font-size:12px}.pagination nav{display:flex;align-items:center;gap:12px}.pagination button,.clear{border:1px solid #c6d5e4;border-radius:7px;padding:7px 11px;background:#fff;color:var(--blue);cursor:pointer;font-size:11px}.pagination button:disabled{color:#8a98a5;cursor:default}.pagination select{padding:5px;border:1px solid #c6d5e4;border-radius:6px;background:#fff;color:var(--navy)}.empty{text-align:center;color:var(--muted);padding:35px}.batch-details{font-size:12px;color:var(--muted);margin-top:22px}.batch-details summary{cursor:pointer;font-weight:650;color:var(--navy)}.batch-details ul{padding-left:20px}.foot{font-size:11px;color:var(--muted);margin:20px 0 0}.foot strong{color:var(--navy)}dialog{border:1px solid var(--line);border-radius:17px;padding:0;width:min(850px,92vw);max-height:88vh;color:var(--navy);box-shadow:0 20px 80px #0b1f3340}dialog::backdrop{background:#08192f88}.dialog-head{padding:21px 24px;border-bottom:1px solid var(--line);display:flex;gap:18px;align-items:flex-start;background:#f0f6fc;position:sticky;top:0;z-index:1}.dialog-head h2{font-size:17px;line-height:1.35;margin:0}.dialog-head p{font-size:11px;color:var(--muted);margin:7px 0 0}.dialog-head button{margin-left:auto;border:1px solid #c6d5e4;background:#fff;border-radius:6px;color:var(--navy);padding:5px 10px;cursor:pointer}.dialog-body{padding:21px 24px}.source-explanation{font-size:12px;color:var(--muted);margin:0 0 19px}.source-card{border:1px solid var(--line);border-radius:10px;padding:17px;margin-top:13px}.source-card h3{font-size:14px;line-height:1.4;margin:10px 0}.source-card a{color:var(--blue);font-size:12px;font-weight:650}.source-price{font-size:13px;font-weight:650;margin:8px 0}.source-meta{font-size:11px;color:var(--muted);overflow-wrap:anywhere;margin:8px 0}.partial-note{font-size:11px;color:#77551c;background:#fff8e8;padding:9px;border-radius:6px}@media(max-width:1150px){.metrics{grid-template-columns:repeat(4,1fr)}.toolbar{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:650px){.top{padding:18px}.private{font-size:9px}.wrap{padding:25px 18px}.metrics{grid-template-columns:repeat(2,1fr);gap:9px}.metric{padding:13px}.metric strong{font-size:25px}.metric small{min-height:auto}.toolbar{grid-template-columns:1fr}.table-head{align-items:flex-start;flex-direction:column}.pagination{padding:13px}.pagination nav{gap:7px}.dialog-head,.dialog-body{padding:17px}.progress-card,.policy{padding:16px}}
</style></head><body>
<header class="top"><div class="brand">scalaris<span>.</span></div><div class="private">CONTROL PRIVADO · Costos y referencias</div></header>
<main class="wrap"><div class="eyebrow">Precios e investigación de mercado</div><h1>Todo el catálogo, en un solo lugar.</h1><p class="lead">Revisá costos, precios calculados y fuentes de cada producto. Los precios ya pueden calcularse por política comercial; la investigación de tiendas y Mercado Libre avanza por lotes y todavía está incompleta.</p><p class="snapshot">Foto de la información guardada · Generado <span id="built-at"></span> · No se actualiza solo al abrirlo.</p>
<section class="metrics" aria-label="Estado general"><article class="metric blue"><small>Productos del catálogo</small><strong id="count-total"></strong></article><article class="metric"><small>Con precio activo para pedido</small><strong id="count-active"></strong></article><article class="metric"><small>Bloqueados para pedido</small><strong id="count-blocked"></strong></article><article class="metric"><small>Indexados en búsquedas</small><strong id="count-indexed"></strong></article><article class="metric"><small>Errores de búsqueda</small><strong id="count-errors"></strong></article><article class="metric"><small>Sin búsqueda por lote</small><strong id="count-pending"></strong></article><article class="metric"><small>Con referencia estricta</small><strong id="count-strict"></strong></article></section>
<section class="progress-card"><strong>La búsqueda no está terminada</strong><progress id="search-progress" value="0" max="1" aria-label="Intentos de búsqueda sobre el catálogo"></progress><p id="progress-label"></p><p id="pipeline-count" style="margin-top:9px"></p><p id="fetch-label" style="margin-top:9px"></p></section>
<section class="policy"><h2>Regla de cálculo actual</h2><div class="policy-grid"><span><strong>20%</strong> equipos, componentes y almacenamiento</span><span><strong>25%</strong> accesorios, periféricos, audio y redes</span><span><strong>30%</strong> repuestos y herramientas</span><span><strong>+3%</strong> reserva presupuestada</span><span><strong>Transferencia</strong> · envío al cliente aparte</span></div><p class="policy-note">Son márgenes sobre la venta. La contribución calculada descuenta costo y reserva; no es utilidad contable neta de todos los gastos del negocio. Una referencia ausente no convierte el precio calculado en un precio comprobado contra el mercado. Confirmar disponibilidad antes de cobrar.</p></section>
<section class="toolbar" aria-label="Filtros"><div class="control"><label for="search">Nombre, modelo, categoría o código</label><input id="search" type="search" placeholder="Ej. Logitech MK345 o nb-119109" autocomplete="off"></div><div class="control"><label for="supplier">Proveedor</label><select id="supplier"><option value="">Todos</option><option value="nb">NB</option><option value="distriland">DistriLand</option><option value="tecnoprices">TecnoPrices</option></select></div><div class="control"><label for="price-filter">Estado del precio</label><select id="price-filter"><option value="">Activos y bloqueados</option value="active">Precio activo</option><option value="blocked">Bloqueado para pedido</option></select></div><div class="control"><label for="research-filter">Investigación</label><select id="research-filter"><option value="">Todos los estados</option><option value="pending">Sin buscar en lotes</option><option value="indexed">Indexado en búsquedas</option><option value="validation">Fuentes pendientes de validar</option><option value="strict">Referencia estricta</option><option value="error">Error de búsqueda</option></select></div></section>
<section class="table-card"><div class="table-head"><div><strong id="result-count"></strong><br><small>Costos privados · importes en pesos argentinos</small></div><button id="clear-filters" type="button" class="clear">Limpiar filtros</button></div><div class="table-scroll"><table><thead><tr><th>Producto</th><th>Proveedor</th><th>Costo final ARS</th><th>Precio calculado ARS</th><th>Margen de política</th><th>Investigación</th><th>Fuentes</th></tr></thead><tbody id="product-rows"></tbody></table></div><div class="pagination"><label>Mostrar <select id="page-size"><option value="50">50</option><option value="100">100</option></select> productos</label><nav aria-label="Paginación"><button id="previous" type="button">← Anterior</button><span id="page-number"></span><button id="next" type="button">Siguiente →</button></nav></div></section>
<details class="batch-details"><summary>Lotes de búsqueda incorporados</summary><ul id="batch-list"></ul><p>Las muestras observadas a mano pueden aportar fuentes aunque la búsqueda por lote del producto siga pendiente. Un error se registra como error; no se cuenta como búsqueda validada.</p></details>
<p class="foot"><strong>Este archivo contiene costos mayoristas: es privado.</strong> Funciona sin conexión y no consulta fuentes automáticamente. Los enlaces se abren solo si elegís visitarlos. Para reflejar nuevos lotes o precios, regenerá el reporte y volvé a abrirlo.</p></main>
<dialog id="sources-dialog"><header class="dialog-head"><div><h2 id="source-title"></h2><p id="source-subtitle"></p></div><button id="close-sources" type="button" aria-label="Cerrar fuentes">✕</button></header><div id="source-body" class="dialog-body"></div></dialog>
<script>(${dashboardApp.toString()})(${encoded});</script></body></html>`;
}

export function buildMarketDashboard() {
  const folder = resolve(ROOT, ".private/market-research");
  const read = (path, fallback) => existsSync(path) ? JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, "")) : fallback;
  const batchFolder = resolve(folder, "search-batches");
  const searchBatches = existsSync(batchFolder) ? readdirSync(batchFolder).filter((file) => file.endsWith(".json")).sort().map((file) => read(resolve(batchFolder, file))) : [];
  const seeds = read(resolve(folder, "normalized-seeds.json"), []);
  const data = buildMarketDashboardData({
    catalog: read(resolve(ROOT, ".private/catalog-costs.json")),
    proposal: read(resolve(folder, "store-price-proposal.json")),
    marketReferences: read(resolve(folder, "market-references.json"), {}),
    policy: read(resolve(folder, "pricing-policy.json")),
    searchBatches,
    rawResearch: [read(resolve(folder, "pricing-research.json"), {}), read(resolve(folder, "parts-research.json"), {})],
    normalizedSeeds: Array.isArray(seeds) ? seeds : seeds.references || [],
  });
  mkdirSync(folder, { recursive: true });
  const output = resolve(folder, "research-dashboard.html");
  writeFileSync(output, renderMarketDashboard(data), "utf8");
  return { output, summary: data.summary };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length > 2) throw new Error("Uso: node scripts/build-market-dashboard.mjs");
    console.log(JSON.stringify(buildMarketDashboard(), null, 2));
  } catch (error) {
    console.error(`No se pudo generar el reporte privado: ${error.message}`);
    process.exitCode = 1;
  }
}
