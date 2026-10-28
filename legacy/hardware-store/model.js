export const PAGE_SIZE = 24;
export const MAX_PRODUCTS = 12;
export const MAX_QUANTITY = 99;

export function normalize(value) {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function filterProducts(products, { search = "", category = "", sort = "featured" } = {}) {
  const terms = normalize(search).split(/\s+/).filter(Boolean);
  const result = products.filter(product => (!category || product.category === category) && terms.every(term => normalize(`${product.name} ${product.brand || ""} ${product.category} ${product.id}`).includes(term)));
  if (sort === "name") return result.sort((a, b) => a.name.localeCompare(b.name, "es-AR"));
  if (["price-asc", "price-desc"].includes(sort)) return result.sort((a, b) => {
    const aValid = canOrder(a), bValid = canOrder(b);
    if (aValid !== bValid) return aValid ? -1 : 1;
    return (sort === "price-asc" ? 1 : -1) * ((a.price || 0) - (b.price || 0));
  });
  return result;
}

export function sanitizeSelection(value, products) {
  if (!Array.isArray(value)) return [];
  const ids = new Set(products.filter(product => product.orderable !== false).map(product => product.id));
  const seen = new Set();
  return value.filter(item => item && ids.has(item.id) && !seen.has(item.id) && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= MAX_QUANTITY && seen.add(item.id)).slice(0, MAX_PRODUCTS).map(({ id, quantity }) => ({ id, quantity }));
}

export function inquiryMessage(selection, products, { postalCode = "", now = Date.now() } = {}) {
  const list = sanitizeSelection(selection, products);
  if (!list.length) return "";
  const byId = new Map(products.map(product => [product.id, product]));
  const totals = selectionTotals(list, products, now);
  if (totals.hasUnavailable) return "";
  return ["Hola Scalaris, quiero realizar este pedido del catálogo:", "", ...list.map(item => {
    const product = byId.get(item.id);
    return `${item.quantity} × ${product.name} [${item.id}] — ${money(product.price)} c/u`;
  }), "", `Total de productos por transferencia: ${money(totals.subtotal)}`, "Envío aparte, a cotizar antes del pago.", "¿Me confirman disponibilidad, costo de envío y plazo de entrega?", "Mi código postal: " + String(postalCode).trim().slice(0, 8)].join("\n");
}

export function money(value) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

export function canOrder(product, now = Date.now()) {
  const expiry = typeof product.priceValidUntil === "string" ? Date.parse(product.priceValidUntil) : NaN;
  return product.orderable !== false && product.currency === "ARS" && Number.isFinite(product.price) && product.price > 0 && Number.isFinite(expiry) && expiry > now;
}

export function displayPrice(product, now = Date.now()) {
  return canOrder(product, now) ? money(product.price) : "No disponible";
}

export function selectionTotals(selection, products, now = Date.now()) {
  const byId = new Map(products.map(product => [product.id, product]));
  let subtotal = 0, units = 0, hasUnavailable = false;
  for (const item of selection) {
    const product = byId.get(item.id);
    if (!product || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY || !canOrder(product, now)) { hasUnavailable = true; continue; }
    units += item.quantity;
    subtotal += product.price * item.quantity;
  }
  return { subtotal, units, hasUnavailable };
}
