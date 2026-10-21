import test from "node:test";
import assert from "node:assert/strict";
import { Script } from "node:vm";
import { canonicalUrl, classifyCandidateUrl, selectCandidates, productScope, extractPrice, matchIdentity, fetchFailure, normalizeReference, buildResearchState, planFetches, executeFetchPlan, renderDashboard, unwrapToolResponse } from "./market-references.mjs";

const identity = { id: "test-1", name: "MOUSE LOGITECH M170 NEGRO", brand: "LOGITECH", identifiers: {}, variant: { identityLocks: { modelTokens: ["M170"], colors: ["NEGRO"], frame: "unspecified" } } };
const page = (blocks = [], extra = {}) => ({ url: "https://tienda.com.ar/productos/logitech-m170-negro", title: "Mouse Logitech M170 Negro", text: { type: "document", children: [{ type: "heading", level: 1, text: "Mouse Logitech M170 Negro" }, ...blocks] }, page_metadata: { other: { "product:price:currency": "ARS" } }, ...extra });
const paragraph = text => ({ type: "paragraph", text });

const repairIdentity = name => ({ id: "repair", name, identifiers: { barcodes: [{ value: "730143314558", valid: true }] }, variant: { isRepairPart: true, identityLocks: {} } });
const repairScope = (title, description = "") => productScope(page([], { text: { children: [{ type: "heading", level: 1, text: title }, paragraph("730143314558\nARS $ 5.000\n1 disponibles\n" + description)] } }));

test("el mismo teléfono no convierte una pantalla en tapa, batería o placa de carga", () => {
  for (const component of ["Tapa", "Bateria", "Placa de Carga"]) {
    const source = repairIdentity(component + " Motorola Moto Razr 60 XT2553 Original");
    const wrong = matchIdentity(source, repairScope("Modulo Pantalla Motorola Moto Razr 60 XT2553 Original", source.name));
    assert.equal(wrong.matchExact, false);
    assert.ok(wrong.conflicts.includes("repair_component:screen"));
    assert.equal(matchIdentity(source, repairScope(source.name)).matchExact, true);
  }
});

test("carcasa y placas de repuesto no heredan el precio de otra pieza o del equipo completo", () => {
  const housing = repairIdentity("Repuesto Carcasa Batea Yaxun YX-3060");
  assert.equal(matchIdentity(housing, repairScope("Batea Yaxun YX-3060", housing.name)).matchExact, false);
  assert.equal(matchIdentity(housing, repairScope("Repuesto Placa Digital Batea Yaxun YX-3060")).matchExact, false);
  assert.equal(matchIdentity(housing, repairScope(housing.name)).matchExact, true);
  const controller = repairIdentity("Repuesto Placa Controladora Yaxun YX-1502DD");
  assert.equal(matchIdentity(controller, repairScope("Repuesto Placa Digital Yaxun YX-1502DD")).matchExact, false);
  const plate = repairIdentity("Repuesto Plancha Separadora Sunshine SS-918K");
  assert.ok(matchIdentity(plate, repairScope("Plancha Separadora Sunshine SS-918K equipo completo")).missing.includes("standalone_repair_heating_plate"));
});

test("un repuesto scrap para despiece exige esa condición en su ficha primaria", () => {
  const source = repairIdentity("Repuesto Placa Digital Yaxun YX-3060 Scrap para Despiece");
  const wrong = matchIdentity(source, repairScope("Repuesto Placa Digital Yaxun YX-3060 Nueva", source.name));
  assert.equal(wrong.matchExact, false);
  assert.ok(wrong.missing.includes("scrap_dismantling_condition"));
  assert.equal(matchIdentity(source, repairScope(source.name)).matchExact, true);
});

test("repuestos Motorola distinguen Power, Lite, Plus y generación aun con GTIN compartido", () => {
  for (const [wanted, observed] of [["G9 Plus", "G9 Power"], ["G8 Power", "G8 Power Lite"], ["G8 Power", "G8 Comun"], ["G8 Plus", "G8 Power"], ["E6 Plus", "E7 Plus"], ["Edge 70", "Edge 70 Fusion"]]) {
    const source = repairIdentity("Placa de Carga Motorola Moto " + wanted);
    const result = matchIdentity(source, repairScope("Placa de Carga Motorola " + observed, source.name));
    assert.equal(result.matchExact, false);
    assert.ok(result.conflicts.some(value => value.startsWith("repair_device_model:")));
  }
  const source = repairIdentity("Placa de Carga Motorola Moto G8 Power Lite");
  assert.equal(matchIdentity(source, repairScope(source.name)).matchExact, true);
});

test("repuestos conservan compatibilidades explícitas y no confunden One Vision con Fusion", () => {
  const source = repairIdentity("Placa de Carga Motorola Moto E14 G04");
  assert.equal(matchIdentity(source, repairScope("Placa de Carga Motorola G04 / G04S / E14")).matchExact, true);
  assert.equal(matchIdentity(source, repairScope("Placa de Carga Motorola G04")).matchExact, false);
  const vision = repairIdentity("Placa de Carga Motorola Moto One Vision");
  assert.equal(matchIdentity(vision, repairScope("Placa de Carga Motorola One Fusion", vision.name)).matchExact, false);
  assert.equal(matchIdentity(vision, repairScope("Placa de Carga Motorola One Vision / One Action")).matchExact, true);
  assert.ok(matchIdentity(vision, repairScope("Placa de Carga Motorola", vision.name)).missing.includes("repair_device_model_in_primary_title"));
});

test("repuestos iPhone exigen generación completa y Pro/Max/Plus en la ficha primaria", () => {
  for (const [wanted, observed] of [["16 Pro", "13 Pro"], ["15 Pro", "15 Pro Max"], ["15", "15 Pro"], ["12 Pro Max", "12 / 12 Pro"], ["6S Plus", "6 Plus"]]) {
    const source = repairIdentity("Bateria iPhone " + wanted + " Foxconn");
    const result = matchIdentity(source, repairScope("Bateria iPhone " + observed + " Foxconn", source.name));
    assert.equal(result.matchExact, false);
    assert.ok(result.conflicts.some(value => value.startsWith("repair_device_model:")));
  }
  const source = repairIdentity("Bateria iPhone 15 Pro Max Foxconn");
  assert.equal(matchIdentity(source, repairScope(source.name)).matchExact, true);
});

