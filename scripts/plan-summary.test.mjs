import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlanSummary as standardSummary, hasPlanSelection, loadPlanSummary as standardLoad, planSummaryText } from '../public/consulta/plan-summary.js';
import { buildInquiry, readProductInterest, productInterestAnswers } from '../public/consulta/model.js';

// Standard tariffs remain covered independently of the limited launch campaign.
const buildPlanSummary=(offer,interest)=>standardSummary(offer,interest,{eligible:false});
const loadPlanSummary=(interest,options={})=>standardLoad(interest,{...options,eligible:false});

const offer = {
  currency: 'ARS',
  billing: { annualMonths: 12, setupAnnualWaived: false },
  plans: [
    { id: 'catalogo', annualMonthlyEquivalent: 13500, monthlyPrice: 15000, setupFee: 50000 },
    { id: 'pedidos', annualMonthlyEquivalent: 22500, monthlyPrice: 25000, setupFee: 75000 },
    { id: 'gestion', annualMonthlyEquivalent: 31500, monthlyPrice: 35000, setupFee: 100000 },
  ],
};
const interest = (plan, billing) => ({ product: 'catalogo', plan, billing });

test('standard tariff: annual review discounts only the subscription and charges installation for all plans', () => {
  for (const [id, subscription, installation, expected] of [['catalogo', 162000, 50000, 212000], ['pedidos', 270000, 75000, 345000], ['gestion', 378000, 100000, 478000]]) {
    const plan = buildPlanSummary(offer, interest(id, 'annual'));
    assert.equal(plan.total, expected);
    assert.equal(plan.subscription, subscription);
    assert.equal(plan.periodMonths, 12);
    assert.equal(plan.installation, installation);
    assert.equal(plan.installationWaived, false);
    assert.ok(!planSummaryText(plan).includes('Bonificada'));
    assert.match(planSummaryText(plan), /Plan anual · pago anticipado/);
    assert.match(planSummaryText(plan), /Esta consulta no contrata ni activa el servicio/);
  }
});

