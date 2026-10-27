const families = Object.freeze({
  catalogo: {endpoint:'/catalogo/offer.json',plans:{catalogo:'Catálogo para WhatsApp',pedidos:'Catálogo con seguimiento de pedidos',gestion:'Catálogo con pedidos y caja manual'}},
  web: {endpoint:'/web/offer.json',plans:{presencia:'Web de una página',negocio:'Web de hasta 5 páginas'}},
});
const modes = new Set(['annual', 'monthly']);
const money = value => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
}).format(value).replace(/\s/g, ' ');

export function hasPlanSelection(interest) {
  return Boolean(interest && Object.hasOwn(families,interest.product)
    && Object.hasOwn(families[interest.product].plans, interest.plan)
    && modes.has(interest.billing));
}

function amount(value, name, { positive = false } = {}) {
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0)) {
    throw new Error(`Importe de ${name} inválido.`);
  }
  return value;
}

/** Only the trusted offer supplies amounts; URL interest supplies an allowlisted selection. */
export function buildPlanSummary(offer, interest) {
  if (!hasPlanSelection(interest)) return null;
  if (offer?.currency !== 'ARS' || !Array.isArray(offer.plans)
    || typeof offer.billing?.setupAnnualWaived !== 'boolean') {
    throw new Error('La oferta no tiene el formato esperado.');
  }
  const months = amount(offer.billing.annualMonths, 'período', { positive: true });
  const matching = offer.plans.filter(plan => plan.id === interest.plan);
  if (matching.length !== 1) throw new Error('El plan no está disponible en la oferta.');
  const plan = matching[0];
  const annualMonthly = amount(plan.annualMonthlyEquivalent, 'abono anual', { positive: true });
  const monthly = amount(plan.monthlyPrice, 'abono mensual', { positive: true });
  const setup = amount(plan.setupFee, 'instalación');
  if (annualMonthly > monthly) throw new Error('Los abonos de la oferta son inconsistentes.');
  const annual = interest.billing === 'annual';
  const subscription = amount(annual ? annualMonthly * months : monthly, 'abono inicial', { positive: true });
  const installation = annual && offer.billing.setupAnnualWaived ? 0 : setup;
  const total = amount(subscription + installation, 'total inicial', { positive: true });
  return Object.freeze({
    plan: interest.plan, name: families[interest.product].plans[interest.plan], billing: interest.billing,
    monthlyAmount: annual ? annualMonthly : monthly,
    periodMonths: annual ? months : 1,
    subscription, installation, total,
    installationWaived: annual && offer.billing.setupAnnualWaived,
    nextPayment: annual
      ? `El abono cubre ${months} meses desde la activación. La renovación se acuerda por separado.`
      : `Después de la instalación, el abono es ${money(monthly)} al mes, según las condiciones de actualización informadas.`,
  });
}

export function planSummaryRows(plan) {
  return [
    ['Plan elegido', plan.name],
    ['Modalidad', plan.billing === 'annual' ? 'Plan anual · pago anticipado' : 'Pago mes a mes'],
    [plan.billing === 'annual' ? 'Abono por mes en plan anual' : 'Abono mensual', money(plan.monthlyAmount)],
    [plan.billing === 'annual' ? `Abono por ${plan.periodMonths} meses` : 'Primer mes', money(plan.subscription)],
    ['Instalación por única vez', plan.installationWaived ? 'Bonificada' : money(plan.installation)],
  ];
}

export function planSummaryText(plan) {
  return [
    'Resumen del plan de referencia',
    ...planSummaryRows(plan).map(([label, value]) => `${label}: ${value}`),
    `Total inicial: ${money(plan.total)}`,
    plan.nextPayment,
    'Precios finales en ARS. El alcance y las condiciones se confirman con Scalaris antes del pago. Esta consulta no contrata ni activa el servicio.',
  ].join('\n');
}

export function planSummaryTotal(plan) {
  return money(plan.total);
}

export async function loadPlanSummary(interest, { fetchImpl = globalThis.fetch, signal } = {}) {
  if (!hasPlanSelection(interest)) return null;
  const response = await fetchImpl(families[interest.product].endpoint, {
    method: 'GET', cache: 'no-store', credentials: 'omit', mode: 'same-origin', signal,
  });
  if (!response.ok) throw new Error('No se pudo consultar la oferta.');
  return buildPlanSummary(await response.json(), interest);
}