test("teclado TKL no hereda una ficha Mini aunque comparta versión, frecuencia, MPN o GTIN", () => {
  const keyboard = { id: "nb-123830", name: "TECLADO GAMER RAZER HUNTSMAN V3 HE MAGNETIC SWITCH 8KHz TKL", identifiers: { manufacturerPartNumber: "RZ03-05920200-R3U1", barcodes: [{ value: "730143314558", valid: true }] }, variant: { identityLocks: { modelTokens: ["V3", "8KHZ"] } } };
  const keyboardPage = title => page([], { text: { children: [{ type: "heading", level: 1, text: title }, paragraph("MPN: RZ03-05920200-R3U1\n730143314558\nARS $ 189.211\n5 disponibles")] } });
  const wrong = normalizeReference(keyboard, keyboardPage("TECLADO RAZER HUNTSMAN V3 HE 8KHz MINI"));
  assert.equal(wrong.matchEvidence.matchExact, false);
  assert.ok(wrong.matchEvidence.conflicts.includes("keyboard_form_factor:MINI"));
  assert.equal(wrong.verifiedProductPrice, false);
  assert.equal(matchIdentity(keyboard, productScope(keyboardPage("TECLADO RAZER HUNTSMAN V3 HE 8KHz TKL"))).matchExact, true);
  const sf = { ...keyboard, name: "TECLADO DUCKY ONE 3 SF", variant: { identityLocks: {} } };
  assert.ok(matchIdentity(sf, productScope(keyboardPage("TECLADO DUCKY ONE 3 TKL"))).conflicts.includes("keyboard_form_factor:TKL"));
});

test("idioma explícito de teclado distingue español de US sin inferirlo de un código", () => {
  const keyboard = { id: "nb-121587", name: "TECLADO TRUST KEYRA ERGO MULTI WIRELESS ES", identifiers: { manufacturerPartNumber: "25704" }, variant: { identityLocks: {} } };
  const scope = title => productScope(page([], { text: { children: [{ type: "heading", level: 1, text: title }, paragraph("MPN: 25704")] } }));
  const wrong = matchIdentity(keyboard, scope("TECLADO TRUST KEYRA ERGO MULTI WIRELESS US"));
  assert.ok(wrong.conflicts.includes("keyboard_language:US"));
  assert.equal(wrong.matchExact, false);
  for (const language of ["ES", "Español", "SPANISH"]) assert.equal(matchIdentity(keyboard, scope("TECLADO TRUST KEYRA ERGO " + language)).matchExact, true);
  for (const language of ["US", "US-EN", "INGLÉS", "ENGLISH"]) assert.equal(matchIdentity({ ...keyboard, name: "TECLADO TRUST KEYRA US" }, scope("TECLADO TRUST KEYRA " + language)).matchExact, true);
  assert.ok(matchIdentity(keyboard, scope("TECLADO TRUST KEYRA ERGO")).missing.includes("keyboard_language:ES"));
});

test("frecuencia y versión genéricas no identifican un teclado sin modelo único", () => {
  for (const rating of ["120HZ", "8KHZ", "1000HZ"]) {
    const keyboard = { id: "generic", name: "TECLADO GAMER V3 " + rating, identifiers: {}, variant: { identityLocks: { modelTokens: ["V3", rating] } } };
    const scope = productScope(page([], { text: { children: [{ type: "heading", level: 1, text: keyboard.name }] } }));
    assert.ok(matchIdentity(keyboard, scope).missing.includes("unique_product_identifier"));
    const named = { ...keyboard, name: "TECLADO TRUST GXT868 US " + rating, variant: { identityLocks: { modelTokens: ["GXT868", rating] } } };
    const namedScope = productScope(page([], { text: { children: [{ type: "heading", level: 1, text: named.name }] } }));
    assert.equal(matchIdentity(named, namedScope).matchExact, true);
  }
});

test("lectura HTML de revisión no reemplaza hechos JSON ni cierra una lectura pendiente", () => {
  const url = page().url;
  const searches = [{ records: [{ id: identity.id, status: "indexed", results: [{ url }] }] }];
  const original = { urls: [url], observedAt: "2026-10-20T19:00:00Z", response: { results: [page([paragraph("ARS $ 10.000"), paragraph("En stock")])] } };
  const supplemental = { evidenceOnly: true, urls: [url], observedAt: "2026-10-20T20:00:00Z", response: { results: [{ url, format: "html", text: "<h1>Otro producto</h1><p>$ 1</p>" }] } };
  const before = buildResearchState({ identities: [identity], searches, fetchBatches: [original] });
  const after = buildResearchState({ identities: [identity], searches, fetchBatches: [original, supplemental] });
  assert.deepEqual(after.report.products[0].references, before.report.products[0].references);
  const alone = buildResearchState({ identities: [identity], searches, fetchBatches: [supplemental] });
  assert.equal(alone.report.products[0].references[0].status, "fetch_pending");
  assert.equal(alone.queue.length, 1);
});

const intelaidIdentity = { id: "nb-100674", name: "SOPORTE DE ESCRITORIO INTELAID 13/27 VESA 100X100 IT-DBGS", brand: null, identifiers: { manufacturerPartNumber: "IT-DBGS", barcodes: [{ value: "730143314558", valid: true }] }, variant: { identityLocks: { modelTokens: ["100X100", "IT-DBGS"] } } };
const intelaidScope = (title, extra = "") => productScope(page([], { text: { children: [{ type: "heading", level: 1, text: title }, paragraph("VESA 100X100. ARS $ 110.689. En stock."), paragraph(extra)] } }));

test("Intelaid: DBGS y DBSL permanecen distintos aun con tamaño VESA, MPN o GTIN compartido en descripción", () => {
  const result = matchIdentity(intelaidIdentity, intelaidScope("Soporte de escritorio Intelaid 13/27 VESA 100x100 IT-DBSL", "MPN: IT-DBGS\n730143314558"));
  assert.equal(result.matchExact, false);
  assert.ok(result.conflicts.includes("manufacturerPartNumber:IT-DBSL"));
  assert.equal(matchIdentity(intelaidIdentity, intelaidScope("Soporte de escritorio Intelaid 13/27 VESA 100x100 IT-DBGS")).matchExact, true);
  assert.ok(matchIdentity(intelaidIdentity, intelaidScope("Soporte Intelaid IT-DBGS / IT-DBSL")).missing.includes("multiple_primary_manufacturer_models"));
});

test("VESA y resolución genéricos no identifican por sí solos un producto", () => {
  for (const size of ["100X100", "400X400", "1920X1080", "VESA100X100"]) {
    const generic = { ...intelaidIdentity, identifiers: {}, variant: { identityLocks: { modelTokens: [size] } } };
    const result = matchIdentity(generic, intelaidScope("Soporte Intelaid " + size));
    assert.equal(result.matchExact, false);
    assert.ok(result.missing.includes("unique_product_identifier"));
  }
});

