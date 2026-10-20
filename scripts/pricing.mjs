import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ORDER_COSTS = ["inboundShipping", "outboundShipping", "packaging", "fixedFees"];
const RATES = ["paymentFeeRate", "reserveRate", "targetMarginRate"];

function nonNegative(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`${name} debe ser un número finito mayor o igual a cero; indicá 0 si no corresponde.`);
  }
  return value;
}

/**
 * Internal quote only. unitCost already includes supplier VAT.
 * Shipping, packaging, fixedFees and minimumProfit are totals per order.
 * All rates are fractions of gross sales (0.20 = 20%).
 * marketReference is a comparable final price PER UNIT, including delivery.
 */
export function calculatePrice(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Se necesita un objeto con los costos y supuestos explícitos.");
  }
  const unitCost = nonNegative(input.unitCost, "unitCost");
  if (!["ARS", "USD"].includes(input.currency)) {
    throw new TypeError("currency debe ser ARS o USD.");
  }
  if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) {
    throw new TypeError("quantity debe ser un entero positivo.");
  }
  const quantity = input.quantity;
  let exchangeRate = 1;
  if (input.currency === "USD") {
    exchangeRate = nonNegative(input.exchangeRate, "exchangeRate");
    if (exchangeRate === 0) throw new RangeError("exchangeRate debe ser mayor que cero para costos USD.");
  } else if (input.exchangeRate !== undefined && input.exchangeRate !== 1) {
    throw new RangeError("Para ARS, omití exchangeRate o usá 1.");
  }
  const costs = Object.fromEntries(ORDER_COSTS.map((name) => [name, nonNegative(input[name], name)]));
  const rates = Object.fromEntries(RATES.map((name) => [name, nonNegative(input[name], name)]));
  const rateSum = RATES.reduce((total, name) => total + rates[name], 0);
  if (rateSum >= 1) throw new RangeError("La suma de comisión, reserva y margen debe ser menor que 1.");
  const minimumProfit = nonNegative(input.minimumProfit, "minimumProfit");
  const roundTo = nonNegative(input.roundTo, "roundTo");
  if (roundTo === 0) throw new RangeError("roundTo debe ser mayor que cero.");
  if (input.marketReference !== undefined) nonNegative(input.marketReference, "marketReference");

  const supplierUnitCostArs = unitCost * exchangeRate;
  const orderExpensesArs = ORDER_COSTS.reduce((total, name) => total + costs[name], 0);
  const orderCostArs = supplierUnitCostArs * quantity + orderExpensesArs;
  const netFraction = 1 - rates.paymentFeeRate - rates.reserveRate;
  const marginFloorTotal = orderCostArs / (1 - rateSum);
  const minimumProfitFloorTotal = (orderCostArs + minimumProfit) / netFraction;
  const floorUnitPrice = Math.max(marginFloorTotal, minimumProfitFloorTotal) / quantity;
  // Always round upward: a market reference may flag a quote, never lower its floor.
  const unitPrice = Math.ceil(floorUnitPrice / roundTo) * roundTo;
  const totalPrice = unitPrice * quantity;
  const paymentFeesArs = totalPrice * rates.paymentFeeRate;
  const reserveArs = totalPrice * rates.reserveRate;
  const profitArs = totalPrice - orderCostArs - paymentFeesArs - reserveArs;
  const actualMarginRate = totalPrice === 0 ? 0 : profitArs / totalPrice;

  const result = {
    currency: "ARS",
    quantity,
    supplierUnitCostArs,
    orderExpensesArs,
    allocatedExpensesPerUnitArs: orderExpensesArs / quantity,
    orderCostArs,
    floorUnitPrice,
    unitPrice,
    totalPrice,
    paymentFeesArs,
    reserveArs,
    profitArs,
    actualMarginRate,
    marketComparison: input.marketReference === undefined ? null : {
      referenceUnitPrice: input.marketReference,
      differencePerUnitArs: unitPrice - input.marketReference,
      viable: unitPrice <= input.marketReference,
    },
  };
  for (const [name, value] of Object.entries(result)) {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new RangeError(`El cálculo de ${name} excede el rango numérico permitido.`);
    }
  }
  return result;
}

/** Build the same engine for the standalone, private browser calculator. */
export function browserPricingSource() {
  return [
    `const ORDER_COSTS = ${JSON.stringify(ORDER_COSTS)};`,
    `const RATES = ${JSON.stringify(RATES)};`,
    nonNegative.toString(),
    calculatePrice.toString(),
  ].join("\n");
}

