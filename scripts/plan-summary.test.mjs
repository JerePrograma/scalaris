import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlanSummary, hasPlanSelection, loadPlanSummary, planSummaryRows, planSummaryText } from '../public/consulta/plan-summary.js';
import { buildInquiry, readProductInterest, productInterestAnswers } from '../public/consulta/model.js';

const offer = {
  currency: 'ARS',
  billing: { annualMonths: 12, annualDiscountRate: null, setupAnnualWaived: true },
  plans: [
    { id: 'catalogo', annualMonthlyEquivalent: 60000, monthlyPrice: 70000, setupFee: 300000 },
    { id: 'pedidos', annualMonthlyEquivalent: 80000, monthlyPrice: 90000, setupFee: 450000 },
    { id: 'gestion', annualMonthlyEquivalent: 100000, monthlyPrice: 115000, setupFee: 650000 },
  ],
};
const webOffer = {
  currency: 'ARS',
  billing: { annualMonths: 12, annualDiscountRate: .25, setupAnnualWaived: true },
  plans: [
    { id: 'presencia', annualMonthlyEquivalent: 52425, monthlyPrice: 69900, setupFee: 350000 },
    { id: 'negocio', annualMonthlyEquivalent: 74925, monthlyPrice: 99900, setupFee: 650000 },
  ],
};
const cases = [
  ['web', 'presencia', 'Origen', webOffer, 629100, 419900, 209700],
  ['web', 'negocio', 'Web de hasta 5 páginas', webOffer, 899100, 749900, 299700],
  ['catalogo', 'catalogo', 'Vidriera', offer, 720000, 370000, 120000],
  ['catalogo', 'pedidos', 'Flujo', offer, 960000, 540000, 120000],
  ['catalogo', 'gestion', 'Pulso', offer, 1200000, 765000, 180000],
];
const interest = (plan, billing) => ({ product: 'catalogo', plan, billing });