const cpuIdentity = (name = "PROCESADOR AMD (AM5) RYZEN 9 7900 (S/COOLER)") => ({ id: "nb-118094", name, brand: name.includes("INTEL") ? "INTEL" : "AMD", identifiers: { barcodes: [{ value: "730143314558", valid: true }] }, variant: { identityLocks: { modelTokens: name.includes("INTEL") ? ["LGA1700", "I7"] : ["AM5"] } } });
const cpuScope = title => productScope(page([], { text: { children: [{ type: "heading", level: 1, text: title }, paragraph("ARS $ 633.650"), paragraph("En stock. 730143314558")] } }));

test("CPU: cooler incluido no coincide con el 7900 sin cooler aunque comparta socket y GTIN", () => {
  const mismatch = matchIdentity(cpuIdentity(), cpuScope("Procesador AMD Ryzen 9 7900 AM5 Con Cooler"));
  assert.equal(mismatch.matchExact, false);
  assert.ok(mismatch.conflicts.includes("processor_cooler:with"));
  for (const phrase of ["Sin Cooler", "S/COOLER", "No incluye cooler"]) assert.equal(matchIdentity(cpuIdentity(), cpuScope("Procesador AMD Ryzen 9 7900 AM5 " + phrase)).matchExact, true);
  assert.ok(matchIdentity(cpuIdentity(), cpuScope("Procesador AMD Ryzen 9 7900 AM5")).missing.includes("processor_cooler:without"));
  assert.equal(matchIdentity(cpuIdentity("PROCESADOR AMD (AM5) RYZEN 9 7900 C/COOLER"), cpuScope("Procesador AMD Ryzen 9 7900 AM5 Sin Cooler")).matchExact, false);
});

test("CPU: modelo numérico completo y sufijo no se prueban sólo por AM5 o Core i7", () => {
  for (const observed of ["Ryzen 9 7950", "Ryzen 9 7900X", "Ryzen 7 7900"]) assert.ok(matchIdentity(cpuIdentity(), cpuScope(`Procesador AMD ${observed} AM5 Sin Cooler`)).conflicts.some(value => value.startsWith("processor_model:")));
  assert.ok(matchIdentity(cpuIdentity(), cpuScope("Procesador AMD AM5 Sin Cooler")).missing.includes("processor_model_in_primary_title"));
  const intel = cpuIdentity("PROCESADOR INTEL (LGA1700) CORE I7 12700");
  assert.equal(matchIdentity(intel, cpuScope("Procesador Intel Core i7-12700 LGA1700")).matchExact, true);
  assert.equal(matchIdentity(intel, cpuScope("Procesador Intel Core i7 12700F LGA1700")).matchExact, false);
  assert.equal(matchIdentity(intel, cpuScope("Procesador Intel Core i7 LGA1700")).matchExact, false);
});

test("CPU: Core Ultra Plus es parte del modelo y una ficha sin Plus queda en conflicto", () => {
  const ultra = { ...cpuIdentity("PROCESADOR INTEL (LGA1851) CORE ULTRA 5 250K PLUS"), variant: { identityLocks: {} } };
  assert.equal(matchIdentity(ultra, cpuScope("Procesador Intel Core Ultra 5 250K Plus LGA1851")).matchExact, true);
  assert.equal(matchIdentity(ultra, cpuScope("Procesador Intel Core Ultra 5 250K LGA1851")).matchExact, false);
});

test("CPU: la condición del cooler también se comprueba para Pentium", () => {
  const pentium = { ...cpuIdentity("PROCESADOR INTEL PENTIUM DUAL CORE G4400 (SIN COOLER)"), variant: { identityLocks: { modelTokens: ["G4400"] } } };
  assert.equal(matchIdentity(pentium, cpuScope("Procesador Intel Pentium G4400 Sin Cooler")).matchExact, true);
  const mismatch = matchIdentity(pentium, cpuScope("Procesador Intel Pentium G4400 Con Cooler"));
  assert.equal(mismatch.matchExact, false);
  assert.ok(mismatch.conflicts.includes("processor_cooler:with"));
});

test("wrapper bot_blocked es bloqueo definitivo, sin reintento ni precio", () => {
  assert.deepEqual(fetchFailure({ error: "bot_blocked" }), { status: "blocked", retryable: false, retryAfterSeconds: null });
  const result = normalizeReference(identity, { url: "https://tienda.com.ar/producto/m170", error: "bot_blocked" }, "2026-10-20T19:15:00Z");
  assert.equal(result.status, "blocked");
  assert.equal(result.retryable, false);
  assert.equal(result.verifiedProductPrice, false);
});

test("URLs públicas y parámetros de variante se conservan; rastreo se elimina", () => {
  assert.equal(canonicalUrl("https://tienda.com.ar/producto?a=1&variant=2&utm_source=x&srsltid=z#info"), "https://tienda.com.ar/producto?a=1&variant=2");
  for (const url of ["http://127.0.0.1/x", "file:///c:/x", "https://user:password@tienda.com.ar/p"]) assert.equal(canonicalUrl(url), null);
  for (const url of ["https://www.nb.com.ar/p", "https://listado.mercadolibre.com.ar/p", "https://instagram.com/p/x", "https://hardgamers.com.ar/product/x", "https://tienda.com.ar/?s=mouse", "https://tienda.com.ar/catalogo/"]) assert.equal(classifyCandidateUrl(url).eligible, false);
  assert.equal(classifyCandidateUrl("https://tienda.com.ar/categoria-producto/perifericos").eligible, false);
  assert.equal(classifyCandidateUrl("https://tienda.com.ar/catalogo/17008-mouse-logitech").eligible, true);
});

const purchaseUrls = ["https://pccompra.com.ar/outlet-memoria-generica-ddr-1gb/?add-to-cart=26772", "https://pccompra.com.ar/outlet-auricular-gamer-razer-tiamat-2-2-v2-analog/?add-to-cart=26680"];

test("formularios de aviso de stock no son fichas elegibles ni evidencia pública", () => {
  for (const url of ["https://www.zonamovilexpress.com/back_in_stock/19716590?variant_id=19716590", "https://tienda.com.ar/back-in-stock/123", "https://tienda.com.ar/%2562ack%255fin%255fstock/123", "https://tienda.com.ar/producto/x?back_in_stock=1"]) {
    assert.equal(classifyCandidateUrl(url).reason, "purchase_cart_or_mutation_action_url");
    assert.equal(selectCandidates({ results: [{ url }] }).accepted.length, 0);
    assert.equal(normalizeReference(identity, page([paragraph("ARS $ 5.000\n1 disponibles")], { url })).status, "unsafe_action_url");
  }
});