test('standard tariff: monthly review separates first month and one-time installation from recurring subscription', () => {
  for (const [id, firstPayment, recurring, installation] of [
    ['catalogo', 65000, 15000, 50000], ['pedidos', 100000, 25000, 75000], ['gestion', 135000, 35000, 100000],
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

test('standard tariff: query prices cannot set charges and the plan review does not mutate inquiry schema v1', () => {
  const selection = readProductInterest('?product=catalogo&plan=gestion&billing=annual&amount=1&setup=0&total=1&monthlyPrice=1');
  const inquiry = buildInquiry('SOFTWARE', { name: 'Prueba de consulta' }, productInterestAnswers(selection), 'test-id', '2026-10-27T00:00:00Z');
  const before = structuredClone(inquiry);
  const plan = buildPlanSummary(offer, selection);
  assert.equal(plan.total, 478000);
  assert.equal(plan.monthlyAmount, 31500);
  const shared = `${JSON.stringify(inquiry)}\n${planSummaryText(plan)}`;
  assert.match(shared, /478.000/);
  assert.match(shared, /Dominio propio: registro y renovación a nombre y cargo del cliente/);
  assert.deepEqual(inquiry, before);
  assert.equal(inquiry.schema, 'scalaris.inquiry');
  assert.equal(inquiry.version, 1);
  assert.deepEqual(Object.keys(inquiry).sort(), ['answers', 'contact', 'createdAt', 'id', 'schema', 'service', 'version']);
});

test('standard tariff: missing or unsupported selection does not invent a plan or fetch a quote', async () => {
  let fetches = 0;
  const fetchImpl = async () => { fetches++; throw new Error('Unexpected request'); };
  for (const selection of [null, interest(null, 'annual'), interest('catalogo', null), interest('__proto__', 'annual'), interest('catalogo', 'free'), { product: 'other', plan: 'catalogo', billing: 'annual' }]) {
    assert.equal(hasPlanSelection(selection), false);
    assert.equal(buildPlanSummary(offer, selection), null);
    assert.equal(await loadPlanSummary(selection, { fetchImpl }), null);
  }
  assert.equal(fetches, 0);
});

test('standard tariff: malformed amounts, duplicate plans and arithmetic overflow stop financial confirmation', () => {
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

test('standard tariff: the same installation is charged separately in both billing modes without receiving the annual discount', () => {
  const annual = buildPlanSummary(offer, interest('catalogo', 'annual'));
  const monthly = buildPlanSummary(offer, interest('catalogo', 'monthly'));
  assert.equal(annual.installation, 50000);
  assert.equal(monthly.installation, annual.installation);
  assert.equal(annual.subscription, monthly.subscription * 12 * 0.9);
  const plan = annual;
  assert.equal(plan.total, 212000);
  assert.equal(plan.installation, 50000);
  assert.equal(plan.installationWaived, false);
});

test('standard tariff: quote request uses the same-origin public offer without cached prices or browser credentials', async () => {
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
  assert.equal(plan.total, 100000);
  await assert.rejects(loadPlanSummary(interest('catalogo', 'annual'), { fetchImpl: async () => ({ ok: false }) }));
  await assert.rejects(loadPlanSummary(interest('catalogo', 'annual'), { fetchImpl: async () => { throw new Error('offline'); } }));
});

const webOffer = {
  currency:'ARS',
  billing:{annualMonths:12,setupAnnualWaived:false},
  plans:[
    {id:'presencia',annualMonthlyEquivalent:13500,monthlyPrice:15000,setupFee:100000},
    {id:'negocio',annualMonthlyEquivalent:22500,monthlyPrice:25000,setupFee:200000},
  ],
};

test('standard tariff: Web review charges the one-time installation in annual and monthly modes',()=>{
  for(const [id,annual,monthly,installation]of [['presencia',262000,115000,100000],['negocio',470000,225000,200000]]){
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

test('standard tariff: Web selection rejects URL amounts and preserves the original inquiry schema',()=>{
  const selection=readProductInterest('?product=web&plan=presencia&billing=annual&amount=1&setup=0&total=1');
  assert.equal(selection.productName,'Scalaris Web');
  assert.equal(selection.planName,'Origen');
  const answers=productInterestAnswers(selection);
  assert.equal(answers.topic,'Sitio web');
  const inquiry=buildInquiry('SOFTWARE',{name:'Prueba web'},answers,'test-web','2026-10-27T00:00:00Z');
  const snapshot=structuredClone(inquiry);
  assert.equal(buildPlanSummary(webOffer,selection).total,262000);
  assert.deepEqual(inquiry,snapshot);
  assert.deepEqual(Object.keys(inquiry).sort(),['answers','contact','createdAt','id','schema','service','version']);
  const invalid=structuredClone(webOffer);invalid.billing.annualMonths=Number.MAX_SAFE_INTEGER;
  assert.throws(()=>buildPlanSummary(invalid,selection));
  assert.equal(hasPlanSelection({product:'catalogo',plan:'presencia',billing:'annual'}),false);
  assert.equal(hasPlanSelection({product:'web',plan:'gestion',billing:'annual'}),false);
});

test('standard tariff: operational family inquiries request a scoped assessment instead of inventing plan charges',async()=>{
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

test('standard tariff: Web prices load only the fixed Web offer endpoint without accepting an endpoint from the URL',async()=>{
  const selection=readProductInterest('?product=web&plan=negocio&billing=monthly&endpoint=https://evil.invalid/offer.json');
  const plan=await loadPlanSummary(selection,{fetchImpl:async(url,options)=>{
    assert.equal(url,'/web/offer.json');
    assert.equal(options.cache,'no-store');
    assert.equal(options.credentials,'omit');
    assert.equal(options.mode,'same-origin');
    return{ok:true,json:async()=>webOffer};
  }});
  assert.equal(plan.total,225000);
});

test('standard tariff: approved plan names and prices stay consistent across URL selection, inquiry text and price review',()=>{
  const cases=[
    ['web','presencia','Origen',webOffer,262000,115000],
    ['web','negocio','Web de hasta 5 páginas',webOffer,470000,225000],
    ['catalogo','catalogo','Vidriera',offer,212000,65000],
    ['catalogo','pedidos','Flujo',offer,345000,100000],
    ['catalogo','gestion','Pulso',offer,478000,135000],
  ];
  for(const [product,id,name,data,annualTotal,monthlyTotal]of cases){
    for(const [billing,total]of [['annual',annualTotal],['monthly',monthlyTotal]]){
      const selection=readProductInterest('?'+new URLSearchParams({product,plan:id,billing}));
      assert.equal(selection.product,product);
      assert.equal(selection.plan,id);
      assert.equal(selection.planName,name);
      assert.ok(productInterestAnswers(selection).scope.includes(name));
      const review=buildPlanSummary(data,selection);
      assert.equal(review.plan,id);
      assert.equal(review.name,name);
      assert.equal(review.total,total);
      assert.ok(planSummaryText(review).includes('Plan elegido: '+name));
    }
  }
});

test('standard tariff: fixed plan links default to monthly while unsupported billing never becomes an approved quote',()=>{
  for(const [product,plan]of [['web','presencia'],['catalogo','catalogo']]){
    const selection=readProductInterest('?'+new URLSearchParams({product,plan,amount:'1',setup:'0'}));
    assert.equal(selection.billing,'monthly');
    assert.equal(selection.billingName,'mes a mes');
    assert.equal(hasPlanSelection(selection),true);
    assert.equal(readProductInterest('?'+new URLSearchParams({product,plan,billing:'FREE'})).billing,null);
  }
  for(const product of ['menu','mesa','academia','crm'])assert.equal(readProductInterest('?product='+product).billing,null);
});