test('all five annual reviews separate subscription savings, waived implementation and first-year savings', () => {
  for (const [product, id, name, data, annualTotal, , savings] of cases) {
    const review = buildPlanSummary(data, { product, plan: id, billing: 'annual' });
    const plan = data.plans.find(p => p.id === id);
    assert.equal(review.name, name);
    assert.equal(review.total, annualTotal);
    assert.equal(review.subscription, plan.annualMonthlyEquivalent * 12);
    assert.equal(review.monthlyAmount, plan.annualMonthlyEquivalent);
    assert.equal(review.twelveMonthlyPayments, plan.monthlyPrice * 12);
    assert.equal(review.annualSavings, savings);
    assert.equal(review.annualDiscountRate, data.billing.annualDiscountRate ?? (1-plan.annualMonthlyEquivalent/plan.monthlyPrice));
    assert.equal(review.periodMonths, 12);
    assert.equal(review.installation, 0);
    assert.equal(review.installationPayment, 0);
    assert.equal(review.installationBalance, 0);
    assert.equal(review.installationWaived, true);
    assert.equal(review.installationDiscount, plan.setupFee);
    assert.equal(review.firstYearSavings, savings+plan.setupFee);
    const text = planSummaryText(review);
    assert.match(text, /Plan anual · pago anticipado/);
    assert.match(text, /12 mensualidades al precio actual/);
    assert.match(text, /Abono anual · 12 meses por adelantado/);
    assert.match(text, /Ahorro anual en el abono/);
    assert.match(text, /Puesta en marcha bonificada al 100%/);
    assert.match(text, /Total a pagar por 12 meses/);
    assert.match(text, /precio fijo durante ese período/);
    assert.match(text, /Esta consulta no contrata ni activa el servicio/);
    assert.equal(review.total + review.firstYearSavings, plan.monthlyPrice * 12 + plan.setupFee);
    assert.ok(planSummaryRows(review).some(([label,value])=>label==='Puesta en marcha a pagar'&&value==='$ 0'));
    assert.equal(review.promotionActive,false);
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
  changed.plans[0].annualMonthlyEquivalent = 56000;
  const review = buildPlanSummary(changed, interest('catalogo', 'annual'), { annualDiscountRate: .99 });
  assert.equal(review.annualDiscountPercent, '20%');
  assert.equal(review.subscription, 672000);
  assert.equal(review.annualSavings, 168000);
  assert.equal(review.total, 672000);
  assert.equal(review.firstYearSavings,468000);
  assert.match(review.savingsText, /468.000.*168.000.*300.000/);
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
    assert.equal(review.installation, 0);
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
    data => { data.billing.setupAnnualWaived = null; },
    data => { data.billing.annualDiscountRate = '0.25'; },
    data => { data.billing.annualDiscountRate = -1; },
    data => { data.billing.annualDiscountRate = 1; },
    data => { data.billing.annualDiscountRate = .2; },
    data => { data.plans[0].setupFee = -1; },
    data => { data.plans[0].monthlyPrice = '89900'; },
    data => { data.plans[0].annualMonthlyEquivalent = 90000; },
    data => { data.billing.annualDiscountRate = .25; },
    data => { data.plans[0].setupFee = Number.MAX_SAFE_INTEGER; },
    data => { data.plans[0].setupFee = 90071992547409; },
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
    assert.equal(review.total, product === 'web' ? 629100 : 720000);
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

test('current offer alone controls setup waiver; dates and options do not restore archived gifts',()=>{
  for(const [product,id,,data]of cases){
    const plan=data.plans.find(p=>p.id===id);
    for(const billing of ['monthly','annual']){
      const review=buildPlanSummary(data,{product,plan:id,billing},{at:'2026-10-28T12:00:00-03:00',eligible:true,setupAnnualWaived:false});
      assert.equal(review.installation,billing==='annual'?0:plan.setupFee);
      assert.equal(review.installationDiscount,billing==='annual'?plan.setupFee:0);
      assert.equal(review.promotionActive,false);
      assert.equal(review.roundingDiscount,0);
      assert.equal(review.domainIncluded,false);
      assert.equal(review.total,billing==='annual'?plan.annualMonthlyEquivalent*12:plan.monthlyPrice+plan.setupFee);
      assert.doesNotMatch(planSummaryText(review),/redondeo|tres cuotas|1 de 3|cupo/i);
    }
    const noWaiver=structuredClone(data);noWaiver.billing.setupAnnualWaived=false;
    const selection=readProductInterest('?'+new URLSearchParams({product,plan:id,billing:'annual',setupAnnualWaived:'true',setup:'0',promotion:'free'}));
    const review=buildPlanSummary(noWaiver,selection,{setupAnnualWaived:true,eligible:true});
    assert.equal(review.installation,plan.setupFee);
    assert.equal(review.installationDiscount,0);
    assert.equal(review.total,plan.annualMonthlyEquivalent*12+plan.setupFee);
    assert.doesNotMatch(planSummaryText(review),/bonificad/i);
  }
});

test('Catalog uses three distinct subscription discounts and exact first-year savings',()=>{
  const expected=[['catalogo',720000,370000,120000,300000,420000,'14,29%'],['pedidos',960000,540000,120000,450000,570000,'11,11%'],['gestion',1200000,765000,180000,650000,830000,'13,04%']];
  for(const[id,annualTotal,monthlyTotal,subscriptionSaving,setupSaving,firstYearSaving,percent]of expected){
    const annual=buildPlanSummary(offer,interest(id,'annual'));
    const monthly=buildPlanSummary(offer,interest(id,'monthly'));
    assert.equal(annual.total,annualTotal);
    assert.equal(monthly.total,monthlyTotal);
    assert.equal(annual.annualSavings,subscriptionSaving);
    assert.equal(annual.installationDiscount,setupSaving);
    assert.equal(annual.firstYearSavings,firstYearSaving);
    assert.equal(annual.annualDiscountPercent,percent);
    assert.equal(annual.totalLabel,'Total a pagar por 12 meses');
    assert.equal(monthly.totalLabel,'Total inicial del primer mes');
    assert.doesNotMatch(planSummaryText(annual),/25%|tres mensualidades/);
  }
});
