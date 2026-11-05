import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {quoteLaunch,launchIsActive,launchPromotion,formatOfferMoney} from '../public/offer-policy.js';
import {buildPlanSummary,planSummaryText} from '../public/consulta/plan-summary.js';
import {readProductInterest,productInterestAnswers} from '../public/consulta/model.js';
import {getLaunchQuote} from './launch-promotion.mjs';
const at='2026-11-05T12:00:00-03:00';
const web=JSON.parse(await readFile(new URL('../public/web/offer.json',import.meta.url),'utf8'));
const catalog=JSON.parse(await readFile(new URL('../public/catalogo/offer.json',import.meta.url),'utf8'));
const cases=[['web','presencia',web],['web','negocio',web],['catalogo','catalogo',catalog],['catalogo','pedidos',catalog],['catalogo','gestion',catalog]];

test('retired campaign cannot be reactivated for new proposals with old dates or eligibility',()=>{
  assert.equal(launchPromotion.availability,'closed');
  assert.equal(launchPromotion.closedOn,'2026-11-01');
  assert.deepEqual(launchPromotion.setupWaivers,{});
  for(const date of [at,'2026-10-28T03:00:00Z','2026-12-01T03:00:00Z','not-a-date'])assert.equal(launchIsActive(date),false);
  for(const[product,id,offer]of cases){
    const plan=offer.plans.find(p=>p.id===id);
    for(const date of [at,'2026-10-28T12:00:00-03:00'])for(const billing of ['monthly','annual']){
      const q=quoteLaunch(plan,{product,billing,at:date,eligible:true,annualDiscountRate:offer.billing.annualDiscountRate});
      assert.equal(q.setupDue,plan.setupFee);assert.equal(q.setupDiscount,0);assert.equal(q.roundingDiscount,0);assert.equal(q.domainIncluded,false);assert.equal(q.promotionActive,false);
      assert.equal(q.setupInstallments.length,1);
    }
  }
});

test('all five standard annual quotes discount only the subscription and include complete setup without rounding',()=>{
  const totals=[979100,1549100,1109100,1529100,1999100];
  cases.forEach(([product,id,offer],index)=>{
    const plan=offer.plans.find(p=>p.id===id),q=quoteLaunch(plan,{product,billing:'annual',at,annualDiscountRate:offer.billing.annualDiscountRate});
    assert.equal(q.annualTotal,totals[index]);assert.equal(q.totalInitial,totals[index]);
    assert.equal(q.annualSubscription,plan.annualMonthlyEquivalent*12);assert.equal(q.setupDue,plan.setupFee);
    assert.equal(q.annualSavings,plan.monthlyPrice*3);assert.equal(q.twelveMonthlyPayments,plan.monthlyPrice*12);
    assert.equal(q.annualTotal+q.annualSavings,plan.monthlyPrice*12+plan.setupFee);
    assert.equal(q.roundingDiscount,0);assert.equal(q.setupDiscount,0);assert.equal(q.domainIncluded,false);
    const review=buildPlanSummary(offer,{product,plan:id,billing:'annual'},{at,eligible:true});
    assert.equal(review.total,totals[index]);assert.equal(review.installation,plan.setupFee);
    assert.doesNotMatch(planSummaryText(review),/bonificad|redondeo|cupo|primer año|1 de 3/i);
  });
});

test('monthly proposals separate the complete initial implementation and the recurring subscription',()=>{
  for(const[product,id,offer]of cases){
    const plan=offer.plans.find(p=>p.id===id),q=quoteLaunch(plan,{product,billing:'monthly',at,annualDiscountRate:offer.billing.annualDiscountRate});
    assert.equal(q.totalInitial,plan.monthlyPrice+plan.setupFee);
    assert.equal(q.setupBalanceAfterInitial,0);assert.deepEqual(q.setupInstallments,[plan.setupFee]);
    const review=buildPlanSummary(offer,{product,plan:id,billing:'monthly'},{at});
    assert.equal(review.total,q.totalInitial);assert.equal(review.installation,plan.setupFee);
    assert.doesNotMatch(planSummaryText(review),/bonificad|tres cuotas|1 de 3|cupo|primer año/i);
  }
  assert.equal(formatOfferMoney(48333.33),'$ 48.333,33');
});

test('historical policy remains reproducible only as an explicit archived calculation, outside current inquiry',async()=>{
  const historical=JSON.parse(await readFile(new URL('../docs/evidence/launch-promotion-2026-10-28.json',import.meta.url),'utf8'));
  const plan={id:'presencia',monthlyPrice:15000,annualMonthlyEquivalent:13500,setupFee:100000};
  const q=quoteLaunch(plan,{product:'web',billing:'annual',at:'2026-10-28T12:00:00-03:00',policy:historical});
  assert.equal(q.annualTotal,160000);assert.equal(q.setupDue,0);
  assert.equal(buildPlanSummary(web,{product:'web',plan:plan.id,billing:'annual'},{at:'2026-10-28T12:00:00-03:00',eligible:true}).total,979100);
});