test("regresión PCCompra: rechaza ambos add-to-cart íntegros sin convertirlos a fichas limpias", () => {
  for (const url of purchaseUrls) {
    const classified = classifyCandidateUrl(url);
    assert.equal(classified.eligible, false);
    assert.equal(classified.reason, "purchase_cart_or_mutation_action_url");
    assert.equal(classified.url, url);
    assert.equal(canonicalUrl(url), url);
    assert.equal(classifyCandidateUrl(url.split("?")[0]).eligible, true);
  }
});

test("acciones codificadas, mayúsculas, variantes y endpoints de carrito/checkout se rechazan", () => {
  for (const suffix of ["?ADD_to_CART=1", "?%61dd%2Dto%2Dcart=1", "?%2561dd%252dto%252dcart=1", "?buy-now=1", "?BUY_NOW=1", "?remove_item=abc", "?remove%255Fitem=abc", "?aCtIoN=add_to_cart", "?action%5Bname%5D=checkout", "?WC%2DAJAX=add_to_cart", "?wc_ajax=get_refreshed_fragments", "?update_cart=1", "?empty-cart=1"]) {
    assert.equal(classifyCandidateUrl("https://tienda.com.ar/producto/mouse" + suffix).reason, "purchase_cart_or_mutation_action_url", suffix);
  }
  for (const path of ["/cart/", "/CaRt/", "/%63art/", "/%2563art/", "/checkout/", "/shop/checkout/order-pay/123", "/carrito/", "/finalizar-compra/", "/wc/store/v1/cart/add-item", "/buy-now/123", "/cart.php"]) assert.equal(classifyCandidateUrl("https://tienda.com.ar" + path).reason, "purchase_cart_or_mutation_action_url", path);
  const safe = classifyCandidateUrl("https://tienda.com.ar/producto/cartucho-hp?variant=2&attribute_pa_color=negro&utm_source=research#detalle");
  assert.equal(safe.eligible, true);
  assert.equal(safe.url, "https://tienda.com.ar/producto/cartucho-hp?variant=2&attribute_pa_color=negro");
});

test("selección y plan excluyen acciones aun en una cola previa; no inventan URL sin parámetros", () => {
  const safe = "https://tienda.com.ar/productos/logitech-m170-negro?variant=2";
  const selected = selectCandidates({ results: [...purchaseUrls, safe].map(url => ({ url })) });
  assert.deepEqual(selected.accepted.map(row => row.url), [safe]);
  assert.equal(selected.rejected.length, 2);
  const searches = [{ records: [{ id: identity.id, status: "indexed", results: [...purchaseUrls, safe].map(url => ({ url })) }] }];
  const state = buildResearchState({ identities: [identity], searches, fetchBatches: [] });
  const plan = planFetches(state);
  assert.deepEqual(plan.jobs.flatMap(job => job.urls), [safe]);
  assert.equal(state.report.products[0].rejected.length, 2);
  const stale = planFetches({ queue: [...purchaseUrls, safe].map(url => ({ url, attempt: 1, productIds: [identity.id] })), report: { summary: {} } });
  assert.deepEqual(stale.jobs.flatMap(job => job.urls), [safe]);
  assert.equal(stale.queueRemaining, 1);
});

test("normalización rechaza URL de origen o redirección de acción antes de precio, stock o retry", () => {
  const safe = page().url;
  for (const action of purchaseUrls) for (const [url, final_url] of [[safe, action], [action, safe], [action, action]]) {
    const result = normalizeReference(identity, page([paragraph("ARS $ 20.000"), paragraph("En stock")], { url, final_url }), "2026-10-20T19:00:00Z");
    assert.equal(result.status, "unsafe_action_url");
    assert.equal(result.matchExact, false);
    assert.equal(result.verifiedProductPrice, false);
    assert.equal(result.priceARS, undefined);
    assert.equal(result.retryable, false);
  }
  const error = normalizeReference(identity, { url: safe, final_url: purchaseUrls[0], status: 429, error: "target_http_error" }, "2026-10-20T19:00:00Z");
  assert.equal(error.status, "unsafe_action_url"); assert.equal(error.retryable, false);
});

test("runner detiene un plan antiguo inseguro antes de llamar Fetch o guardar observaciones", async () => {
  let calls = 0, saves = 0;
  await assert.rejects(executeFetchPlan({ jobs: [{ urls: [page().url], fetchArgs: {} }, { urls: purchaseUrls, fetchArgs: {} }] }, { fetchContent: async () => { calls++; return { results: [] }; }, saveBatch: async () => { saves++; } }), /URL de acci[oó]n/);
  assert.equal(calls, 0); assert.equal(saves, 0);
});

test("dos candidatos por producto y dedupe canónico sin usar precios del índice", () => {
  const record = { storeResults: [{ url: "https://tienda.com.ar/producto?utm_source=x", snippet: "$1" }, { url: "https://tienda.com.ar/producto" }, { url: "https://otra.com.ar/ficha-123" }, { url: "https://tercera.com.ar/item/1" }] };
  const selected = selectCandidates(record);
  assert.equal(selected.accepted.length, 2);
  assert.equal(selected.accepted[0].priceARS, undefined);
});

test("corta relacionados y nunca toma el precio de otra tarjeta", () => {
  const scoped = productScope(page([paragraph("Sin stock"), { type: "heading", level: 2, text: "Productos relacionados" }, paragraph("Otro mouse $ 2.000 En stock")]));
  assert.equal(scoped.text.includes("2.000"), false);
  assert.equal(extractPrice(page([paragraph("Sin stock"), { type: "heading", level: 2, text: "Productos relacionados" }, paragraph("Otro mouse $ 2.000 En stock")])).priceARS, null);
});

test("corta más productos y tarjetas sin rótulo; retira el stock de la tarjeta ajena", () => {
  const scoped = productScope(page([paragraph("SKU 123"), { type: "heading", level: 6, text: "24192 En stock" }, { type: "heading", level: 4, text: "TECLADO GENIUS NUMERICO" }, paragraph("$ 20000")]));
  assert.equal(scoped.text.includes("En stock"), false);
  assert.equal(scoped.priceText.includes("20000"), false);
  const labelled = productScope(page([{ type: "heading", level: 2, text: "Más productos de esta categoría" }, paragraph("$ 30000")]));
  assert.equal(labelled.priceText.includes("30000"), false);
});

test("no usa precios sin nodo h1 ni convierte dólar a ARS", () => {
  assert.equal(extractPrice(page([], { text: { children: [paragraph("$ 90000")] } })).priceARS, null);
  assert.equal(extractPrice(page([paragraph("USD $ 20")])).priceARS, null);
  assert.equal(extractPrice(page([paragraph("$ 20.000")], { page_metadata: {} })).status, "currency_unconfirmed");
});