const HELP = `Cotizador interno Scalaris. No publica precios ni modifica el catálogo.

Uso:
  node scripts/pricing.mjs --input ruta/a/cotizacion.json
  node scripts/pricing.mjs --id nb-119109 --input .private/supuestos.json
  node scripts/pricing.mjs --id tp-20775 --catalog ruta/privada.json --input .private/supuestos.json
  node scripts/pricing.mjs --help

Ver scripts/PRECIOS.md para campos obligatorios, costos por pedido y fórmula.
El archivo de entrada y la salida contienen información privada.
`;

export function quoteFromCatalog(catalog, productId, input) {
  if (catalog?.version !== 1 || !Array.isArray(catalog.products)) {
    throw new TypeError("El catálogo privado debe tener version: 1 y products: [].");
  }
  const matches = catalog.products.filter((product) => product.id === productId);
  if (matches.length !== 1) throw new Error(`Producto inexistente o duplicado: ${productId}`);
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Se necesita un objeto de supuestos.");
  }
  if (input.unitCost !== undefined || input.currency !== undefined) {
    throw new Error("Al usar --id, omití unitCost y currency: se toman del catálogo privado.");
  }
  if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) {
    throw new TypeError("quantity debe ser un entero positivo.");
  }
  const product = matches[0];
  if ((product.missingFromLatestNbList === true || product.costRequiresConfirmation === true) && input.supplierFinalCostConfirmed !== true) {
    throw new Error(product.missingFromLatestNbList === true
      ? "Este producto no figura en la última lista NB. Consultá disponibilidad y costo vigente con el proveedor y agregá supplierFinalCostConfirmed: true solo después de confirmarlos."
      : "El costo de este producto requiere nueva confirmación del proveedor. Agregá supplierFinalCostConfirmed: true solo después de confirmarlo.");
  }
  if (product.cost?.vatIncluded !== true && input.supplierFinalCostConfirmed !== true) {
    throw new Error("Falta confirmar que el importe del proveedor es el costo final con impuestos. Agregá supplierFinalCostConfirmed: true solo después de confirmarlo.");
  }
  const tiers = product.quantityPrices;
  let sourceCost = nonNegative(product.cost?.gross, "cost.gross");
  if (tiers !== undefined) {
    if (!Array.isArray(tiers)) throw new TypeError("quantityPrices debe ser un arreglo.");
    for (const tier of tiers) {
      if (!Number.isSafeInteger(tier.minQuantity) || tier.minQuantity <= 0) {
        throw new TypeError("minQuantity debe ser un entero positivo.");
      }
      nonNegative(tier.gross, "quantityPrices.gross");
    }
    const applicable = tiers.filter((tier) => tier.minQuantity <= input.quantity)
      .sort((a, b) => b.minQuantity - a.minQuantity);
    if (tiers.length && !applicable.length) throw new Error("La cantidad no alcanza el mínimo del proveedor.");
    if (applicable.length) sourceCost = applicable[0].gross;
  }
  return {
    product: { id: product.id, supplier: product.supplier, name: product.name, sourceCurrency: product.cost?.currency, sourceUnitCost: sourceCost },
    ...calculatePrice({ ...input, unitCost: sourceCost, currency: product.cost?.currency }),
  };
}

export function runCli(args) {
  if (args.length === 1 && args[0] === "--help") {
    console.log(HELP);
    return;
  }
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    if (!["--input", "--id", "--catalog"].includes(flag) || !args[i + 1] || args[i + 1].startsWith("--") || options[flag]) {
      throw new Error(HELP);
    }
    options[flag] = args[i + 1];
  }
  if (!options["--input"] || (options["--catalog"] && !options["--id"])) throw new Error(HELP);
  const readJson = (path) => JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
  const input = readJson(resolve(options["--input"]));
  let result;
  if (options["--id"]) {
    const defaultCatalog = fileURLToPath(new URL("../.private/catalog-costs.json", import.meta.url));
    const catalog = readJson(options["--catalog"] ? resolve(options["--catalog"]) : defaultCatalog);
    result = quoteFromCatalog(catalog, options["--id"], input);
  } else {
    result = calculatePrice(input);
  }
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runCli(process.argv.slice(2));
  } catch (error) {
    console.error(`No se pudo cotizar: ${error.message}`);
    process.exitCode = 1;
  }
}
