import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { browserPricingSource } from "./pricing.mjs";

// This function is embedded as plain JavaScript: file:// works without imports or a server.
function calculatorApp(catalog) {
  const byId = (id) => document.getElementById(id);
  const currency = (value) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(value);
  const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const supplierNames = { nb: "NB", distriland: "DistriLand", tecnoprices: "TecnoPrices" };
  const searchable = catalog.products.map((product) => ({ product, text: normalize(`${product.id} ${product.name} ${product.manufacturerId || ""} ${product.supplier}`) }));
  let selected = null;
  let manualCost = false;
  const needsConfirmation = (product) => product.cost.vatIncluded !== true || product.costRequiresConfirmation === true || product.missingFromLatestNbList === true;

  function invalidate() {
    byId("result").hidden = true;
    byId("empty-result").hidden = false;
    byId("error").textContent = "";
  }

  function updateSourceCost() {
    if (!selected) return;
    const quantity = Number(byId("quantity").value);
    const tiers = (selected.quantityPrices || []).filter((tier) => tier.minQuantity <= quantity)
      .sort((a, b) => b.minQuantity - a.minQuantity);
    const sourceCost = tiers.length ? tiers[0].gross : selected.cost.gross;
    const sourceCurrency = selected.cost.currency;
    const sourceNote = sourceCurrency === "USD"
      ? `La lista adjunta está en USD (${sourceCost}). Ingresá el costo final real en pesos que te cobra NB; no hacemos una conversión automática.`
      : `Referencia de la lista: ${currency(sourceCost)} por unidad${tiers.length ? `, escala desde ${tiers[0].minQuantity} unidad(es)` : ""}. Confirmá su vigencia con el proveedor.`;
    const freshnessNote = selected.missingFromLatestNbList === true
      ? "Este producto no figura en la última lista NB. Consultá disponibilidad y costo vigente antes de cotizar. "
      : selected.costRequiresConfirmation === true ? "El costo requiere nueva confirmación del proveedor antes de cotizar. " : "";
    byId("source-note").textContent = freshnessNote + sourceNote;
    if (!manualCost) byId("unitCost").value = sourceCurrency === "ARS" && !selected.costRequiresConfirmation && !selected.missingFromLatestNbList ? String(sourceCost) : "";
  }

  function selectProduct(product) {
    selected = product;
    manualCost = false;
    byId("selected-name").textContent = product.name;
    byId("selected-meta").textContent = `${supplierNames[product.supplier] || product.supplier} · ${product.id}`;
    byId("product-placeholder").hidden = true;
    byId("selected-product").hidden = false;
    byId("supplier-confirmation").hidden = !needsConfirmation(product);
    byId("supplierFinalCostConfirmed").checked = false;
    byId("supplierFinalCostConfirmed").required = needsConfirmation(product);
    updateSourceCost();
    invalidate();
    byId("unitCost").focus();
  }

  function search() {
    const query = normalize(byId("search").value).trim();
    const supplier = byId("supplier").value;
    const words = query.split(/\s+/).filter(Boolean);
    const matches = searchable.filter(({ product, text }) => (!supplier || product.supplier === supplier) && words.every((word) => text.includes(word)));
    byId("search-count").textContent = `${matches.length.toLocaleString("es-AR")} productos${matches.length > 18 ? " · mostrándose 18" : ""}`;
    const list = byId("products");
    list.replaceChildren();
    for (const { product } of matches.slice(0, 18)) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "product-option";
      const label = document.createElement("strong");
      label.textContent = product.name;
      const meta = document.createElement("span");
      meta.textContent = `${supplierNames[product.supplier] || product.supplier} · ${product.id}`;
      button.append(label, meta);
      button.addEventListener("click", () => selectProduct(product));
      list.append(button);
    }
    if (!matches.length) {
      const message = document.createElement("p");
      message.className = "no-results";
      message.textContent = "No encontramos productos. Probá otro nombre, modelo o código.";
      list.append(message);
    }
  }

  function fieldNumber(id) {
    const value = byId(id).value.trim();
    if (!value) throw new Error(`Completá ${byId(id).dataset.label}. Usá 0 si confirmaste que no hay costo.`);
    return Number(value);
  }

  byId("search").addEventListener("input", search);
  byId("supplier").addEventListener("change", search);
  byId("unitCost").addEventListener("input", () => { manualCost = true; });
  byId("quantity").addEventListener("input", () => { updateSourceCost(); });
  byId("quote-form").addEventListener("input", invalidate);
  byId("quote-form").addEventListener("change", invalidate);
  byId("quote-form").addEventListener("submit", (event) => {
    event.preventDefault();
    invalidate();
    try {
      if (!selected) throw new Error("Elegí primero un producto del catálogo.");
      if (needsConfirmation(selected) && !byId("supplierFinalCostConfirmed").checked) {
        throw new Error(selected.missingFromLatestNbList === true
          ? "El producto no figura en la última lista NB. Consultá disponibilidad y costo vigente, e indicá la confirmación antes de calcular."
          : "Confirmá el costo final vigente para tu condición de cliente y sus impuestos.");
      }
      if (!byId("quote-form").reportValidity()) throw new Error("Revisá los campos indicados. Los gastos desconocidos no se asumen en cero.");
      const input = { currency: "ARS" };
      for (const name of ["unitCost", "quantity", "inboundShipping", "outboundShipping", "packaging", "fixedFees", "minimumProfit", "roundTo"]) input[name] = fieldNumber(name);
      for (const name of ["paymentFeeRate", "reserveRate", "targetMarginRate"]) input[name] = fieldNumber(name) / 100;
      if (byId("marketReference").value.trim()) input.marketReference = fieldNumber("marketReference");
      const result = calculatePrice(input);
      byId("suggested-price").textContent = currency(result.unitPrice);
      byId("total-price").textContent = currency(result.totalPrice);
      byId("order-cost").textContent = currency(result.orderCostArs);
      byId("profit").textContent = currency(result.profitArs);
      byId("margin").textContent = `${(result.actualMarginRate * 100).toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`;
      byId("fees").textContent = currency(result.paymentFeesArs);
      byId("reserve").textContent = currency(result.reserveArs);
      const comparison = byId("comparison");
      const market = result.marketComparison;
      comparison.className = `comparison ${market ? (market.viable ? "viable" : "not-viable") : "neutral"}`;
      comparison.textContent = !market ? "Sin referencia de mercado: rentabilidad calculada, competitividad por revisar."
        : market.viable ? `Dentro de la referencia de ${currency(market.referenceUnitPrice)} por unidad. Confirmá que modelo, pago, garantía y envío sean comparables.`
          : `Supera la referencia en ${currency(market.differencePerUnitArs)} por unidad. No conviene bajar del piso calculado; revisá proveedor, gastos o producto.`;
      byId("result").hidden = false;
      byId("empty-result").hidden = true;
    } catch (error) {
      byId("error").textContent = error.message;
    }
  });
  byId("catalog-date").textContent = catalog.importedAt || "Sin fecha";
  search();
}

