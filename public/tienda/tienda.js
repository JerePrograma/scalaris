import { PAGE_SIZE, MAX_PRODUCTS, MAX_QUANTITY, filterProducts, sanitizeSelection, inquiryMessage, displayPrice, canOrder, selectionTotals, money } from "./model.js";

const $ = id => document.getElementById(id);
const grid = $("product-grid");
const productDialog = $("product-dialog");
const selectionDialog = $("selection-dialog");
let products = [];
let selection = [];
let page = 1;
let focusedProduct = null;
let queryTimer;
let marketProgress = null;
let marketReferences = new Map();
const MARKET_REFERENCE_MAX_AGE = 24 * 60 * 60 * 1000;

function decodedReferenceComponent(value) {
  let current = value;
  for (let pass = 0; pass < 4; pass++) {
    let decoded;
    try { decoded = decodeURIComponent(current); } catch { return null; }
    if (decoded === current) return current;
    current = decoded;
  }
  return /%[0-9a-f]{2}/i.test(current) ? null : current;
}

function referenceCredentialKey(key) {
  const decoded = decodedReferenceComponent(key);
  if (decoded === null) return true;
  const name = decoded.toLowerCase().replace(/[^a-z0-9]/g, "");
  return /token|apikey|accesskey|privatekey|clientkey|password|passwd|passphrase|passcode|secret|credential|auth|session|sessid|jwt|csrf|nonce|signature/.test(name) || ["pwd", "sid", "key", "code"].includes(name);
}

function currentMarketReference(reference) {
  if (reference?.currency !== "ARS" || typeof reference.priceARS !== "number" || !Number.isFinite(reference.priceARS) || reference.priceARS <= 0) return null;
  const age = Date.now() - Date.parse(reference.observedAt);
  if (!Number.isFinite(age) || age < 0 || age > MARKET_REFERENCE_MAX_AGE) return null;
  let url;
  try { url = new URL(reference.url); } catch { return null; }
  const path = decodedReferenceComponent(url.pathname);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || path === null || path.split(/[;/]/).some(part => part.includes("=") && referenceCredentialKey(part.split("=", 1)[0]))) return null;
  for (const key of url.searchParams.keys()) if (referenceCredentialKey(key)) return null;
  return { url, priceARS: reference.priceARS, observedAt: reference.observedAt };
}

function referenceSection(product) {
  const references = (marketReferences.get(product.id) || []).map(currentMarketReference).filter(Boolean);
  if (!references.length) return null;
  const section = element("section", "market-references");
  section.append(element("h3", "", "Referencias de otros comercios"), element("p", "", "Mismo producto verificado. Importes por transferencia, sin envío; pueden cambiar."));
  const list = element("ul");
  for (const reference of references) {
    const item = element("li");
    const link = element("a", "", reference.url.hostname.replace(/^www\./, "") + " ↗");
    link.href = reference.url.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.referrerPolicy = "no-referrer";
    const observed = element("time", "", new Date(reference.observedAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }));
    observed.dateTime = reference.observedAt;
    item.append(link, element("strong", "", money(reference.priceARS)), observed);
    list.append(item);
  }
  section.append(list);
  return section;
}

function refreshDetailReferences() {
  if (!productDialog.open || !focusedProduct) return;
  const product = products.find(product => product.id === focusedProduct);
  const copy = $("detail-content").querySelector(".detail-copy");
  if (!copy || !product) return;
  copy.querySelector(".market-references")?.remove();
  const references = referenceSection(product);
  if (references) copy.append(references);
}

function renderMarketProgress() {
  const region = $("market-progress");
  region.hidden = true;
  marketReferences = new Map();
  const summary = marketProgress?.summary;
  const updated = Date.parse(marketProgress?.updatedAt);
  if (!products.length || marketProgress?.version !== 1 || !Array.isArray(marketProgress.products) || !Number.isFinite(updated) || updated > Date.now() || summary?.totalProducts !== products.length || !Number.isSafeInteger(summary?.researchedProducts) || summary.researchedProducts < 0 || summary.researchedProducts > products.length) { refreshDetailReferences(); return; }
  const ids = new Set(products.map(product => product.id));
  for (const product of marketProgress.products) {
    if (!ids.has(product?.id) || !Array.isArray(product.references)) continue;
    const unique = new Map();
    for (const reference of product.references) {
      const current = currentMarketReference(reference);
      if (current) unique.set(current.url.href, reference);
    }
    if (unique.size) marketReferences.set(product.id, [...unique.values()]);
  }
  $("market-progress-count").textContent = `${summary.researchedProducts.toLocaleString("es-AR")} de ${products.length.toLocaleString("es-AR")} productos relevados`;
  $("market-progress-bar").max = products.length;
  $("market-progress-bar").value = summary.researchedProducts;
  $("market-progress-date").textContent = "Actualizado el " + new Date(updated).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
  region.hidden = false;
  refreshDetailReferences();
}