test("distingue precio total, impuesto neto, cuota y envío", () => {
  const result = extractPrice(page([paragraph("Precio $ 20.000,50"), paragraph("Precio sin impuestos $ 18.100"), paragraph("6 cuotas de $ 4.000"), paragraph("Envío $ 3.000")]));
  assert.equal(result.priceARS, 20000.5);
  assert.deepEqual(result.visibleCandidates.map(x => x.role), ["offer_unlabelled", "tax_excluded", "installment", "shipping"]);
});

test("discrepancia metadato-visible se conserva como conflicto", () => {
  const result = extractPrice(page([paragraph("$ 20.000")], { page_metadata: { other: { "product:price:currency": "ARS", "product:price:amount": "21000" } } }));
  assert.equal(result.status, "price_conflict");
  assert.equal(result.priceARS, null);
});

test("neto s/imp y ahorro no se tratan como precio final", () => {
  const result = extractPrice(page([paragraph("ARS"), paragraph("Precio s/imp. nac. $ 10.000"), paragraph("Ahorrás $ 2.000")], { page_metadata: { other: { "product:price:currency": "ARS", "product:price:amount": "12100" } } }));
  assert.equal(result.conflict, false);
  assert.equal(result.priceARS, 12100);
});

test("variante: modelo y color deben verse, M1700 no equivale a M170", () => {
  assert.equal(matchIdentity(identity, productScope(page([paragraph("En stock")]))).matchExact, true);
  assert.equal(matchIdentity(identity, productScope(page([], { text: { children: [{ type: "heading", level: 1, text: "Mouse Logitech M1700 Negro" }] } }))).matchExact, false);
  assert.equal(matchIdentity(identity, productScope(page([], { text: { children: [{ type: "heading", level: 1, text: "Mouse Logitech M170 Blanco" }] } }))).matchExact, false);
});

test("GTIN aislado nunca anula el bloqueo de AA versus AAA", () => {
  const item = { id: "battery", name: "Pila AAA", brand: "TEST", identifiers: { barcodes: [{ value: "1234567890123", valid: true }] }, variant: { identityLocks: { batteryFormats: ["AAA"] } } };
  const result = matchIdentity(item, productScope(page([paragraph("EAN 1234567890123")], { text: { children: [{ type: "heading", level: 1, text: "Pila TEST AA" }, paragraph("EAN 1234567890123")] } })));
  assert.equal(result.matchExact, false);
  assert.ok(result.conflicts.includes("AAA_vs_AA"));
});

const memoryIdentity = (mpn = "AX5U5600C468G-SLABBK") => ({ id: "nb-123887", name: "MEMORIA ADATA DDR5 8GB 5600MHz XPG LANCER BLADE BLACK", brand: "ADATA", identifiers: { manufacturerPartNumber: mpn, barcodes: [{ value: "4711085947987", valid: true }] }, variant: { identityLocks: { modelTokens: ["DDR5", "8GB", "5600MHZ"], capacitiesAndElectricalRatings: ["8GB", "5600MHZ"], colors: ["BLACK"], frame: "unspecified" } } });
const memoryPage = (...fields) => page([paragraph("ARS $ 249.299"), paragraph("Solo quedan 10 disponibles"), ...fields.map(paragraph)], { text: { type: "document", children: [{ type: "heading", level: 1, text: "Memoria Adata DDR5 8GB 5600MHz XPG Lancer Blade Black RGB" }, paragraph("ARS $ 249.299"), paragraph("Solo quedan 10 disponibles"), ...fields.map(paragraph)] } });

test("regresión ADATA no RGB no coincide con SKU fabricante RGB aunque DDR5 o GTIN coincidan", () => {
  const candidate = memoryPage("SKU: AX5U5600C468G-SLABRBK | ID: 141837", "EAN 4711085947987");
  const result = normalizeReference(memoryIdentity(), candidate, "2026-10-20T16:30:00Z");
  assert.equal(result.matchExact, false);
  assert.equal(result.verifiedProductPrice, false);
  assert.equal(result.status, "variant_conflict");
  assert.ok(result.matchEvidence.conflicts.includes("manufacturerPartNumber:AX5U5600C468G-SLABRBK"));
  assert.equal(result.matchEvidence.manufacturerCodes[0].basis, "same_manufacturer_code_family");
});

test("MPN coincidente y SKU interno ajeno no generan conflicto de fabricante", () => {
  const result = matchIdentity(memoryIdentity("AX5U5600C468G-SLABRBK"), productScope(memoryPage("MPN: AX5U5600C468G-SLABRBK", "SKU: SHOP-141837", "Part number CPU")));
  assert.equal(result.matchExact, true);
  assert.equal(result.manufacturerCodes.find(x => x.value === "SHOP-141837").comparable, false);
  assert.equal(result.conflicts.length, 0);
});

test("DDR4/DDR5 y otros tipos de memoria no son identificadores únicos", () => {
  for (const type of ["DDR4", "DDR5", "LPDDR5X", "GDDR6X"]) {
    const source = { ...memoryIdentity(), identifiers: {}, variant: { identityLocks: { modelTokens: [type, "8GB", "5600MHZ"], colors: ["BLACK"] } } };
    const result = matchIdentity(source, productScope(page([], { text: { children: [{ type: "heading", level: 1, text: `Memoria Adata ${type} 8GB 5600MHz Black` }] } })));
    assert.equal(result.matchExact, false);
    assert.ok(result.missing.includes("unique_product_identifier"));
  }
});

test("MPN explícito distinto bloquea GTIN; SKU interno sin atribución prefiere sin confirmar", () => {
  const conflict = matchIdentity(memoryIdentity(), productScope(memoryPage("MPN: OTHER12345", "EAN: 4711085947987")));
  assert.equal(conflict.matchExact, false);
  assert.ok(conflict.conflicts.includes("manufacturerPartNumber:OTHER12345"));
  const unconfirmed = matchIdentity(memoryIdentity(), productScope(memoryPage("SKU: SHOP-141837")));
  assert.equal(unconfirmed.matchExact, false);
  assert.equal(unconfirmed.status, "variant_unconfirmed");
  assert.equal(unconfirmed.conflicts.length, 0);
});

const motherboardIdentity = mpn => {
  const asrock = mpn.startsWith("A620M");
  return { id: asrock ? mpn.endsWith("+") ? "nb-119769" : "nb-118193" : mpn.endsWith("GEN5") ? "nb-123952" : "nb-120656", name: `MOTHER ${mpn}`, brand: asrock ? "ASROCK" : "GIGABYTE", identifiers: { manufacturerPartNumber: mpn, barcodes: [{ value: "4719331880040", valid: true }] }, variant: { identityLocks: { modelTokens: asrock ? ["A620M-HDV", "AM5", "M.2"] : ["H810M", ...(mpn.endsWith("GEN5") ? ["GEN5"] : [])] } } };
};
const motherboardPage = (mpn, ...fields) => page([], { text: { children: [{ type: "heading", level: 1, text: `Mother ${mpn.startsWith("A620M") ? "ASROCK AM5" : "Gigabyte"} ${mpn}` }, paragraph("ARS $ 100.000"), paragraph("En stock"), ...fields.map(paragraph)] } });

