import test from "node:test";
import assert from "node:assert/strict";
import { filterProducts, sanitizeSelection, inquiryMessage, displayPrice, canOrder, selectionTotals } from "../legacy/hardware-store/model.js";

const products = [
  { id: "nb-1", name: "Teclado inalámbrico Logitech", category: "Periféricos", brand: "Logitech", currency: "ARS", price: 2000, priceValidUntil: "2099-01-01T00:00:00Z", orderable: true },
  { id: "tp-2", name: "SSD Kingston 480 GB", category: "Almacenamiento", currency: "ARS", price: 10000, priceValidUntil: "2099-01-01T00:00:00Z", orderable: true },
];

test("buscar combina palabras, tildes y categoría sin alterar el orden original", () => {
  assert.deepEqual(filterProducts(products, { search: "LOGITECH inalambrico" }), [products[0]]);
  assert.equal(filterProducts(products, { search: "Kingston", category: "Periféricos" }).length, 0);
  assert.deepEqual(products.map(p => p.id), ["nb-1", "tp-2"]);
});
test("consulta descarta IDs ajenos, cantidades inválidas y duplicados de sesión", () => {
  assert.deepEqual(sanitizeSelection([{ id: "nb-1", quantity: 2 }, { id: "nb-1", quantity: 3 }, { id: "x", quantity: 1 }, { id: "tp-2", quantity: 0 }, { id: "tp-2", quantity: 1.5 }, { id: "tp-2", quantity: 100 }], products), [{ id: "nb-1", quantity: 2 }]);
  assert.deepEqual(sanitizeSelection({}, products), []);
});
test("el pedido conserva precio, unidades, total y envío separado", () => {
  const message = inquiryMessage([{ id: "tp-2", quantity: 3 }], products, { postalCode: "1720" });
  assert.match(message, /3 × SSD Kingston 480 GB \[tp-2\]/);
  assert.match(message, /Total de productos por transferencia:.*30\.000/);
  assert.match(message, /disponibilidad, costo de envío y plazo de entrega/);
  assert.match(message, /Mi código postal: 1720/);
  assert.equal(inquiryMessage([], products), "");
});
test("no mostrar precios sin vigencia, vencidos o en moneda distinta de ARS", () => {
  const now = Date.parse("2026-10-20T12:00:00-03:00");
  const unpriced = { ...products[0], price: null, priceValidUntil: undefined };
  for (const override of [{}, { price: 2000 }, { price: 2000, priceValidUntil: "2026-10-19T12:00:00-03:00" }, { price: 2000, currency: "USD", priceValidUntil: "2026-10-21T12:00:00-03:00" }]) assert.equal(displayPrice({ ...unpriced, ...override }, now), "No disponible");
  assert.match(displayPrice({ ...products[0], price: 2000, priceValidUntil: "2026-10-21T12:00:00-03:00" }, now), /2\.000/);
});
test("total del pedido y orden por precio excluyen referencias no habilitadas", () => {
  const blocked = { ...products[0], id: "tp-blocked", price: 1, orderable: false };
  const all = [products[1], blocked, products[0]];
  assert.deepEqual(filterProducts(all, { sort: "price-asc" }).map(product => product.id), ["nb-1", "tp-2", "tp-blocked"]);
  assert.deepEqual(selectionTotals([{ id: "nb-1", quantity: 2 }, { id: "tp-2", quantity: 3 }], products), { subtotal: 34000, units: 5, hasUnavailable: false });
  assert.equal(canOrder(blocked), false);
  assert.deepEqual(sanitizeSelection([{ id: blocked.id, quantity: 1 }], all), []);
});
test("precio vencido no se suma al total ni genera enlace de pedido", () => {
  const expired = { ...products[0], priceValidUntil: "2020-01-01T00:00:00Z" };
  const selection = [{ id: expired.id, quantity: 1 }];
  assert.equal(selectionTotals(selection, [expired]).hasUnavailable, true);
  assert.equal(inquiryMessage(selection, [expired]), "");
});
