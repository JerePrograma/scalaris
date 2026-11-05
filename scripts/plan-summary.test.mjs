import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlanSummary, hasPlanSelection, loadPlanSummary, planSummaryRows, planSummaryText } from '../public/consulta/plan-summary.js';
import { buildInquiry, readProductInterest, productInterestAnswers } from '../public/consulta/model.js';

const offer = {
  currency: 'ARS',
  billing: { annualMonths: 12, annualDiscountRate: .25, setupAnnualWaived: false },
  plans: [
    { id: 'catalogo', annualMonthlyEquivalent: 67425, monthlyPrice: 89900, setupFee: 300000 },
    { id: 'pedidos', annualMonthlyEquivalent: 89925, monthlyPrice: 119900, setupFee: 450000 },
    { id: 'gestion', annualMonthlyEquivalent: 112425, monthlyPrice: 149900, setupFee: 650000 },
  ],
};
const webOffer = {
  currency: 'ARS',
  billing: { annualMonths: 12, annualDiscountRate: .25, setupAnnualWaived: false },
  plans: [
    { id: 'presencia', annualMonthlyEquivalent: 52425, monthlyPrice: 69900, setupFee: 350000 },
    { id: 'negocio', annualMonthlyEquivalent: 74925, monthlyPrice: 99900, setupFee: 650000 },
  ],
};
const cases = [
  ['web', 'presencia', 'Origen', webOffer, 979100, 419900, 209700],
  ['web', 'negocio', 'Web de hasta 5 páginas', webOffer, 1549100, 749900, 299700],
  ['catalogo', 'catalogo', 'Vidriera', offer, 1109100, 389900, 269700],
  ['catalogo', 'pedidos', 'Flujo', offer, 1529100, 569900, 359700],
  ['catalogo', 'gestion', 'Pulso', offer, 1999100, 799900, 449700],
];
const interest = (plan, billing) => ({ product: 'catalogo', plan, billing });

test('all five annual reviews show the saving, prepaid subscription and full implementation separately', () => {
  for (const [product, id, name, data, annualTotal, , savings] of cases) {
    const review = buildPlanSummary(data, { product, plan: id, billing: 'annual' });
    const plan = data.plans.find(p => p.id === id);
    assert.equal(review.name, name);
    assert.equal(review.total, annualTotal);
    assert.equal(review.subscription, plan.annualMonthlyEquivalent * 12);
    assert.equal(review.monthlyAmount, plan.annualMonthlyEquivalent);
    assert.equal(review.twelveMonthlyPayments, plan.monthlyPrice * 12);
    assert.equal(review.annualSavings, savings);
    assert.equal(review.annualDiscountRate, .25);
    assert.equal(review.annualDiscountPercent, '25%');
    assert.equal(review.periodMonths, 12);
    assert.equal(review.installation, plan.setupFee);
    assert.equal(review.installationPayment, plan.setupFee);
    assert.equal(review.installationBalance, 0);
    assert.equal(review.installationWaived, false);
    assert.equal(review.installationDiscount, 0);
    const text = planSummaryText(review);
    assert.match(text, /Plan anual · pago anticipado/);
    assert.match(text, /12 mensualidades al precio actual/);
    assert.match(text, /Abono anual · 12 meses por adelantado/);
    assert.match(text, /Ahorro anual en el abono \(25%\)/);
    assert.match(text, /Puesta en marcha única · pago completo/);
    assert.match(text, /precio fijo durante ese período/);
    assert.match(text, /Esta consulta no contrata ni activa el servicio/);
    assert.equal(review.total + review.annualSavings, plan.monthlyPrice * 12 + plan.setupFee);
    assert.deepEqual(planSummaryRows(review).at(-1), ['Puesta en marcha única · pago completo', '$ ' + new Intl.NumberFormat('es-AR').format(plan.setupFee)]);
  }
});

test('monthly review separates first month and complete implementation from recurring subscription', () => {
  for (const [product, id, , data, , monthlyTotal] of cases) {
    const review = buildPlanSummary(data, { product, plan: id, billing: 'monthly' });
    const plan = data.plans.find(p => p.id === id);
    assert.equal(review.total, monthlyTotal);
    assert.equal(review.subscription, plan.monthlyPrice);
    assert.equal(review.monthlyAmount, plan.monthlyPrice);
    assert.equal(review.periodMonths, 1);
    assert.equal(review.installation, plan.setupFee);
    assert.deepEqual(review.installationSchedule, [plan.setupFee]);
    assert.match(review.nextPayment, /Después de la instalación/);
    assert.doesNotMatch(planSummaryText(review), /Ahorro anual|12 mensualidades|12 meses por adelantado/);
  }
});