test("regresión ASRock M.2 y M.2+ son identidades distintas aun con M2 o GTIN en descripción", () => {
  for (const [source, observed] of [["A620M-HDV/M.2", "A620M-HDV/M.2+"], ["A620M-HDV/M.2+", "A620M-HDV/M.2"]]) {
    for (const field of [[], [`SKU: ${observed}`], [`MPN: ${observed}`]]) {
      const result = normalizeReference(motherboardIdentity(source), motherboardPage(observed, ...field, "Formato M2", "EAN 4719331880040"), "2026-10-20T18:00:00Z");
      assert.equal(result.matchExact, false, `${source} / ${observed} / ${field}`);
      assert.equal(result.verifiedProductPrice, false);
      assert.equal(result.status, "variant_conflict");
      assert.ok(result.matchEvidence.conflicts.includes("manufacturerPartNumber:" + observed));
      if (field.length) assert.equal(result.matchEvidence.manufacturerCodes[0].value, observed);
    }
  }
});

test("regresión H810M K y H810M K GEN5 no coinciden por un prefijo o GEN5 descriptivo", () => {
  for (const [source, observed] of [["H810M K", "H810M K GEN5"], ["H810M K GEN5", "H810M K"]]) {
    for (const field of [[], [`SKU: ${observed}\nGarantía: 12 meses`], [`Modelo: ${observed}`]]) {
      const result = matchIdentity(motherboardIdentity(source), productScope(motherboardPage(observed, ...field, "Soporta componentes GEN5", "EAN 4719331880040")));
      assert.equal(result.matchExact, false);
      assert.ok(result.conflicts.includes("manufacturerPartNumber:" + observed));
      if (field.length) assert.equal(result.manufacturerCodes[0].value, observed);
    }
  }
  const joined = matchIdentity(motherboardIdentity("H810M K"), productScope(motherboardPage("H810MKGEN5")));
  assert.equal(joined.matchExact, false);
});

test("regresión GamingCity: H810M H no hereda el precio 156655 de la ficha H810M K UD", () => {
  const source = { ...motherboardIdentity("H810M H"), id: "nb-120655", identifiers: { manufacturerPartNumber: "H810M H", barcodes: [{ value: "4719331869540", valid: true }] } };
  const cachedPage = page([], { url: "https://www.gamingcity.com.ar/mothers-intel-mother-gigabyte-h810m-k-ddr5-lga1851--det--17519", title: "Gamingcity Computación | Especialistas En Computadoras | ", text: { children: [{ type: "heading", level: 1, text: "Motherboard Gigabyte H810M K Ud Ddr5 Lga1851" }, { type: "heading", level: 3, text: "En stock" }, { type: "heading", level: 3, text: "2 Disponibles" }, paragraph("Precio especial 0 % Off: $ 156.655"), paragraph("La Gigabyte H810M K UD es una motherboard Micro-ATX compatible con Intel LGA1851 y memorias DDR5.")] }, page_metadata: { other: { "product:price:currency": "ARS", "product:price:amount": "156655" } } });
  const wrong = normalizeReference(source, cachedPage, "2026-10-20T17:31:39.973Z");
  assert.equal(wrong.priceCandidateARS, 156655);
  assert.equal(wrong.matchExact, false);
  assert.equal(wrong.verifiedProductPrice, false);
  assert.equal(wrong.status, "variant_conflict");
  assert.ok(wrong.matchEvidence.conflicts.includes("manufacturerPartNumber:H810M K"));
  const correct = normalizeReference(motherboardIdentity("H810M K"), cachedPage, "2026-10-20T17:31:39.973Z");
  assert.equal(correct.verifiedProductPrice, true);
  assert.equal(correct.priceARS, 156655);
});

test("rama completa H/H y K/K es exacta; otra rama o familia sola no se confirma por GTIN", () => {
  for (const branch of ["H", "K"]) {
    const source = motherboardIdentity("H810M " + branch);
    assert.equal(matchIdentity(source, productScope(motherboardPage("H810M " + branch, "SKU: SHOP-141837"))).matchExact, true);
    const other = branch === "H" ? "K" : "H";
    const wrong = matchIdentity(source, productScope(motherboardPage("H810M " + other, "EAN 4719331880040", "SKU: SHOP-141837")));
    assert.equal(wrong.matchExact, false);
    assert.ok(wrong.conflicts.includes("manufacturerPartNumber:H810M " + other));
    const incomplete = matchIdentity(source, productScope(motherboardPage("H810M DDR5", "EAN 4719331880040")));
    assert.equal(incomplete.matchExact, false);
    assert.equal(incomplete.status, "variant_unconfirmed");
    assert.ok(incomplete.missing.includes("primary_manufacturer_part_number"));
  }
});

test("códigos idénticos con + y espacios permanecen exactos y no absorben campos siguientes", () => {
  for (const mpn of ["A620M-HDV/M.2", "A620M-HDV/M.2+", "H810M K", "H810M K GEN5"]) {
    const result = matchIdentity(motherboardIdentity(mpn), productScope(motherboardPage(mpn, `MPN: ${mpn}\nGarantía: 12 meses`, "SKU: SHOP 141837", `SKU: ${mpn} | Stock: 10`)));
    assert.equal(result.matchExact, true, mpn);
    assert.equal(result.conflicts.length, 0);
    assert.deepEqual(result.manufacturerCodes.filter(x => x.matches).map(x => x.value), [mpn, mpn]);
    assert.equal(result.manufacturerCodes[1].comparable, false);
    assert.equal(result.manufacturerCodes[1].unconfirmed, false);
  }
});

test("MPN o SKU de la misma familia con prosa sin delimitar queda sin confirmar sin truncar", () => {
  for (const label of ["MPN", "SKU"]) {
    const result = matchIdentity(motherboardIdentity("H810M K"), productScope(motherboardPage("H810M K", `${label}: H810M K GEN5 descripcion para computadoras`)));
    assert.equal(result.matchExact, false);
    assert.equal(result.status, "variant_unconfirmed");
    assert.ok(result.missing.includes("manufacturer_part_number_field_unconfirmed"));
    assert.equal(result.manufacturerCodes[0].value, null);
    assert.equal(result.manufacturerCodes[0].comparable, false);
  }
});

