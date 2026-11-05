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
const cases=[['web','presencia',web,629100,559700],['web','negocio',web,899100,949700],['catalogo','catalogo',catalog,720000,420000],['catalogo','pedidos',catalog,960000,570000],['catalogo','gestion',catalog,1200000,830000]];
const terms=offer=>({annualDiscountRate:offer.billing.annualDiscountRate,setupAnnualWaived:offer.billing.setupAnnualWaived});

test('retired campaign stays closed while current offer grants its own annual implementation waiver',()=>{
  assert.equal(launchPromotion.availability,'closed');
  assert.equal(launchPromotion.closedOn,'2026-11-01');
  assert.deepEqual(launchPromotion.setupWaivers,{});
  for(const date of [at,'2026-10-28T03:00:00Z','2026-12-01T03:00:00Z','not-a-date'])assert.equal(launchIsActive(date),false);
  for(const[product,id,offer]of cases){
    const plan=offer.plans.find(p=>p.id===id);
    for(const date of [at,'2026-10-28T12:00:00-03:00'])for(const billing of ['monthly','annual']){
      const q=quoteLaunch(plan,{product,billing,at:date,eligible:true,...terms(offer)});
      assert.equal(q.setupDue,billing==='annual'?0:plan.setupFee);
      assert.equal(q.setupDiscount,billing==='annual'?plan.setupFee:0);
      assert.equal(q.roundingDiscount,0);assert.equal(q.domainIncluded,false);assert.equal(q.promotionActive,false);
      assert.equal(q.setupInstallments.length,1);
    }
  }
});

test('annual totals and combined savings match all five current offers with zero implementation due',()=>{
  for(const[product,id,offer,total,firstYearSaving]of cases){
    const plan=offer.plans.find(p=>p.id===id),q=quoteLaunch(plan,{product,billing:'annual',at,...terms(offer)});
    assert.equal(q.annualTotal,total);assert.equal(q.totalInitial,total);
    assert.equal(q.annualSubscription,plan.annualMonthlyEquivalent*12);
    assert.equal(q.setupDue,0);assert.equal(q.setupDiscount,plan.setupFee);
    assert.equal(q.annualSavings,(plan.monthlyPrice-plan.annualMonthlyEquivalent)*12);
    assert.equal(q.firstYearSavings,firstYearSaving);
    assert.equal(q.totalInitial+q.firstYearSavings,plan.monthlyPrice*12+plan.setupFee);
    assert.equal(q.roundingDiscount,0);assert.equal(q.domainIncluded,false);
    const review=buildPlanSummary(offer,{product,plan:id,billing:'annual'},{at,eligible:true});
    assert.equal(review.total,total);assert.equal(review.installation,0);
    assert.match(planSummaryText(review),/Puesta en marcha bonificada al 100%/);
    assert.doesNotMatch(planSummaryText(review),/redondeo|cupo|1 de 3/i);
  }
});

test('monthly proposals charge complete implementation and do not inherit the annual waiver',()=>{
  for(const[product,id,offer]of cases){
    const plan=offer.plans.find(p=>p.id===id),q=quoteLaunch(plan,{product,billing:'monthly',at,...terms(offer)});
    assert.equal(q.totalInitial,plan.monthlyPrice+plan.setupFee);
    assert.equal(q.setupDue,plan.setupFee);assert.equal(q.setupDiscount,0);
    assert.equal(q.setupBalanceAfterInitial,0);assert.deepEqual(q.setupInstallments,[plan.setupFee]);
    const review=buildPlanSummary(offer,{product,plan:id,billing:'monthly'},{at});
    assert.equal(review.total,q.totalInitial);assert.equal(review.installation,plan.setupFee);
    assert.match(planSummaryText(review),/Total inicial del primer mes/);
    assert.doesNotMatch(planSummaryText(review),/bonificad|tres cuotas|1 de 3|cupo/i);
  }
  assert.equal(formatOfferMoney(48333.33),'$ 48.333,33');
});

test('historical policy remains reproducible with archived prices, outside the current inquiry',async()=>{
  const historical=JSON.parse(await readFile(new URL('../docs/evidence/launch-promotion-2026-10-28.json',import.meta.url),'utf8'));
  const plan={id:'presencia',monthlyPrice:15000,annualMonthlyEquivalent:13500,setupFee:100000};
  const q=quoteLaunch(plan,{product:'web',billing:'annual',at:'2026-10-28T12:00:00-03:00',policy:historical});
  assert.equal(q.annualTotal,160000);assert.equal(q.setupDue,0);
  assert.equal(buildPlanSummary(web,{product:'web',plan:plan.id,billing:'annual'},{at:'2026-10-28T12:00:00-03:00',eligible:true}).total,629100);
});

