import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readProductInterest, productInterestAnswers, productPriceReference, buildInquiry, summary} from '../public/consulta/model.js';
import {hasPlanSelection, loadPlanSummary} from '../public/consulta/plan-summary.js';
import {priceReferences} from '../public/consulta/price-references.js';

const portfolio = JSON.parse(readFileSync(new URL('../public/productos/offer.json', import.meta.url)));

test('scoped products preserve their trusted reference and contract unit without inventing a financial total', async () => {
  for (const [product, expected] of [['menu',25000],['mesa',39900],['academia',39900],['crm',49900]]) {
    const family = portfolio.families.find(candidate => candidate.id === product);
    assert.equal(priceReferences[product].monthlyFrom, family.monthlyFrom);
    assert.equal(priceReferences[product].monthlyFrom, expected);
    const interest = readProductInterest('?'+new URLSearchParams({product,plan:'gestion',billing:'annual',monthlyFrom:'1',setup:'0',total:'1',unitLabel:'UNTRUSTED'}));
    assert.equal(interest.plan, null);
    assert.equal(interest.billing, null);
    assert.equal(hasPlanSelection(interest), false);
    assert.equal(await loadPlanSummary(interest, {fetchImpl:()=>{throw new Error('A scoped product must not load a fixed plan');}}), null);
    const reference = productPriceReference(interest);
    assert.ok(reference.includes(new Intl.NumberFormat('es-AR').format(expected)));
    assert.ok(reference.includes(priceReferences[product].unitLabel));
    assert.ok(reference.includes(priceReferences[product].pricingNote));
    assert.doesNotMatch(reference, /UNTRUSTED|Total inicial|Bonificada|cuotas sin recargo/);
    if (product !== 'academia') assert.doesNotMatch(reference, /alumnos activos|para una institución/);
    const answers = productInterestAnswers(interest);
    assert.ok(answers.scope.includes(reference));
    const inquiry = buildInquiry('SOFTWARE', {name:'Prueba'}, answers, 'reference-pricing-test', '2026-11-01T00:00:00-03:00');
    assert.ok(summary(inquiry).includes(reference));
    assert.doesNotMatch(summary(inquiry), /Total inicial|Bonificada|UNTRUSTED/);
    assert.equal(inquiry.version, 1);
  }
  for (const product of ['toString','unknown','erp']) assert.equal(productPriceReference({product}), null);
});

test('Gestudio explains its four student tiers and own annual and implementation terms without a checkout total', () => {
  const reference = priceReferences.academia;
  assert.deepEqual(reference.plans.map(plan=>[plan.name,plan.monthlyPrice,plan.studentsMin,plan.studentsMax]), [
    ['Estudio',39900,1,50], ['Academia',59900,51,150], ['Academia Plus',89900,151,300], ['Institución',119900,301,null],
  ]);
  assert.equal(reference.billing.annualDiscountRate, .15);
  assert.equal(reference.billing.implementationMonths, 1.5);
  const text = productPriceReference(readProductInterest('?product=academia&plan=estudio&billing=annual&total=1'));
  for (const plan of reference.plans) {
    assert.ok(text.includes(plan.name));
    assert.ok(text.includes(new Intl.NumberFormat('es-AR').format(plan.monthlyPrice)));
  }
  assert.match(text, /1 a 50 alumnos activos/);
  assert.match(text, /desde 301 alumnos activos/);
  assert.match(text, /1,5 mensualidades/);
  assert.match(text, /15% de descuento en el abono/);
  assert.doesNotMatch(text, /10%|Total inicial|25%|bonificad/i);
});
