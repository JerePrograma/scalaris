import test from "node:test";
import assert from "node:assert/strict";
import { calculatePrice, quoteFromCatalog } from "./pricing.mjs";

const base = (overrides = {}) => ({
  unitCost: 10000,
  currency: "ARS",
  quantity: 1,
  inboundShipping: 0,
  outboundShipping: 0,
  packaging: 0,
  fixedFees: 0,
  paymentFeeRate: 0,
  reserveRate: 0,
  targetMarginRate: 0.2,
  minimumProfit: 0,
  roundTo: 1,
  ...overrides,
});

test("20% de margen sobre venta requiere 25% de recargo sobre costo", () => {
  const result = calculatePrice(base());
  assert.equal(result.unitPrice, 12500);
  assert.equal(result.profitArs, 2500);
  assert.equal(result.actualMarginRate, 0.2);
});

test("costos por pedido se prorratean; no se repite el envío por cada unidad", () => {
  const result = calculatePrice(base({ quantity: 4, inboundShipping: 4000, outboundShipping: 2000, packaging: 800, fixedFees: 400 }));
  assert.equal(result.allocatedExpensesPerUnitArs, 1800);
  assert.equal(result.orderCostArs, 47200);
  assert.equal(result.unitPrice, 14750);
  assert.equal(result.totalPrice, 59000);
  assert.equal(result.profitArs, 11800);
});

test("USD exige tipo de cambio explícito y no vuelve a sumar IVA al costo final", () => {
  const result = calculatePrice(base({ unitCost: 32.04, currency: "USD", exchangeRate: 1500 }));
  assert.equal(result.supplierUnitCostArs, 48060);
  assert.equal(result.unitPrice, 60075);
  assert.throws(() => calculatePrice(base({ currency: "USD" })), /exchangeRate/);
  assert.throws(() => calculatePrice(base({ currency: "USD", exchangeRate: 0 })), /exchangeRate/);
  assert.throws(() => calculatePrice(base({ currency: "ARS", exchangeRate: 1500 })), /ARS/);
});

test("comisiones y reserva se descuentan de la venta, conservando el margen objetivo", () => {
  const result = calculatePrice(base({ paymentFeeRate: 0.1, reserveRate: 0.05, targetMarginRate: 0.25, roundTo: 100 }));
  assert.equal(result.unitPrice, 16700);
  assert.equal(result.paymentFeesArs, 1670);
  assert.equal(result.reserveArs, 835);
  assert.ok(result.actualMarginRate >= 0.25);
});

test("mínimo de ganancia por pedido se respeta después de comisión y reserva", () => {
  const result = calculatePrice(base({ quantity: 2, paymentFeeRate: 0.1, reserveRate: 0.05, minimumProfit: 10000, roundTo: 100 }));
  assert.ok(result.profitArs >= 10000);
  assert.equal(result.unitPrice, 17700);
  assert.equal(result.profitArs, 10090);
});

test("envío alto sigue cubierto aunque superar una referencia no resulte competitivo", () => {
  const input = base({ unitCost: 1000, inboundShipping: 9000, outboundShipping: 6000, marketReference: 5000 });
  const result = calculatePrice(input);
  assert.equal(result.unitPrice, 20000);
  assert.equal(result.profitArs, 4000);
  assert.deepEqual(result.marketComparison, { referenceUnitPrice: 5000, differencePerUnitArs: 15000, viable: false });
  assert.equal(result.unitPrice, calculatePrice({ ...input, marketReference: undefined }).unitPrice);
});

test("redondea hacia arriba; la referencia igual o mayor admite precio viable", () => {
  const result = calculatePrice(base({ unitCost: 10001, roundTo: 100, marketReference: 12600 }));
  assert.equal(result.floorUnitPrice, 12501.25);
  assert.equal(result.unitPrice, 12600);
  assert.equal(result.marketComparison.viable, true);
  assert.ok(result.actualMarginRate >= 0.2);
});

