import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {quoteLaunch,launchIsActive,launchPromotion,formatOfferMoney} from '../public/offer-policy.js';
import {buildPlanSummary,planSummaryText} from '../public/consulta/plan-summary.js';
import {readProductInterest,productInterestAnswers} from '../public/consulta/model.js';
const at='2026-10-28T12:00:00-03:00';
const web=JSON.parse(await readFile(new URL('../public/web/offer.json',import.meta.url),'utf8'));
const catalog=JSON.parse(await readFile(new URL('../public/catalogo/offer.json',import.meta.url),'utf8'));
const cases=[['web','presencia',web,162000,0,48333.33],['catalogo','catalogo',catalog,162000,0,31666.67],['catalogo','pedidos',catalog,307500,37500,50000],['catalogo','gestion',catalog,428000,50000,68333.33],['web','negocio',web,370000,100000,91666.67]];
test('launch is bounded by Buenos Aires dates and shares five new-customer slots without an invented remaining count',()=>{
  assert.equal(launchPromotion.maxNewCustomers,5);assert.equal(launchPromotion.sharedAcrossProducts,true);
  assert.equal(launchPromotion.availability,'subject_to_confirmation');assert.equal(launchPromotion.remainingSlots,undefined);
  assert.equal(launchIsActive('2026-10-28T02:59:59Z'),false);
  assert.equal(launchIsActive('2026-10-28T03:00:00Z'),true);
  assert.equal(launchIsActive('2026-12-01T02:59:59.999Z'),true);
  assert.equal(launchIsActive('2026-12-01T03:00:00Z'),false);
  assert.equal(launchIsActive('not-a-date'),false);
  assert.equal(launchIsActive(at,{...launchPromotion,availability:'closed'}),false);
});
test('all five annual totals include correct setup waivers and first-year domain without applying the other-product cap to Web',()=>{
  for(const[product,id,offer,total,setup]of cases){
    const plan=offer.plans.find(p=>p.id===id);const q=quoteLaunch(plan,{product,billing:'annual',at});
    assert.equal(q.annualTotal,total,id);assert.equal(q.totalInitial,total);assert.equal(q.setupDue,setup);
    assert.equal(q.annualSubscription,plan.monthlyPrice*12*.9);assert.equal(q.setupDiscount,plan.setupFee-setup);
    assert.equal(q.domainIncluded,true);assert.equal(q.subjectToConfirmation,true);
    const review=buildPlanSummary(offer,{product,plan:id,billing:'annual'},{at});
    assert.equal(review.total,total);assert.equal(review.installation,setup);assert.match(planSummaryText(review),/Primer año de un \.com\.ar/);
    assert.match(planSummaryText(review),/sujeta a confirmación de cupo/);
  }
});
test('three monthly setup installments conserve every cent and the review separates first payment, balance and recurring subscription',()=>{
  for(const[product,id,offer,,,first]of cases){
    const plan=offer.plans.find(p=>p.id===id);const q=quoteLaunch(plan,{product,billing:'monthly',at});
    assert.equal(q.setupInstallments.length,3);assert.equal(q.monthlyPayments.length,3);assert.equal(q.totalInitial,first);
    assert.equal(q.setupInstallments.reduce((sum,n)=>sum+Math.round(n*100),0),plan.setupFee*100);
    assert.equal(q.domainIncluded,false);assert.equal(q.setupDiscount,0);
    assert.equal(Math.round((q.totalInitial-plan.monthlyPrice+q.setupBalanceAfterInitial)*100),plan.setupFee*100);
    const review=buildPlanSummary(offer,{product,plan:id,billing:'monthly'},{at});
    assert.equal(review.total,first);assert.equal(review.installation,plan.setupFee);
    assert.match(planSummaryText(review),/1 de 3/);assert.match(review.nextPayment,/Mes 2:/);assert.match(review.nextPayment,/Desde el mes 4/);
  }
  assert.equal(formatOfferMoney(48333.33),'$ 48.333,33');
});
test('expired or ineligible launch requests return standard setup and no included domain or financing',()=>{
  for(const[product,id,offer]of cases){for(const options of [{at:'2026-12-01T00:00:00-03:00'},{at,eligible:false}]){
    const plan=offer.plans.find(p=>p.id===id);
    const annual=quoteLaunch(plan,{product,billing:'annual',...options});
    assert.equal(annual.setupDiscount,0);assert.equal(annual.domainIncluded,false);assert.equal(annual.annualTotal,plan.annualMonthlyEquivalent*12+plan.setupFee);
    const monthly=quoteLaunch(plan,{product,billing:'monthly',...options});
    assert.equal(monthly.setupInstallments.length,1);assert.equal(monthly.totalInitial,plan.monthlyPrice+plan.setupFee);
  }}
});
test('other individually quoted implementations receive 50 percent up to 50000, without invented fixed setup prices',()=>{
  for(const[setup,pay]of [[0,0],[80000,40000],[150000,100000],[250000,200000]]){
    const q=quoteLaunch({id:'quoted',monthlyPrice:30000,annualMonthlyEquivalent:27000,setupFee:setup},{product:'crm',billing:'annual',at});
    assert.equal(q.setupDue,pay);assert.equal(q.annualTotal,324000+pay);assert.ok(q.setupDiscount<=50000);
  }
});
test('malformed or overflowing prices and unsupported billing fail before a financial summary',()=>{
  const plan={...web.plans[0]};
  for(const mutate of [p=>p.monthlyPrice='1',p=>p.monthlyPrice=0,p=>p.setupFee=-1,p=>p.annualMonthlyEquivalent=16000,p=>p.annualMonthlyEquivalent=12000,p=>p.setupFee=Number.MAX_SAFE_INTEGER]){
    const p={...plan};mutate(p);assert.throws(()=>quoteLaunch(p,{product:'web',billing:'annual',at}));
  }
  assert.throws(()=>quoteLaunch(plan,{product:'web',billing:'free',at}));
  assert.equal(quoteLaunch({...plan,monthlyPrice:14999,annualMonthlyEquivalent:13499},{product:'web',billing:'annual',at}).annualSubscription,13499*12);
});
test('new prebuilt product links preserve only allowlisted context and never become fixed plan charges',()=>{
  for(const product of ['fourbubbles','e-medicapp','inventarios-muebleria','gym-academy-manager','presupuestador-flete','hogaria','cjprestamos']){
    const interest=readProductInterest('?'+new URLSearchParams({product,plan:'gestion',billing:'annual',amount:'1',setup:'0'}));
    assert.equal(interest.product,product);assert.equal(interest.plan,null);assert.equal(interest.billing,null);
    assert.match(productInterestAnswers(interest).scope,/relevamiento/);assert.equal(buildPlanSummary(catalog,interest,{at}),null);
  }
  const interest=readProductInterest('?product=web&plan=presencia&billing=annual&amount=1&setup=0&eligible=false&promotion=free');
  assert.equal(buildPlanSummary(web,interest,{at}).total,162000);
});
