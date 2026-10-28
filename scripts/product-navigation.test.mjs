import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readProductInterest,productInterestAnswers,buildInquiry,summary } from '../public/consulta/model.js';

test('product links preserve plan and billing interest without accepting prices or arbitrary query text',()=>{
  const interest=readProductInterest('?service=EQUIPMENT&product=catalogo&plan=gestion&billing=annual&amount=1&need=UNTRUSTED');
  assert.deepEqual(interest,{product:'catalogo',productName:'Scalaris Catálogo',plan:'gestion',planName:'Catálogo con pedidos y caja manual',billing:'annual',billingName:'pago anual anticipado'});
  const answers=productInterestAnswers(interest);
  assert.match(answers.scope,/Catálogo con pedidos y caja manual/);assert.match(answers.scope,/pago anual anticipado/);
  assert.ok(!JSON.stringify(answers).includes('UNTRUSTED'));
  assert.ok(!JSON.stringify(answers).includes('amount'));
  assert.equal(readProductInterest('?product=unknown&plan=gestion'),null);
  const hostile=readProductInterest('?product=catalogo&plan=%3Cscript%3E&billing=FREE&amount=0');
  assert.equal(hostile.plan,null);assert.equal(hostile.billing,null);assert.ok(!JSON.stringify(hostile).includes('script'));
});

test('product enquiry keeps existing schema v1 and only allowed answer fields for manual backoffice import',()=>{
  const answers=productInterestAnswers(readProductInterest('?product=scalaris-catalogo&plan=pedidos&billing=monthly'));
  const inquiry=buildInquiry('SOFTWARE',{name:'Cliente de prueba'},answers,'11111111-1111-4111-8111-111111111111','2026-10-27T12:00:00-03:00');
  assert.equal(inquiry.version,1);assert.equal(inquiry.schema,'scalaris.inquiry');
  assert.deepEqual(Object.keys(inquiry).sort(),['answers','contact','createdAt','id','schema','service','version']);
  assert.match(summary(inquiry),/Scalaris Catálogo/);assert.match(summary(inquiry),/plan Catálogo con seguimiento de pedidos/);assert.match(summary(inquiry),/mes a mes/);
  assert.equal(inquiry.answers.amount,undefined);assert.equal(inquiry.product,undefined);
});

test('public navigation pages keep one shared accessible menu and product entry points',async()=>{
  for(const file of ['index.html','productos/index.html','web/index.html','proyectos/index.html','consulta/index.html','catalogo/index.html','catalogo/demos/index.html','catalogo/propuesta.html']){
    const html=await readFile(new URL(`../public/${file}`,import.meta.url),'utf8');
    assert.equal((html.match(/id="site-navigation"/g)||[]).length,1,file);
    assert.match(html,/aria-controls="site-navigation"/);assert.match(html,/aria-expanded="false"/);
    assert.match(html,/class="footer-links"/);assert.match(html,/main\.js/);
    assert.match(html,/styles\.css\?v=20261027-catalogo/);
    assert.match(html,/main\.js\?v=20261027-catalogo/);
    assert.match(html,/productos\/#planes/);assert.match(html,/productos\/#demos/);
    assert.doesNotMatch(html,/href="(?:\/|\.\.\/)tienda(?:\/|[?#"])/,file);
    assert.doesNotMatch(html,/Soporte y servicios|Software y soporte informático\.|Equipos y repuestos/,file);
  }
  const formPage=await readFile(new URL('../public/consulta/index.html',import.meta.url),'utf8');
  const formCode=await readFile(new URL('../public/consulta/form.js',import.meta.url),'utf8');
  assert.match(formPage,/form\.js\?v=20261028-software/);
  assert.match(formCode,/from "\.\/model\.js\?v=20261028-software"/);
  assert.match(formCode,/from "\.\/plan-summary\.js\?v=20261028-software"/);
});