async function loadMarketProgress() {
  try {
    const response = await fetch("./market-progress.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Avance no disponible");
    marketProgress = await response.json();
  } catch { marketProgress = null; }
  renderMarketProgress();
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function placeholder() {
  const node = element("span", "product-placeholder");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 48 48");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.4");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M9 8h30v24H9zM17 40h14M24 32v8M15 15h18M15 21h12");
  svg.append(path);
  node.append(svg, element("span", "", "Imagen pendiente"));
  return node;
}

function picture(product, parent, eager = false) {
  if (!product.image) { parent.append(placeholder()); return; }
  const image = element("img");
  const url = new URL(product.image, window.location.href);
  if (url.protocol !== "https:" && url.origin !== location.origin) { parent.append(placeholder()); return; }
  image.src = url.href;
  image.alt = product.name;
  image.loading = eager ? "eager" : "lazy";
  image.decoding = "async";
  image.referrerPolicy = "no-referrer";
  image.addEventListener("error", () => { image.replaceWith(placeholder()); }, { once: true });
  parent.append(image);
}

function addButton(product) {
  if (!canOrder(product)) {
    const button = element("button", "add-product unavailable", "No disponible para pedidos");
    button.type = "button";
    button.disabled = true;
    return button;
  }
  const exists = selection.some(item => item.id === product.id);
  const button = element("button", "add-product" + (exists ? " added" : ""), exists ? "En tu pedido ✓" : "Agregar al pedido +");
  button.type = "button";
  button.dataset.productId = product.id;
  button.setAttribute("aria-label", (exists ? "Revisar pedido: " : "Agregar al pedido: ") + product.name);
  button.addEventListener("click", () => {
    if (selection.some(item => item.id === product.id)) {
      productDialog.close();
      openSelection();
      return;
    }
    if (selection.length >= MAX_PRODUCTS) {
      $("copy-status").textContent = `Podés incluir hasta ${MAX_PRODUCTS} productos distintos por mensaje. Compartí este pedido y después armá otro.`;
      productDialog.close();
      openSelection();
      return;
    }
    selection.push({ id: product.id, quantity: 1 });
    const fromDetail = productDialog.open;
    updateSelection();
    renderProducts();
    if (fromDetail) renderDetail(product);
    const region = fromDetail ? $("detail-content") : grid;
    const replacement = [...region.querySelectorAll(".add-product")].find(node => node.dataset.productId === product.id);
    replacement?.focus({ preventScroll: true });
  });
  return button;
}

function renderProducts() {
  if (!products.length) return;
  const filtered = filterProducts(products, { search: $("search").value, category: $("category").value, sort: $("sort").value });
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  page = Math.min(page, pages);
  grid.replaceChildren();
  const start = (page - 1) * PAGE_SIZE;
  for (const product of filtered.slice(start, start + PAGE_SIZE)) {
    const article = element("article", "product-card");
    const visual = element("button", "product-visual");
    visual.type = "button";
    visual.setAttribute("aria-label", "Ver detalle: " + product.name);
    picture(product, visual);
    visual.addEventListener("click", () => openProduct(product));
    const copy = element("div", "product-copy");
    const heading = element("h3");
    const title = element("button", "product-title", product.name);
    title.type = "button";
    title.addEventListener("click", () => openProduct(product));
    heading.append(title);
    const order = element("div", "product-order");
    order.append(element("span", "availability", canOrder(product) ? "Contra pedido" : "Fuera de la venta activa"), element("strong", "product-price", displayPrice(product)), element("span", "product-price-note", canOrder(product) ? "Transferencia · Envío aparte" : "Ficha pendiente de actualización"), addButton(product));
    copy.append(element("span", "product-category", product.category), heading, order);
    article.append(visual, copy);
    grid.append(article);
  }
  $("empty").hidden = filtered.length > 0;
  $("result-count").textContent = filtered.length ? `${filtered.length.toLocaleString("es-AR")} productos · Mostrando ${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)}` : "Sin coincidencias";
  $("clear-filters").hidden = !$("search").value && !$("category").value && $("sort").value === "featured";
  $("pagination").hidden = pages <= 1;
  $("previous").disabled = page <= 1;
  $("next").disabled = page >= pages;
  $("page-label").textContent = `Página ${page} de ${pages}`;
  grid.setAttribute("aria-busy", "false");
}