test("revisión explícita no declarada por la fuente queda sin confirmar", () => {
  const result = matchIdentity(motherboardIdentity("H810M K"), productScope(motherboardPage("H810M K rev. 2.0", "SKU: H810M K REV. 2.0")));
  assert.equal(result.matchExact, false);
  assert.equal(result.status, "variant_unconfirmed");
  assert.ok(result.missing.includes("manufacturer_part_number_revision_unconfirmed"));
  assert.equal(result.conflicts.length, 0);
});

test("SKU multicomponente conserva palabras del código y no convierte un combo en producto único", () => {
  const source = { id: "power", name: "Fuente Gigabyte", brand: "GIGABYTE", identifiers: { manufacturerPartNumber: "GP-UD850GM PG5 ICE" }, variant: { identityLocks: { modelTokens: ["GP-UD850GM"] } } };
  const complete = matchIdentity(source, productScope(page([], { text: { children: [{ type: "heading", level: 1, text: "Fuente Gigabyte GP-UD850GM PG5 ICE" }, paragraph("SKU: NB_GP-UD850GM PG5 ICE | Stock: 10")] } })));
  assert.equal(complete.matchExact, true);
  assert.equal(complete.manufacturerCodes[0].value, "NB_GP-UD850GM PG5 ICE");
  assert.equal(complete.manufacturerCodes[0].comparable, false);
  const combo = matchIdentity(source, productScope(page([], { text: { children: [{ type: "heading", level: 1, text: "Combo Gigabyte GP-UD850GM PG5 ICE" }, paragraph("SKU: GP-UD850GM PG5 ICE + GPU12345")] } })));
  assert.equal(combo.matchExact, false);
  assert.ok(combo.missing.includes("manufacturer_part_number_field_unconfirmed"));
  assert.equal(combo.manufacturerCodes[0].value, null);
});

test("rótulos de compatibilidad y prosa de SKU interno no se atribuyen al fabricante", () => {
  const source = { id: "nb-7762", name: "Toner Cromink HP CB543A", brand: "CROMINK", identifiers: { manufacturerPartNumber: "CB543A" }, variant: { identityLocks: { modelTokens: ["CB543A"] } } };
  const result = normalizeReference(source, page([], { text: { children: [{ type: "heading", level: 1, text: "Toner Alternativo Cromink HP CB543A Magenta" }, paragraph("ARS $ 50.000"), paragraph("En stock"), paragraph("SKU: CB543A | ID: 36080"), paragraph("SKU Original HP: CB543A"), paragraph("Modelo OEM que reemplaza: HP CB543A"), paragraph("SKU: NB_CB543A Las imagenes son ilustrativas.")] } }), "2026-10-20T18:00:00Z");
  assert.equal(result.verifiedProductPrice, true);
  assert.equal(result.matchEvidence.manufacturerCodes[0].value, "CB543A");
  assert.equal(result.matchEvidence.manufacturerCodes.length, 2);
  assert.equal(result.matchEvidence.manufacturerCodes[1].unconfirmed, false);
  const spaced = { ...motherboardIdentity("H510 PROBTC+"), brand: "ASROCK", variant: { identityLocks: { modelTokens: ["H510"] } } };
  assert.equal(matchIdentity(spaced, productScope(page([], { text: { children: [{ type: "heading", level: 1, text: "Mother ASRock H510 PRO BTC+" }] } }))).matchExact, true);
});

test("una lista de colores de otras variantes no confirma el color seleccionado", () => {
  const result = matchIdentity(identity, productScope(page([], { text: { children: [{ type: "heading", level: 1, text: "Mouse Logitech M170 Blanco" }, paragraph("Colores disponibles: Negro Blanco Azul")] } })));
  assert.equal(result.matchExact, false);
  assert.ok(result.conflicts.some(x => x.startsWith("color:")));
});

test("HTTP200 no se interpreta como error y condición outlet no equivale a producto nuevo", () => {
  const result = normalizeReference(identity, page([paragraph("ARS $ 20.000"), paragraph("En stock")], { status_code: 200 }), "2026-10-20T00:00:00Z");
  assert.equal(result.verifiedProductPrice, true);
  const outlet = normalizeReference({ ...identity, category: "Outlet" }, page([paragraph("ARS $ 20.000"), paragraph("En stock")]), "2026-10-20T00:00:00Z");
  assert.equal(outlet.matchExact, false);
});

test("403/captcha no se reintentan; 429 respeta backoff", () => {
  assert.deepEqual(fetchFailure("403 Forbidden"), { status: "blocked", retryable: false, retryAfterSeconds: null });
  assert.equal(fetchFailure("CAPTCHA").retryable, false);
  assert.equal(fetchFailure("429 rate limit retry in 45s").retryAfterSeconds, 45);
});

test("un precio con stock y modelo verificables no verifica envío final", () => {
  const result = normalizeReference(identity, page([paragraph("ARS $ 20.000"), paragraph("En stock")]), "2026-10-20T00:00:00Z");
  assert.equal(result.verifiedProductPrice, true);
  assert.equal(result.verifiedDeliveredPrice, false);
  assert.equal(result.shipping.confirmed, false);
});

test("todos los IDs tienen estado aunque aún no se buscaron; URL compartida no fusiona productos", () => {
  const second = { ...identity, id: "test-2", variant: { identityLocks: { modelTokens: ["M170"], colors: ["BLANCO"] } } };
  const searches = [{ records: [identity, second].map(x => ({ id: x.id, status: "indexed", researchedAt: "2026-10-20", results: [{ url: page().url }] })) }];
  const state = buildResearchState({ identities: { products: [identity, second, { ...identity, id: "unsearched" }] }, searches, fetchBatches: [] });
  assert.equal(state.report.products.length, 3);
  assert.equal(state.queue.length, 1);
  assert.equal(state.queue[0].productIds.length, 2);
  assert.equal(state.report.summary.notSearchedProducts, 1);
  assert.equal(planFetches(state).jobs[0].fetchArgs.ttl, 0);
  assert.equal(planFetches(state).paidAutomationAllowed, false);
});