test('the annual percentage comes from the trusted offer and is not hardcoded into the summary', () => {
  const changed = structuredClone(offer);
  changed.billing.annualDiscountRate = .2;
  changed.plans[0].annualMonthlyEquivalent = 71920;
  const review = buildPlanSummary(changed, interest('catalogo', 'annual'), { annualDiscountRate: .99 });
  assert.equal(review.annualDiscountPercent, '20%');
  assert.equal(review.subscription, 863040);
  assert.equal(review.annualSavings, 215760);
  assert.equal(review.total, 1163040);
  assert.match(review.nextPayment, /descuento del 20%/);
  assert.match(review.savingsText, /215.760.*20%/);
  assert.doesNotMatch(planSummaryText(review), /25%|10%/);
});

test('query prices cannot change charges or the minimal inquiry schema', () => {
  for (const [product, id, name, data, annualTotal] of cases) {
    const selection = readProductInterest('?' + new URLSearchParams({ product, plan: id, billing: 'annual', amount: '1', setup: '0', total: '1', annualDiscountRate: '1' }));
    assert.equal(selection.planName, name);
    const inquiry = buildInquiry('SOFTWARE', { name: 'Prueba' }, productInterestAnswers(selection), 'test-id', '2026-11-05T00:00:00Z');
    const before = structuredClone(inquiry);
    const review = buildPlanSummary(data, selection);
    assert.equal(review.total, annualTotal);
    assert.equal(review.installation, data.plans.find(p => p.id === id).setupFee);
    assert.deepEqual(inquiry, before);
    assert.equal(inquiry.schema, 'scalaris.inquiry');
    assert.equal(inquiry.version, 1);
    assert.deepEqual(Object.keys(inquiry).sort(), ['answers', 'contact', 'createdAt', 'id', 'schema', 'service', 'version']);
    assert.match(planSummaryText(review), /Dominio propio: registro y renovación a nombre y cargo del cliente/);
  }
});

test('missing or unsupported selection does not invent a plan or fetch a quote', async () => {
  let fetches = 0;
  const fetchImpl = async () => { fetches++; throw new Error('Unexpected request'); };
  for (const selection of [null, interest(null, 'annual'), interest('catalogo', null), interest('__proto__', 'annual'), interest('catalogo', 'free'), { product: 'other', plan: 'catalogo', billing: 'annual' }, { product: 'web', plan: 'gestion', billing: 'annual' }]) {
    assert.equal(hasPlanSelection(selection), false);
    assert.equal(buildPlanSummary(offer, selection), null);
    assert.equal(await loadPlanSummary(selection, { fetchImpl }), null);
  }
  assert.equal(fetches, 0);
});

test('malformed amounts, discount rates, duplicate plans and overflow block a financial summary', () => {
  for (const mutate of [
    data => { data.currency = 'USD'; },
    data => { data.billing.annualMonths = 0; },
    data => { data.billing.setupAnnualWaived = 'true'; },
    data => { data.billing.setupAnnualWaived = true; },
    data => { delete data.billing.annualDiscountRate; },
    data => { data.billing.annualDiscountRate = '0.25'; },
    data => { data.billing.annualDiscountRate = -1; },
    data => { data.billing.annualDiscountRate = 1; },
    data => { data.billing.annualDiscountRate = .2; },
    data => { data.plans[0].setupFee = -1; },
    data => { data.plans[0].monthlyPrice = '89900'; },
    data => { data.plans[0].annualMonthlyEquivalent = 90000; },
    data => { data.plans[0].annualMonthlyEquivalent = 60000; },
    data => { data.plans[0].setupFee = Number.MAX_SAFE_INTEGER; },
    data => { data.billing.annualMonths = Number.MAX_SAFE_INTEGER; },
    data => { data.plans.push({ ...data.plans[0] }); },
  ]) {
    const invalid = structuredClone(offer);
    mutate(invalid);
    assert.throws(() => buildPlanSummary(invalid, interest('catalogo', 'annual')));
  }
});