function renderDetail(product) {
  const layout = element("div", "detail-layout");
  const visual = element("div", "detail-picture");
  picture(product, visual, true);
  const copy = element("div", "detail-copy");
  const title = element("h2", "", product.name);
  title.id = "detail-title";
  copy.append(element("span", "product-category", product.category), title, element("p", "", product.description), element("p", "detail-ref", "Referencia: " + product.id), element("span", "availability", canOrder(product) ? "Contra pedido" : "Fuera de la venta activa"), element("strong", "product-price", displayPrice(product)), element("p", "", canOrder(product) ? "Precio por transferencia. El envío se cotiza por código postal antes del pago. Confirmamos disponibilidad y plazo de entrega." : "Esta referencia no está habilitada para nuevos pedidos."), addButton(product));
  const references = referenceSection(product);
  if (references) copy.append(references);
  layout.append(visual, copy);
  $("detail-content").replaceChildren(layout);
}

function openProduct(product) {
  focusedProduct = product.id;
  renderDetail(product);
  const url = new URL(location.href);
  url.searchParams.set("producto", product.id);
  history.replaceState(null, "", url);
  if (!productDialog.open) productDialog.showModal();
}

function openSelection() {
  renderSelection();
  if (!selectionDialog.open) selectionDialog.showModal();
}

function updateSelection() {
  selection = sanitizeSelection(selection, products);
  try { sessionStorage.setItem("scalaris-product-inquiry", JSON.stringify(selection)); } catch { /* La consulta sigue funcionando sin almacenamiento. */ }
  const count = selection.reduce((total, item) => total + item.quantity, 0);
  const totals = selectionTotals(selection, products);
  $("selection-count").textContent = count;
  $("bar-count").textContent = `${count} ${count === 1 ? "unidad" : "unidades"} · ${money(totals.subtotal)}`;
  $("selection-bar").hidden = count === 0;
  if (selectionDialog.open) renderSelection();
}

function renderSelection() {
  const list = $("selection-items");
  list.replaceChildren();
  for (const item of selection) {
    const product = products.find(product => product.id === item.id);
    const row = element("div", "selection-row");
    const info = element("div");
    info.append(element("h3", "", product.name), element("small", "", `${displayPrice(product)} por unidad · Ref. ${product.id}`), element("strong", "row-subtotal", canOrder(product) ? money(product.price * item.quantity) : "Precio vencido: actualizá el catálogo"));
    const actions = element("div");
    const quantity = element("div", "quantity-controls");
    const output = element("output", "", item.quantity);
    output.setAttribute("aria-label", "Cantidad de " + product.name);
    for (const direction of [-1, 1]) {
      const button = element("button", "", direction === -1 ? "−" : "+");
      button.type = "button";
      button.setAttribute("aria-label", (direction === -1 ? "Quitar una unidad: " : "Sumar una unidad: ") + product.name);
      button.disabled = direction === -1 ? item.quantity <= 1 : item.quantity >= MAX_QUANTITY;
      button.addEventListener("click", () => {
        item.quantity += direction;
        updateSelection();
        const replacement = [...list.querySelectorAll("button")].find(node => node.getAttribute("aria-label") === button.getAttribute("aria-label"));
        if (replacement && !replacement.disabled) replacement.focus();
      });
      quantity.append(button);
      if (direction === -1) quantity.append(output);
    }
    const remove = element("button", "remove-item", "Quitar");
    remove.type = "button";
    remove.setAttribute("aria-label", "Quitar producto: " + product.name);
    remove.addEventListener("click", () => {
      selection = selection.filter(entry => entry.id !== item.id);
      updateSelection();
      renderProducts();
      $("selection-title").setAttribute("tabindex", "-1");
      $("selection-title").focus();
    });
    actions.append(quantity, remove);
    row.append(info, actions);
    list.append(row);
  }
  $("selection-empty").hidden = selection.length > 0;
  $("selection-actions").hidden = selection.length === 0;
  updateOrderLink();
}