test('malformed or overflowing prices and unsupported billing fail before a financial summary',()=>{
  const plan={...web.plans[0]};
  for(const mutate of [p=>p.monthlyPrice='1',p=>p.monthlyPrice=0,p=>p.setupFee=-1,p=>p.annualMonthlyEquivalent=16000,p=>p.annualMonthlyEquivalent=12000,p=>p.setupFee=Number.MAX_SAFE_INTEGER]){
    const p={...plan};mutate(p);assert.throws(()=>quoteLaunch(p,{product:'web',billing:'annual',at,annualDiscountRate:web.billing.annualDiscountRate}));
  }
  assert.throws(()=>quoteLaunch(plan,{product:'web',billing:'free',at,annualDiscountRate:web.billing.annualDiscountRate}));
  assert.equal(quoteLaunch({...plan,monthlyPrice:14999,annualMonthlyEquivalent:13499},{product:'web',billing:'annual',at,annualDiscountRate:.1}).annualSubscription,13499*12);
});
test('new prebuilt product links preserve only allowlisted context and never become fixed plan charges',()=>{
  for(const product of ['fourbubbles','e-medicapp','inventarios-muebleria','gym-academy-manager','presupuestador-flete','hogaria','cjprestamos']){
    const interest=readProductInterest('?'+new URLSearchParams({product,plan:'gestion',billing:'annual',amount:'1',setup:'0'}));
    assert.equal(interest.product,product);assert.equal(interest.plan,null);assert.equal(interest.billing,null);
    assert.match(productInterestAnswers(interest).scope,/relevamiento/);assert.equal(buildPlanSummary(catalog,interest,{at}),null);
  }
  const interest=readProductInterest('?product=web&plan=presencia&billing=annual&amount=1&setup=0&eligible=false&promotion=free');
  assert.equal(buildPlanSummary(web,interest,{at}).total,979100);
});

test('invalid billing does not silently reappear as a selected modality in consultation copy',()=>{
  for(const billing of ['bad','FREE','']){
    const interest=readProductInterest('?product=web&plan=presencia&billing='+billing);
    assert.equal(interest.billing,null);assert.equal(buildPlanSummary(web,interest,{at}),null);
    assert.doesNotMatch(productInterestAnswers(interest).scope,/con modalidad/);
  }
});

test('current annual rate is explicit and the archived campaign rate cannot redefine it',()=>{
  assert.equal(launchPromotion.annualDiscountRate,.1);
  for(const[product,id,offer]of cases){
    assert.equal(offer.billing.annualDiscountRate,.25);
    const plan=offer.plans.find(p=>p.id===id);
    assert.throws(()=>quoteLaunch(plan,{product,billing:'annual'}),/no coincide/);
    const q=quoteLaunch(plan,{product,billing:'annual',annualDiscountRate:offer.billing.annualDiscountRate});
    assert.equal(q.annualDiscountRate,.25);
    for(const annualDiscountRate of [-1,1,NaN,Infinity,'0.25'])assert.throws(()=>quoteLaunch(plan,{product,billing:'annual',annualDiscountRate}),/Descuento anual inválido/);
  }
});

test('legacy quote helper uses current plan prices rather than the closed campaign discount',()=>{
  for(const[product,id,offer]of cases){
    const plan=offer.plans.find(p=>p.id===id);
    const defaultQuote=getLaunchQuote(plan);
    const automatic=getLaunchQuote(plan,{product,billing:'annual'});
    const explicit=getLaunchQuote(plan,{product,billing:'annual',annualDiscountRate:offer.billing.annualDiscountRate});
    assert.equal(automatic.annualDiscountRate,.25);
    assert.equal(defaultQuote.annualDiscountRate,.25);
    assert.equal(defaultQuote.totalInitial,plan.monthlyPrice+plan.setupFee);
    assert.equal(automatic.totalInitial,plan.annualMonthlyEquivalent*12+plan.setupFee);
    assert.equal(automatic.setupDiscount,0);
    assert.equal(automatic.promotionActive,false);
    assert.deepEqual(automatic,explicit);
    assert.throws(()=>getLaunchQuote(plan,{product,billing:'annual',annualDiscountRate:.1}),/no coincide/);
    for(const annualDiscountRate of [-1,1,NaN,Infinity,'0.25'])assert.throws(()=>getLaunchQuote(plan,{annualDiscountRate}),/Descuento anual inválido/);
  }
});