test("429 se reintenta como máximo dos veces y no mezcla contadores de intentos", () => {
  const searches = [{ records: [{ id: identity.id, status: "indexed", results: [{ url: page().url }] }] }];
  const batch = attempts => ({ urls: [page().url], observedAt: "2026-10-20T00:00:00Z", attempts, response: { results: [], errors: [{ url: page().url, error: "429 rate limit retry in 30s" }] } });
  const before = buildResearchState({ identities: [identity], searches, fetchBatches: [batch(1)], now: Date.parse("2026-10-20T00:00:10Z") });
  assert.equal(before.queue.length, 0);
  const retry = buildResearchState({ identities: [identity], searches, fetchBatches: [batch(2)], now: Date.parse("2026-10-20T00:01:00Z") });
  assert.equal(retry.queue[0].attempt, 3);
  assert.equal(buildResearchState({ identities: [identity], searches, fetchBatches: [batch(3)], now: Date.parse("2026-10-20T00:01:00Z") }).queue.length, 0);
  const mixed = planFetches({ queue: [{ url: "https://a.com.ar/p", attempt: 1, productIds: ["a"] }, { url: "https://b.com.ar/p", attempt: 2, productIds: ["b"] }], report: { summary: {} } });
  assert.equal(mixed.jobs.length, 2);
  assert.deepEqual(mixed.jobs.map(x => x.attempts), [1, 2]);
});

test("regresión wrapper real target_http_error preserva HTTP429 y metadata Retry-After", () => {
  const url = "https://practicaltecno.com.ar/productos/fuente-gamer-gigabyte-1000w-pg5-ice-80-plus-gold-full-modular";
  const searches = [{ records: [{ id: identity.id, status: "indexed", results: [{ url }] }] }];
  const observedAt = "2026-10-20T16:19:42Z";
  const batch = (attempts, extra = {}) => ({ urls: [url], observedAt, attempts, response: { content: [{ type: "text", text: JSON.stringify({ results: [], errors: [{ url, error: "target_http_error", status: 429, ...extra }] }) }] } });
  const state = (attempts, extra, now) => buildResearchState({ identities: [identity], searches, fetchBatches: [batch(attempts, extra)], now: Date.parse(now) });
  const first = state(1, {}, "2026-10-20T16:20:41Z");
  assert.equal(first.report.products[0].references[0].status, "rate_limited");
  assert.equal(first.report.products[0].references[0].retryAfterSeconds, 60);
  assert.equal(first.queue.length, 0);
  assert.equal(state(1, {}, "2026-10-20T16:20:42Z").queue[0].attempt, 2);
  assert.equal(state(2, { headers: { "Retry-After": "120" } }, "2026-10-20T16:21:41Z").queue.length, 0);
  assert.equal(state(2, { headers: { "Retry-After": "120" } }, "2026-10-20T16:21:42Z").queue[0].attempt, 3);
  assert.equal(state(3, {}, "2026-10-20T16:30:00Z").queue.length, 0);
  for (const status of [401, 403]) {
    const blocked = state(1, { status }, "2026-10-20T16:30:00Z");
    assert.equal(blocked.report.products[0].references[0].status, "blocked");
    assert.equal(blocked.queue.length, 0);
  }
  assert.equal(fetchFailure({ error: "target_http_error", status: 429, retry_after_seconds: 15 }).retryAfterSeconds, 15);
  assert.equal(fetchFailure({ error: "target_http_error", status: 429, headers: { "Retry-After": "Tue, 20 Oct 2026 16:21:42 GMT" } }, Date.parse(observedAt)).retryAfterSeconds, 120);
  assert.equal(normalizeReference(identity, { url, error: { status: 429, retry_after: 90, message: "target_http_error" } }, observedAt).retryAfterSeconds, 90);
});

test("runner conserva HTTP429 como campo sibling en error y result sin perder bloqueos", async () => {
  const urls = ["https://tienda.com.ar/rate", "https://tienda.com.ar/blocked"];
  const saved = [], waits = [];
  await executeFetchPlan({ jobs: [{ urls, fetchArgs: {} }] }, {
    fetchContent: async args => ({ results: args.urls.filter(url => url.endsWith("rate")).map(url => ({ url, error: "target_http_error", status: 429, retry_after: 5 })), errors: args.urls.filter(url => url.endsWith("blocked")).map(url => ({ url, error: "target_http_error", status: 403 })) }),
    saveBatch: async batch => saved.push(batch), delay: async ms => waits.push(ms)
  });
  assert.equal(saved.length, 3);
  assert.deepEqual(saved.map(x => x.urls.length), [2, 1, 1]);
  assert.deepEqual(waits, [5000, 5000]);
});

test("extrae wrapper MCP sin interpretar su texto como instrucciones", () => {
  assert.deepEqual(unwrapToolResponse({ content: [{ type: "text", text: '{"results":[],"errors":[]}' }] }), { results: [], errors: [] });
});

test("el runner limita concurrencia a cuatro y obliga JSON fresco gratuito", async () => {
  let active = 0, peak = 0;
  const saved = [];
  const jobs = Array.from({ length: 9 }, (_, i) => ({ urls: [`https://tienda.com.ar/item/${i}`], attempts: 1, fetchArgs: {} }));
  const stats = await executeFetchPlan({ jobs }, { fetchContent: async args => {
    active++; peak = Math.max(peak, active);
    assert.equal(args.format, "json"); assert.equal(args.ttl, 0);
    await new Promise(resolveDelay => setTimeout(resolveDelay, 1));
    active--;
    return { results: args.urls.map(url => ({ ...page([paragraph("ARS $ 20.000")]), url })), errors: [] };
  }, saveBatch: async batch => saved.push(batch) });
  assert.equal(peak, 4);
  assert.equal(saved.length, 9);
  assert.equal(stats.toolCalls, 9);
});

test("runner reintenta sólo URLs con 429, máximo dos, y conserva cada checkpoint", async () => {
  let calls = 0;
  const saved = [], waits = [];
  const urls = ["https://tienda.com.ar/blocked", "https://tienda.com.ar/rate"];
  const stats = await executeFetchPlan({ jobs: [{ urls, fetchArgs: {} }] }, { fetchContent: async args => {
    calls++;
    return { results: [], errors: args.urls.map(url => ({ url, error: url.includes("blocked") ? "403 Forbidden" : "429 Retry in 31s" })) };
  }, saveBatch: async batch => saved.push(batch), delay: async ms => waits.push(ms) });
  assert.equal(calls, 3); assert.equal(stats.rateRetries, 2);
  assert.equal(saved[0].urls.length, 2); assert.equal(saved[1].urls.length, 1);
  assert.equal(saved[2].attempts, 3);
  assert.deepEqual(waits, [31000, 31000]);
});

test("dashboard conserva todos los productos sin permitir cierre de script desde un nombre", () => {
  const html = renderDashboard({ generatedAt: "2026-10-20", summary: {}, products: [{ id: "x", name: "</script><script>bad()</script>", searchStatus: "pending", status: "not_searched", references: [] }] });
  assert.equal(html.includes("</script><script>bad()"), false);
  assert.ok(html.includes("\\u003c/script\\u003e"));
  assert.doesNotThrow(() => new Script(html.match(/<script>([\s\S]*)<\/script>/)[1]));
});