test('invalid financial amounts, explicit mismatched rates and nonboolean waiver flags fail closed',()=>{
  const plan={...web.plans[0]};
  for(const mutate of [p=>p.monthlyPrice='1',p=>p.monthlyPrice=0,p=>p.setupFee=-1,p=>p.annualMonthlyEquivalent=16000,p=>p.annualMonthlyEquivalent=12000,p=>p.setupFee=Number.MAX_SAFE_INTEGER]){
    const p={...plan};mutate(p);assert.throws(()=>quoteLaunch(p,{product:'web',billing:'annual',at,...terms(web)}));
  }
  assert.throws(()=>quoteLaunch(plan,{billing:'free',...terms(web)}));
  for(const annualDiscountRate of [-1,1,NaN,Infinity,'0.25'])assert.throws(()=>quoteLaunch(plan,{annualDiscountRate}),/Descuento anual inválido/);
  for(const setupAnnualWaived of ['true','false',null,1])assert.throws(()=>quoteLaunch(plan,{setupAnnualWaived}),/Bonificación de puesta en marcha inválida/);
  assert.throws(()=>quoteLaunch(plan,{annualDiscountRate:.1}),/no coincide/);
  assert.equal(quoteLaunch({...plan,monthlyPrice:14999,annualMonthlyEquivalent:13499},{annualDiscountRate:.1}).annualSubscription,13499*12);
});

test('Catalog rates derive from each plan and cannot be replaced by a universal 25 percent',()=>{
  assert.equal(launchPromotion.annualDiscountRate,.1);
  assert.equal(catalog.billing.annualDiscountRate,null);
  assert.equal(web.billing.annualDiscountRate,.25);
  for(const plan of catalog.plans){
    const q=quoteLaunch(plan,{product:'catalogo',billing:'annual',...terms(catalog)});
    assert.equal(q.annualDiscountRate,1-plan.annualMonthlyEquivalent/plan.monthlyPrice);
    assert.throws(()=>quoteLaunch(plan,{annualDiscountRate:.25}),/no coincide/);
  }
});

test('legacy quote helper derives current rates and only waives implementation when explicitly instructed',()=>{
  for(const[product,id,offer,total]of cases){
    const plan=offer.plans.find(p=>p.id===id);
    const defaultQuote=getLaunchQuote(plan);
    assert.equal(defaultQuote.totalInitial,plan.monthlyPrice+plan.setupFee);
    const withoutWaiver=getLaunchQuote(plan,{product,billing:'annual'});
    assert.equal(withoutWaiver.totalInitial,plan.annualMonthlyEquivalent*12+plan.setupFee);
    const automatic=getLaunchQuote(plan,{product,billing:'annual',setupAnnualWaived:true});
    const explicit=getLaunchQuote(plan,{product,billing:'annual',...terms(offer)});
    assert.equal(automatic.totalInitial,total);
    assert.equal(automatic.promotionActive,false);
    assert.deepEqual(automatic,explicit);
  }
});

test('quoted product links and untrusted URL financial fields cannot become a different fixed quote',()=>{
  for(const product of ['academia','fourbubbles','e-medicapp','inventarios-muebleria','gym-academy-manager','presupuestador-flete','hogaria','cjprestamos']){
    const interest=readProductInterest('?'+new URLSearchParams({product,plan:'gestion',billing:'annual',amount:'1',setupAnnualWaived:'true'}));
    assert.equal(interest.product,product);assert.equal(interest.plan,null);assert.equal(interest.billing,null);
    assert.match(productInterestAnswers(interest).scope,/relevamiento/);assert.equal(buildPlanSummary(catalog,interest,{at}),null);
  }
  const interest=readProductInterest('?product=web&plan=presencia&billing=annual&amount=1&setup=1&setupAnnualWaived=false&promotion=free');
  assert.equal(buildPlanSummary(web,interest,{at}).total,629100);
  for(const billing of ['bad','FREE','']){
    const selection=readProductInterest('?product=web&plan=presencia&billing='+billing);
    assert.equal(selection.billing,null);assert.equal(buildPlanSummary(web,selection,{at}),null);
  }
});
