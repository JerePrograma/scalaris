import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlanSummary, hasPlanSelection, loadPlanSummary, planSummaryText } from '../public/consulta/plan-summary.js';
import { buildInquiry, readProductInterest, productInterestAnswers } from '../public/consulta/model.js';

const offer = {
  currency: 'ARS',
  billing: { annualMonths: 12, setupAnnualWaived: true },
  plans: [
    { id: 'catalogo', annualMonthlyEquivalent: 10000, monthlyPrice: 15000, setupFee: 30000 },
    { id: 'pedidos', annualMonthlyEquivalent: 20000, monthlyPrice: 30000, setupFee: 50000 },
    { id: 'gestion', annualMonthlyEquivalent: 30000, monthlyPrice: 45000, setupFee: 80000 },
  ],
};
const interest = (plan, billing) => ({ product: 'catalogo', plan, billing });

test('annual review shows the complete prepaid period and waived installation for all plans', () => {
  for (const [id, expected] of [['catalogo', 120000], ['pedidos', 240000], ['gestion', 360000]]) {
    const plan = buildPlanSummary(offer, interest(id, 'annual'));
    assert.equal(plan.total, expected);
    assert.equal(plan.subscription, expected);
    assert.equal(plan.periodMonths, 12);
    assert.equal(plan.installation, 0);
    assert.equal(plan.installationWaived, true);
    assert.match(planSummaryText(plan), /Plan anual · pago anticipado/);
    assert.match(planSummaryText(plan), /Esta consulta no contrata ni activa el servicio/);
  }
});

test('monthly review separates first month and one-time installation from recurring subscription', () => {
  for (const [id, firstPayment, recurring, installation] of [
    ['catalogo', 45000, 15000, 30000], ['pedidos', 80000, 30000, 50000], ['gestion', 125000, 45000, 80000],
  ]) {
    const plan = buildPlanSummary(offer, interest(id, 'monthly'));
    assert.equal(plan.total, firstPayment);
    assert.equal(plan.subscription, recurring);
    assert.equal(plan.monthlyAmount, recurring);
    assert.equal(plan.installation, installation);
    assert.equal(plan.installationWaived, false);
    assert.equal(plan.periodMonths, 1);
    assert.match(plan.nextPayment, /Después de la instalación/);
  }
});

test('query prices cannot set charges and the plan review does not mutate inquiry schema v1', () => {
  const selection = readProductInterest('?product=catalogo&plan=gestion&billing=annual&amount=1&setup=0&total=1&monthlyPrice=1');
  const inquiry = buildInquiry('SOFTWARE', { name: 'Prueba de consulta' }, productInterestAnswers(selection), 'test-id', '2026-10-27T00:00:00Z');
  const before = structuredClone(inquiry);
  const plan = buildPlanSummary(offer, selection);
  assert.equal(plan.total, 360000);
  assert.equal(plan.monthlyAmount, 30000);
  const shared = `${JSON.stringify(inquiry)}\n${planSummaryText(plan)}`;
  assert.match(shared, /360.000/);
  assert.deepEqual(inquiry, before);
  assert.equal(inquiry.schema, 'scalaris.inquiry');
  assert.equal(inquiry.version, 1);
  assert.deepEqual(Object.keys(inquiry).sort(), ['answers', 'contact', 'createdAt', 'id', 'schema', 'service', 'version']);
});

test('missing or unsupported selection does not invent a plan or fetch a quote', async () => {
  let fetches = 0;
  const fetchImpl = async () => { fetches++; throw new Error('Unexpected request'); };
  for (const selection of [null, interest(null, 'annual'), interest('catalogo', null), interest('__proto__', 'annual'), interest('catalogo', 'free'), { product: 'other', plan: 'catalogo', billing: 'annual' }]) {
    assert.equal(hasPlanSelection(selection), false);
    assert.equal(buildPlanSummary(offer, selection), null);
    assert.equal(await loadPlanSummary(selection, { fetchImpl }), null);
  }
  assert.equal(fetches, 0);
});

test('malformed amounts, duplicate plans and arithmetic overflow stop financial confirmation', () => {
  for (const mutate of [
    data => { data.currency = 'USD'; },
    data => { data.billing.annualMonths = 0; },
    data => { data.billing.setupAnnualWaived = 'true'; },
    data => { data.plans[0].setupFee = -1; },
    data => { data.plans[0].monthlyPrice = '15000'; },
    data => { data.plans[0].annualMonthlyEquivalent = 16000; },
    data => { data.billing.annualMonths = Number.MAX_SAFE_INTEGER; },
    data => { data.plans.push({ ...data.plans[0] }); },
  ]) {
    const invalid = structuredClone(offer);
    mutate(invalid);
    assert.throws(() => buildPlanSummary(invalid, interest('catalogo', 'annual')));
  }
});