export function renderPriceCalculator(catalog) {
  if (catalog.version !== 1 || !Array.isArray(catalog.products)) throw new Error("Catálogo privado inválido.");
  const compactCatalog = {
    importedAt: catalog.importedAt,
    products: catalog.products.map(({ id, supplier, name, manufacturerId, cost, quantityPrices, missingFromLatestNbList, costRequiresConfirmation }) => ({ id, supplier, name, manufacturerId, cost, quantityPrices, missingFromLatestNbList, costRequiresConfirmation })),
  };
  const safeJson = JSON.stringify(compactCatalog).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  return `<!DOCTYPE html>
<html lang="es-AR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'">
<title>Scalaris · Cotizador privado</title>
<style>
:root{color-scheme:light;--ink:#172234;--muted:#5e6979;--line:#dde3eb;--orange:#145cdb;--navy:#132233;--paper:#f3f5f8}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.5 "Segoe UI",Arial,sans-serif}button,input,select{font:inherit}[hidden]{display:none!important}.top{background:var(--navy);color:#fff;padding:25px max(24px,calc((100vw - 1380px)/2));display:flex;justify-content:space-between;align-items:center;gap:16px}.brand{font-size:24px;font-weight:750;letter-spacing:-1px}.brand span{color:#53c9f4}.privacy{border:1px solid #526175;border-radius:24px;padding:7px 13px;font-size:12px;color:#dbe4ed}.intro{max-width:1380px;margin:32px auto 24px;padding:0 24px}.eyebrow{text-transform:uppercase;letter-spacing:.13em;font-size:11px;font-weight:750;color:#145cdb}.intro h1{font-size:clamp(27px,4vw,39px);line-height:1.15;letter-spacing:-1.3px;margin:10px 0}.intro p{margin:12px 0 0;color:var(--muted);max-width:850px}.layout{max-width:1380px;margin:0 auto 36px;padding:0 24px;display:grid;grid-template-columns:320px minmax(0,1fr);gap:22px;align-items:start}.card{background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:0 8px 24px #16243a04}.search-card{padding:22px;position:sticky;top:18px}.search-card h2,.form-card h2{font-size:18px;margin:0 0 16px}.search-card input,.search-card select{width:100%;margin-bottom:10px}.search-count{font-size:12px;color:var(--muted);margin:3px 0 14px}.products{display:grid;gap:8px;max-height:580px;overflow:auto;padding:0 4px 2px 0}.product-option{border:1px solid var(--line);border-radius:10px;background:#fff;padding:13px;text-align:left;cursor:pointer;color:var(--ink)}.product-option:hover{border-color:var(--orange);background:#f3f7ff}.product-option strong{display:block;font-size:12px;line-height:1.45;font-weight:650}.product-option span{display:block;margin-top:6px;font-size:10px;color:var(--muted)}.no-results{font-size:13px;color:var(--muted)}.workspace{display:grid;gap:18px}.form-card{padding:25px}.step{color:#145cdb;font-size:12px;font-weight:750}.selected{background:#f6f8fa;border-radius:11px;padding:16px;margin-bottom:22px;border-left:3px solid var(--orange)}.selected p{margin:0}.selected strong{display:block;font-size:16px;line-height:1.4}.selected small{display:block;color:var(--muted);margin-top:7px}.placeholder{color:var(--muted);font-size:14px}.fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:17px 15px}.field{display:flex;flex-direction:column;gap:6px}.field label{font-size:12px;font-weight:650}.field small{font-size:11px;color:var(--muted)}input,select{min-width:0;border:1px solid #cad2de;border-radius:8px;background:#fff;color:var(--ink);padding:10px 11px;width:100%}input:focus,select:focus{outline:3px solid #145cdb28;border-color:var(--orange)}input::placeholder{color:#778395}.wide{grid-column:span 2}.divider{border:0;border-top:1px solid var(--line);margin:24px 0}.simulation{font-size:12px;background:#fff6ec;border:1px solid #f4dcc0;border-radius:9px;padding:12px 14px;color:#82501d;margin:18px 0}.confirmation{display:flex;align-items:flex-start;gap:10px;font-size:13px;padding:15px 0}.confirmation input{width:18px;height:18px;margin-top:2px;flex-shrink:0;accent-color:var(--orange)}.submit-row{margin-top:22px;display:flex;align-items:center;gap:15px}.primary{background:var(--orange);border:0;border-radius:9px;color:#fff;font-weight:700;padding:13px 22px;cursor:pointer}.primary:hover{background:#104bb5}.submit-row small{font-size:11px;color:var(--muted);max-width:310px}.error{color:#9d3029;font-size:13px;margin:15px 0 0;min-height:1px}.result-empty{padding:23px;color:var(--muted);font-size:13px;border-style:dashed}.result{padding:26px;background:var(--navy);color:#fff}.result-head{display:flex;justify-content:space-between;gap:20px;align-items:center;flex-wrap:wrap}.result-head p{color:#bfcbd8;font-size:12px;margin:0}.price{font-size:38px;font-weight:750;letter-spacing:-1.4px;display:block;margin-top:4px}.result-note{font-size:11px;background:#28394b;color:#f8d6ac;border-radius:7px;padding:10px 12px;max-width:250px}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:17px;padding:24px 0;margin:15px 0 0;border-top:1px solid #3b4a5c}.metrics dt{font-size:11px;color:#bac8d8}.metrics dd{margin:5px 0 0;font-size:18px;font-weight:650}.comparison{font-size:12px;padding:13px 15px;border-radius:8px;margin-top:4px;line-height:1.55}.viable{background:#193e38;color:#c2eadb}.not-viable{background:#57342f;color:#ffe0d6}.neutral{background:#28394b;color:#d4deea}.foot{max-width:1380px;margin:0 auto;padding:0 24px 30px;color:var(--muted);font-size:11px}details{margin-top:19px;font-size:12px;color:var(--muted)}summary{cursor:pointer;font-weight:650}details p{margin:8px 0}button:focus-visible{outline:3px solid #145cdb70;outline-offset:2px}@media(max-width:1000px){.layout{grid-template-columns:270px minmax(0,1fr)}.fields{grid-template-columns:repeat(2,minmax(0,1fr))}.wide{grid-column:span 2}.metrics{grid-template-columns:repeat(2,1fr)}}@media(max-width:720px){.top{padding:19px 18px}.privacy{font-size:10px}.intro{margin-top:26px;padding:0 18px}.layout{padding:0 18px;grid-template-columns:1fr}.search-card{position:static}.products{max-height:230px}.form-card,.result{padding:20px}.fields{grid-template-columns:1fr}.wide{grid-column:auto}.submit-row{align-items:flex-start;flex-direction:column}.primary{width:100%}.price{font-size:34px}.foot{padding:0 18px 24px}}
</style></head><body>
<header class="top"><div class="brand">scalaris<span>.</span></div><div class="privacy">PRIVADO · Solo en tu computadora · Sin conexión</div></header>
<section class="intro"><div class="eyebrow">Herramienta interna</div><h1>Tu precio, con margen.</h1><p>Elegí un producto, completá los gastos reales y revisá qué precio cubre tu ganancia. Todo se calcula acá: esta herramienta no publica precios ni envía datos.</p></section>
<main class="layout">
<aside class="card search-card"><h2><span class="step">01 /</span> Elegí el producto</h2><label for="search" class="eyebrow">Nombre, modelo o código</label><input id="search" type="search" placeholder="Ej. Logitech MK345 o nb-119109" autocomplete="off"><label for="supplier" class="eyebrow">Proveedor</label><select id="supplier"><option value="">Todos los proveedores</option value="nb">NB</option><option value="distriland">DistriLand</option><option value="tecnoprices">TecnoPrices</option></select><p id="search-count" class="search-count" aria-live="polite"></p><div id="products" class="products"></div></aside>
<div class="workspace"><form id="quote-form" class="card form-card" novalidate><h2><span class="step">02 /</span> Completá tu pedido</h2>
<div id="product-placeholder" class="selected placeholder">Buscá y elegí un producto en el catálogo para comenzar.</div><div id="selected-product" class="selected" hidden><strong id="selected-name"></strong><small id="selected-meta"></small><small id="source-note"></small></div>
<div class="fields">
<div class="field"><label for="quantity">Cantidad de unidades</label><input id="quantity" data-label="la cantidad" type="number" value="1" min="1" step="1" required></div>
<div class="field wide"><label for="unitCost">Costo unitario final en pesos · IVA incluido</label><input id="unitCost" data-label="el costo final en pesos" type="number" min="0" step="any" placeholder="Costo real que te cobra el proveedor" required><small>Se precarga si la lista está en pesos. Confirmá el importe vigente con el proveedor.</small></div>
<div class="field"><label for="inboundShipping">Envío del proveedor · ARS</label><input id="inboundShipping" data-label="el envío del proveedor" type="number" value="0" min="0" step="any" required><small>Gratis según tu acuerdo confirmado.</small></div>
<div class="field"><label for="outboundShipping">Envío al cliente a tu cargo · ARS</label><input id="outboundShipping" data-label="el envío al cliente" type="number" min="0" step="any" placeholder="Completar, incluso si es 0" required></div>
<div class="field"><label for="packaging">Embalaje del pedido · ARS</label><input id="packaging" data-label="el embalaje" type="number" min="0" step="any" placeholder="Completar, incluso si es 0" required></div>
<div class="field"><label for="fixedFees">Otros cargos fijos del pedido · ARS</label><input id="fixedFees" data-label="los cargos fijos" type="number" min="0" step="any" placeholder="Completar, incluso si es 0" required></div>
<div class="field"><label for="paymentFeeRate">Costo de cobro efectivo · %</label><input id="paymentFeeRate" data-label="el costo de cobro" type="number" min="0" max="99.99" step="any" placeholder="Confirmar según medio de pago" required><small>Incluir cargos e impuestos del cobro que absorbés.</small></div>
</div>
<label id="supplier-confirmation" class="confirmation" hidden><input id="supplierFinalCostConfirmed" type="checkbox"><span>Confirmé que el importe del proveedor corresponde a mi condición de cliente e incluye los impuestos aplicables.</span></label>
<hr class="divider"><h2><span class="step">03 /</span> Definí tu ganancia</h2>
<div class="simulation">Valores iniciales de simulación: margen 20%, reserva 3%, ganancia mínima $3.000 y redondeo $100. Podés cambiarlos; no son precios ni rentabilidades aprobados.</div>
<div class="fields">
<div class="field"><label for="targetMarginRate">Margen objetivo sobre venta · %</label><input id="targetMarginRate" data-label="el margen objetivo" type="number" value="20" min="0" max="99.99" step="any" required></div>
<div class="field"><label for="reserveRate">Reserva para imprevistos · %</label><input id="reserveRate" data-label="la reserva" type="number" value="3" min="0" max="99.99" step="any" required></div>
<div class="field"><label for="minimumProfit">Ganancia mínima del pedido · ARS</label><input id="minimumProfit" data-label="la ganancia mínima" type="number" value="3000" min="0" step="any" required></div>
<div class="field"><label for="roundTo">Redondear hacia arriba cada · ARS</label><input id="roundTo" data-label="el redondeo" type="number" value="100" min="0.01" step="any" required></div>
<div class="field wide"><label for="marketReference">Referencia final de mercado por unidad · ARS · opcional</label><input id="marketReference" data-label="la referencia de mercado" type="number" min="0" step="any" placeholder="Mismo modelo, pago, garantía y envío incluidos"><small>Se usa para comparar; nunca para bajar el precio por debajo del piso.</small></div>
</div>
<details><summary>Cómo leer este cálculo</summary><p>Envíos, embalaje, cargos fijos y ganancia mínima son totales del pedido; se reparten entre las unidades. Las comisiones y la reserva se calculan sobre la venta. La ganancia mostrada queda después de esos costos; no incluye otros gastos del negocio que no hayas cargado.</p><p>20% de margen sobre venta equivale a 25% de recargo sobre costo sin otros gastos. Confirmá costo, disponibilidad y plazo con el proveedor antes de cobrar.</p></details>
<div class="submit-row"><button class="primary" type="submit">Calcular precio sugerido</button><small>El catálogo es una referencia. No confirma stock ni reemplaza la cotización del proveedor.</small></div><p id="error" class="error" role="alert"></p>
</form>
<div id="empty-result" class="card result-empty">El resultado aparecerá cuando completes los gastos y calcules el precio. Si cambiás un dato, hay que volver a calcular.</div>
<section id="result" class="card result" aria-live="polite" hidden><div class="result-head"><div><p>Precio sugerido por unidad</p><strong id="suggested-price" class="price"></strong></div><div class="result-note">Simulación. Confirmar costos antes de cotizar o cobrar al cliente.</div></div><dl class="metrics"><div><dt>Total de venta del pedido</dt><dd id="total-price"></dd></div><div><dt>Ganancia del pedido</dt><dd id="profit"></dd></div><div><dt>Margen real sobre venta</dt><dd id="margin"></dd></div><div><dt>Productos y gastos del pedido</dt><dd id="order-cost"></dd></div><div><dt>Costo de cobro</dt><dd id="fees"></dd></div><div><dt>Reserva presupuestada</dt><dd id="reserve"></dd></div></dl><div id="comparison" class="comparison neutral"></div></section>
</div></main><footer class="foot">Catálogo importado: <span id="catalog-date"></span>. Archivo privado: contiene costos mayoristas. No compartir ni subir al sitio público. Para actualizar las listas, regenerá este cotizador.</footer>
<script>${browserPricingSource()}
(${calculatorApp.toString()})(${safeJson});</script>
</body></html>`;
}

export function buildPriceCalculator({ catalogPath, outputPath } = {}) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const source = catalogPath || resolve(root, ".private/catalog-costs.json");
  const output = outputPath || resolve(root, ".private/cotizador.html");
  const privateRoot = resolve(root, ".private");
  if (dirname(resolve(output)) !== privateRoot) throw new Error("El cotizador solo puede generarse dentro de .private/.");
  const catalog = JSON.parse(readFileSync(source, "utf8").replace(/^\uFEFF/, ""));
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, renderPriceCalculator(catalog), "utf8");
  return { output, products: catalog.products.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length > 2) throw new Error("Uso: node scripts/build-price-calculator.mjs");
    const result = buildPriceCalculator();
    console.log(`Cotizador privado generado: ${result.output} (${result.products} productos). Abrilo con doble clic.`);
  } catch (error) {
    console.error(`No se pudo generar el cotizador: ${error.message}`);
    process.exitCode = 1;
  }
}