test('quote requests only fixed same-origin offer endpoints, without cached prices or credentials', async () => {
  for (const product of ['catalogo', 'web']) {
    const signal = new AbortController().signal;
    const plan = product === 'web' ? 'presencia' : 'catalogo';
    const selection = readProductInterest('?' + new URLSearchParams({ product, plan, billing: 'annual', endpoint: 'https://evil.invalid/offer.json' }));
    const review = await loadPlanSummary(selection, {
      signal,
      fetchImpl: async (url, options) => {
        assert.equal(url, '/' + product + '/offer.json');
        assert.equal(options.method, 'GET');
        assert.equal(options.cache, 'no-store');
        assert.equal(options.credentials, 'omit');
        assert.equal(options.mode, 'same-origin');
        assert.equal(options.signal, signal);
        return { ok: true, json: async () => product === 'web' ? webOffer : offer };
      },
    });
    assert.equal(review.total, product === 'web' ? 979100 : 1109100);
  }
  await assert.rejects(loadPlanSummary(interest('catalogo', 'annual'), { fetchImpl: async () => ({ ok: false }) }));
  await assert.rejects(loadPlanSummary(interest('catalogo', 'annual'), { fetchImpl: async () => { throw new Error('offline'); } }));
});

test('Gestudio and other scoped products never inherit Web and Catalog annual calculations', async () => {
  for (const product of ['menu', 'mesa', 'academia', 'crm', 'fourbubbles', 'e-medicapp', 'inventarios-muebleria', 'gym-academy-manager', 'presupuestador-flete', 'hogaria', 'cjprestamos']) {
    const selection = readProductInterest('?product=' + product + '&plan=gestion&billing=annual&amount=1');
    assert.equal(selection.product, product);
    assert.equal(selection.plan, null);
    assert.equal(selection.billing, null);
    assert.equal(hasPlanSelection(selection), false);
    const answers = productInterestAnswers(selection);
    assert.equal(answers.topic, 'Software a medida');
    assert.match(answers.scope, /relevamiento/);
    assert.match(answers.scope, /presupuesto/);
    assert.equal(await loadPlanSummary(selection, { fetchImpl: () => { throw new Error('Must not fetch quoted products'); } }), null);
  }
});

test('fixed plan links default to monthly and unsupported billing cannot become an approved quote', () => {
  for (const [product, plan] of [['web', 'presencia'], ['catalogo', 'catalogo']]) {
    const selection = readProductInterest('?' + new URLSearchParams({ product, plan, amount: '1', setup: '0' }));
    assert.equal(selection.billing, 'monthly');
    assert.equal(selection.billingName, 'mes a mes');
    assert.equal(hasPlanSelection(selection), true);
    for (const billing of ['FREE', 'bad', '']) {
      const unsupported = readProductInterest('?' + new URLSearchParams({ product, plan, billing }));
      assert.equal(unsupported.billing, null);
      assert.equal(buildPlanSummary(product === 'web' ? webOffer : offer, unsupported), null);
      assert.doesNotMatch(productInterestAnswers(unsupported).scope, /con modalidad/);
    }
  }
});

test('new proposals cannot recover old campaign benefits through options or previous dates', () => {
  for (const [product, id, , data] of cases) {
    for (const billing of ['monthly', 'annual']) {
      const review = buildPlanSummary(data, { product, plan: id, billing }, { at: '2026-10-28T12:00:00-03:00', eligible: true });
      const plan = data.plans.find(p => p.id === id);
      assert.equal(review.installation, plan.setupFee);
      assert.equal(review.installationDiscount, 0);
      assert.equal(review.roundingDiscount, 0);
      assert.equal(review.domainIncluded, false);
      assert.equal(review.promotionActive, false);
      assert.deepEqual(review.installationSchedule, [plan.setupFee]);
      assert.equal(review.total, billing === 'annual' ? plan.annualMonthlyEquivalent * 12 + plan.setupFee : plan.monthlyPrice + plan.setupFee);
      assert.match(planSummaryText(review), /puesta en marcha se abona completa al comenzar/);
      assert.doesNotMatch(planSummaryText(review), /bonificad|redondeo|tres cuotas|1 de 3|cupo|primer año/i);
    }
  }
});