function orderMessage() { return inquiryMessage(selection, products, { postalCode: $("postal-code").value }); }
function updateOrderLink() {
  const totals = selectionTotals(selection, products);
  $("products-total").textContent = money(totals.subtotal);
  $("price-expired").hidden = !totals.hasUnavailable;
  const link = $("send-inquiry");
  if (totals.hasUnavailable || !selection.length) { link.removeAttribute("href"); link.setAttribute("aria-disabled", "true"); }
  else { link.href = "https://wa.me/5491172789289?text=" + encodeURIComponent(orderMessage()); link.removeAttribute("aria-disabled"); }
}

async function loadCatalog() {
  $("catalog-error").hidden = true;
  grid.setAttribute("aria-busy", "true");
  $("result-count").textContent = "Cargando productos…";
  try {
    const response = await fetch("./catalog.json", { cache: "no-cache" });
    if (!response.ok) throw new Error("Catálogo no disponible");
    const catalog = await response.json();
    if (catalog.version !== 1 || !Array.isArray(catalog.products) || !catalog.products.length) throw new Error("Catálogo inválido");
    products = catalog.products;
    const categories = [...new Set(products.map(product => product.category))].sort((a, b) => a.localeCompare(b, "es"));
    $("category").replaceChildren(new Option("Todas las categorías", ""), ...categories.map(category => new Option(category, category)));
    try { selection = sanitizeSelection(JSON.parse(sessionStorage.getItem("scalaris-product-inquiry") || "[]"), products); } catch { selection = []; }
    renderProducts();
    updateSelection();
    renderMarketProgress();
    const id = new URL(location.href).searchParams.get("producto");
    const product = products.find(product => product.id === id);
    if (product) openProduct(product);
  } catch {
    $("catalog-error").hidden = false;
    $("result-count").textContent = "Catálogo no disponible";
    grid.setAttribute("aria-busy", "false");
  }
}

$("filters").addEventListener("submit", event => event.preventDefault());
$("search").addEventListener("input", () => { clearTimeout(queryTimer); queryTimer = setTimeout(() => { page = 1; renderProducts(); }, 180); });
for (const id of ["category", "sort"]) $(id).addEventListener("change", () => { page = 1; renderProducts(); });
$("clear-filters").addEventListener("click", () => { $("filters").reset(); page = 1; renderProducts(); $("search").focus(); });
for (const [id, change] of [["previous", -1], ["next", 1]]) $(id).addEventListener("click", () => { page += change; renderProducts(); $("catalogo").scrollIntoView({ behavior: "instant" }); $("catalog-title").setAttribute("tabindex", "-1"); $("catalog-title").focus({ preventScroll: true }); });
for (const id of ["open-selection", "review-selection"]) $(id).addEventListener("click", () => { $("copy-status").textContent = ""; openSelection(); });
$("retry").addEventListener("click", loadCatalog);
$("postal-code").addEventListener("input", updateOrderLink);
$("send-inquiry").addEventListener("click", event => {
  updateOrderLink();
  if (!$("send-inquiry").hasAttribute("href")) event.preventDefault();
});
$("copy-inquiry").addEventListener("click", async () => {
  const message = orderMessage();
  if (!message) { $("copy-status").textContent = "Hay precios vencidos. Actualizá el catálogo antes de compartir el pedido."; return; }
  try { await navigator.clipboard.writeText(message); $("copy-status").textContent = "Pedido copiado. Ya podés pegarlo en tu conversación."; }
  catch { $("copy-status").textContent = "No se pudo copiar. Usá el botón de WhatsApp para abrir la lista."; }
});
for (const dialog of [productDialog, selectionDialog]) {
  dialog.querySelector(".close-dialog").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => { if (event.target === dialog && (event.clientX < dialog.getBoundingClientRect().left || event.clientX > dialog.getBoundingClientRect().right || event.clientY < dialog.getBoundingClientRect().top || event.clientY > dialog.getBoundingClientRect().bottom)) dialog.close(); });
}
productDialog.addEventListener("close", () => {
  const url = new URL(location.href);
  url.searchParams.delete("producto");
  history.replaceState(null, "", url);
  if (focusedProduct) focusedProduct = null;
});
loadCatalog();
loadMarketProgress();
document.addEventListener("visibilitychange", () => { if (!document.hidden) renderMarketProgress(); });