test("no asume cero en costos desconocidos ni acepta negativos, strings, NaN o infinito", () => {
  for (const name of ["unitCost", "inboundShipping", "outboundShipping", "packaging", "fixedFees", "paymentFeeRate", "reserveRate", "targetMarginRate", "minimumProfit", "roundTo"]) {
    for (const value of [undefined, null, -1, "0", NaN, Infinity]) {
      assert.throws(() => calculatePrice(base({ [name]: value })), undefined, `${name}: ${String(value)}`);
    }
  }
  for (const quantity of [undefined, 0, -1, 1.5, "1", Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => calculatePrice(base({ quantity })), /quantity/);
  }
});

test("tasas incompatibles, redondeo cero y referencias inválidas bloquean la cotización", () => {
  assert.throws(() => calculatePrice(base({ paymentFeeRate: 0.4, reserveRate: 0.4, targetMarginRate: 0.2 })), /suma/);
  assert.throws(() => calculatePrice(base({ targetMarginRate: 1 })), /suma/);
  assert.throws(() => calculatePrice(base({ roundTo: 0 })), /roundTo/);
  assert.throws(() => calculatePrice(base({ marketReference: -1 })), /marketReference/);
  assert.throws(() => calculatePrice(base({ marketReference: null })), /marketReference/);
  assert.throws(() => calculatePrice(base({ currency: "EUR" })), /currency/);
});

test("desbordes numéricos se rechazan", () => {
  assert.throws(() => calculatePrice(base({ unitCost: Number.MAX_VALUE, quantity: 10 })), /rango numérico/);
});

const catalogFixture = (overrides = {}) => ({ version: 1, products: [{
  id: "test-1", supplier: "test", name: "Producto de prueba",
  cost: { currency: "ARS", gross: 10000, vatIncluded: true },
  quantityPrices: [{ minQuantity: 1, gross: 10000 }, { minQuantity: 3, gross: 9000 }, { minQuantity: 10, gross: 8000 }],
  ...overrides,
}] });
const assumptions = (overrides = {}) => {
  const { unitCost, currency, ...rest } = base(overrides);
  return rest;
};

test("cotiza por ID privado usando la escala real aplicable sin atribuir precio de x10 a x1", () => {
  const one = quoteFromCatalog(catalogFixture(), "test-1", assumptions());
  const three = quoteFromCatalog(catalogFixture(), "test-1", assumptions({ quantity: 3 }));
  assert.equal(one.product.sourceUnitCost, 10000);
  assert.equal(one.unitPrice, 12500);
  assert.equal(three.product.sourceUnitCost, 9000);
  assert.equal(three.unitPrice, 11250);
  assert.throws(() => quoteFromCatalog(catalogFixture(), "ausente", assumptions()), /inexistente/);
  assert.throws(() => quoteFromCatalog(catalogFixture(), "test-1", base()), /omití/);
});

test("IVA desconocido bloquea cotización por ID hasta confirmar costo final", () => {
  const catalog = catalogFixture({ cost: { currency: "ARS", gross: 10000, vatIncluded: null } });
  assert.throws(() => quoteFromCatalog(catalog, "test-1", assumptions()), /Falta confirmar/);
  assert.equal(quoteFromCatalog(catalog, "test-1", assumptions({ supplierFinalCostConfirmed: true })).unitPrice, 12500);
});

test("ausente de última lista NB exige confirmación aunque IVA sea conocido", () => {
  const catalog = catalogFixture({ missingFromLatestNbList: true, costRequiresConfirmation: true });
  assert.throws(() => quoteFromCatalog(catalog, "test-1", assumptions()), /no figura en la última lista NB/);
  assert.equal(quoteFromCatalog(catalog, "test-1", assumptions({ supplierFinalCostConfirmed: true })).unitPrice, 12500);
});

test("costo marcado para confirmar también bloquea sin bandera de ausencia", () => {
  const catalog = catalogFixture({ costRequiresConfirmation: true });
  assert.throws(() => quoteFromCatalog(catalog, "test-1", assumptions()), /requiere nueva confirmación/);
});
