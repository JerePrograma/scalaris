import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readProductInterest, productInterestAnswers, productPriceReference, buildInquiry, summary} from '../public/consulta/model.js';
import {hasPlanSelection, loadPlanSummary} from '../public/consulta/plan-summary.js';
import {priceReferences} from '../public/consulta/price-references.js';

test('Gestudio carries the trusted published reference into the editable inquiry without a fixed total', async () => {
  const source = JSON.parse(readFileSync(new URL('../commercial/portfolio-offer.json', import.meta.url)));
  const family = source.families.find(family => family.id === 'academia');
  assert.equal(priceReferences.academia.monthlyFrom, family.monthlyFrom);
  const interest = readProductInterest('?product=academia&plan=gestion&billing=annual&monthlyFrom=1&setup=0&total=1');
  assert.equal(interest.plan, null);
  assert.equal(interest.billing, null);
  assert.equal(hasPlanSelection(interest), false);
  assert.equal(await loadPlanSummary(interest, {fetchImpl:()=>{throw new Error('Gestudio must not load a fixed plan');}}), null);
  const reference = productPriceReference(interest);
  assert.match(reference, /Desde \$30\.000 ARS por mes para una institución/);
  assert.match(reference, /Implementación y migración a cotizar/);
  const answers = productInterestAnswers(interest);
  assert.ok(answers.scope.includes(reference));
  const inquiry = buildInquiry('SOFTWARE', {name:'Prueba'}, answers, 'gestudio-pricing-test', '2026-10-28T00:00:00Z');
  assert.ok(summary(inquiry).includes(reference));
  assert.doesNotMatch(summary(inquiry), /Total inicial|pago anual|Bonificada/);
  assert.equal(productPriceReference({product:'toString'}), null);
  assert.equal(productPriceReference({product:'crm'}), null);
});