test('a changed setup policy is included in the initial total instead of being silently waived', () => {
  const changed = structuredClone(offer);
  changed.billing.setupAnnualWaived = false;
  const plan = buildPlanSummary(changed, interest('catalogo', 'annual'));
  assert.equal(plan.total, 150000);
  assert.equal(plan.installation, 30000);
  assert.equal(plan.installationWaived, false);
});

test('quote request uses the same-origin public offer without cached prices or browser credentials', async () => {
  const signal = new AbortController().signal;
  const plan = await loadPlanSummary(interest('pedidos', 'monthly'), {
    signal,
    fetchImpl: async (url, options) => {
      assert.equal(url, '/catalogo/offer.json');
      assert.equal(options.cache, 'no-store');
      assert.equal(options.credentials, 'omit');
      assert.equal(options.mode, 'same-origin');
      assert.equal(options.signal, signal);
      return { ok: true, json: async () => offer };
    },
  });
  assert.equal(plan.total, 80000);
  await assert.rejects(loadPlanSummary(interest('catalogo', 'annual'), { fetchImpl: async () => ({ ok: false }) }));
  await assert.rejects(loadPlanSummary(interest('catalogo', 'annual'), { fetchImpl: async () => { throw new Error('offline'); } }));
});

const webOffer = {
  currency:'ARS',
  billing:{annualMonths:12,setupAnnualWaived:false},
  plans:[
    {id:'presencia',annualMonthlyEquivalent:8000,monthlyPrice:12000,setupFee:45000},
    {id:'negocio',annualMonthlyEquivalent:15000,monthlyPrice:20000,setupFee:90000},
  ],
};

test('Web review charges the one-time installation in annual and monthly modes',()=>{
  for(const [id,annual,monthly,installation]of [['presencia',141000,57000,45000],['negocio',270000,110000,90000]]){
    for(const [billing,total]of [['annual',annual],['monthly',monthly]]){
      const plan=buildPlanSummary(webOffer,{product:'web',plan:id,billing});
      assert.equal(plan.total,total);
      assert.equal(plan.installation,installation);
      assert.equal(plan.installationWaived,false);
      assert.equal(plan.periodMonths,billing==='annual'?12:1);
      assert.ok(!planSummaryText(plan).includes('Bonificada'));
    }
  }
});

test('Web selection rejects URL amounts and preserves the original inquiry schema',()=>{
  const selection=readProductInterest('?product=web&plan=presencia&billing=annual&amount=1&setup=0&total=1');
  assert.equal(selection.productName,'Scalaris Web');
  assert.equal(selection.planName,'Presencia');
  const answers=productInterestAnswers(selection);
  assert.equal(answers.topic,'Sitio web');
  const inquiry=buildInquiry('SOFTWARE',{name:'Prueba web'},answers,'test-web','2026-10-27T00:00:00Z');
  const snapshot=structuredClone(inquiry);
  assert.equal(buildPlanSummary(webOffer,selection).total,141000);
  assert.deepEqual(inquiry,snapshot);
  assert.deepEqual(Object.keys(inquiry).sort(),['answers','contact','createdAt','id','schema','service','version']);
  const invalid=structuredClone(webOffer);invalid.billing.annualMonths=Number.MAX_SAFE_INTEGER;
  assert.throws(()=>buildPlanSummary(invalid,selection));
  assert.equal(hasPlanSelection({product:'catalogo',plan:'presencia',billing:'annual'}),false);
  assert.equal(hasPlanSelection({product:'web',plan:'gestion',billing:'annual'}),false);
});

test('operational family inquiries request a scoped assessment instead of inventing plan charges',async()=>{
  for(const product of ['menu','mesa','academia','crm']){
    const selection=readProductInterest('?product='+product+'&plan=gestion&billing=annual&amount=1');
    assert.equal(selection.product,product);
    assert.equal(selection.plan,null);
    assert.equal(selection.billing,null);
    assert.equal(hasPlanSelection(selection),false);
    const answers=productInterestAnswers(selection);
    assert.equal(answers.topic,'Software a medida');
    assert.match(answers.scope,/relevamiento/);
    assert.match(answers.scope,/presupuesto/);
    assert.equal(await loadPlanSummary(selection,{fetchImpl:()=>{throw new Error('Must not fetch quoted products');}}),null);
  }
});

test('Web prices load only the fixed Web offer endpoint without accepting an endpoint from the URL',async()=>{
  const selection=readProductInterest('?product=web&plan=negocio&billing=monthly&endpoint=https://evil.invalid/offer.json');
  const plan=await loadPlanSummary(selection,{fetchImpl:async(url,options)=>{
    assert.equal(url,'/web/offer.json');
    assert.equal(options.cache,'no-store');
    assert.equal(options.credentials,'omit');
    assert.equal(options.mode,'same-origin');
    return{ok:true,json:async()=>webOffer};
  }});
  assert.equal(plan.total,110000);
});
