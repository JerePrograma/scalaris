import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { version } from './site-shell.mjs';
import { readProductInterest,productInterestAnswers,buildInquiry,summary } from '../public/consulta/model.js';

test('product links preserve plan and billing interest without accepting prices or arbitrary query text',()=>{
  const interest=readProductInterest('?service=EQUIPMENT&product=catalogo&plan=gestion&billing=annual&amount=1&need=UNTRUSTED');
  assert.deepEqual(interest,{product:'catalogo',productName:'Scalaris Catálogo',plan:'gestion',planName:'Pulso',billing:'annual',billingName:'pago anual anticipado'});
  const answers=productInterestAnswers(interest);
  assert.match(answers.scope,/Pulso/);assert.match(answers.scope,/pago anual anticipado/);
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
  assert.match(summary(inquiry),/Scalaris Catálogo/);assert.match(summary(inquiry),/plan Flujo/);assert.match(summary(inquiry),/mes a mes/);
  assert.equal(inquiry.answers.amount,undefined);assert.equal(inquiry.product,undefined);
});

test('public navigation pages keep one shared accessible menu and product entry points',async()=>{
  for(const file of ['index.html','productos/index.html','web/index.html','proyectos/index.html','consulta/index.html','catalogo/index.html','catalogo/demos/index.html','catalogo/propuesta.html','promociones/index.html']){
    const html=await readFile(new URL(`../public/${file}`,import.meta.url),'utf8');
    assert.equal((html.match(/id="site-navigation"/g)||[]).length,1,file);
    assert.match(html,/aria-controls="site-navigation"/);assert.match(html,/aria-expanded="false"/);
    assert.match(html,/class="footer-links"/);assert.match(html,/main\.js/);
    assert.ok(html.includes('/styles.css?v=' + version), file);
    assert.ok(html.includes('/main.js?v=' + version), file);
    const header = html.match(/<header\b[\s\S]*?<\/header>/)?.[0];
    assert.ok(header, file);
    for (const route of ['/promociones/', '/productos/', '/productos/#planes', '/productos/#demos', '/#servicios', '/proyectos/', '/consulta/']) assert.ok(header.includes('href="' + route + '"'), file + ' ' + route);
    const skip = html.match(/<a[^>]*class="skip-link"[^>]*href="#([^"]+)"/);
    assert.ok(skip, file);
    assert.ok(html.includes('id="' + skip[1] + '"'), file + ' skip target');
    assert.equal((html.match(/<main\b/g)||[]).length, 1, file);
    assert.equal((html.match(/<h1\b/g)||[]).length, 1, file);
    assert.match(html,/productos\/#planes/);assert.match(html,/productos\/#demos/);
    assert.doesNotMatch(html,/href="(?:\/|\.\.\/)tienda(?:\/|[?#"])/,file);
    assert.doesNotMatch(html,/Soporte y servicios|Software y soporte informático\.|Equipos y repuestos/,file);
  }
  const formPage=await readFile(new URL('../public/consulta/index.html',import.meta.url),'utf8');
  const formCode=await readFile(new URL('../public/consulta/form.js',import.meta.url),'utf8');
  assert.ok(formPage.includes('form.js?v=' + version));
  assert.ok(formCode.includes('from "./model.js?v=' + version + '"'));
  assert.ok(formCode.includes('from "./plan-summary.js?v=' + version + '"'));
});


test('monthly interest is the default for fixed plans while quoted products never acquire a billing commitment',()=>{
  for (const [product, plan] of [['web','presencia'], ['catalogo','catalogo'], ['catalogo','pedidos'], ['catalogo','gestion']]) {
    const interest = readProductInterest('?' + new URLSearchParams({product,plan,amount:'1',setup:'0'}));
    assert.equal(interest.billing, 'monthly');
    assert.equal(interest.billingName, 'mes a mes');
    assert.match(productInterestAnswers(interest).scope, /mes a mes/);
    assert.equal(interest.amount, undefined);
  }
  for (const product of ['menu','mesa','academia','crm']) {
    const interest=readProductInterest('?product='+product+'&billing=annual&plan=gestion&amount=1');
    assert.equal(interest.plan, null);
    assert.equal(interest.billing, null);
    assert.match(productInterestAnswers(interest).scope, /relevamiento|alcance|presupuesto/);
  }
});

test('Web details retain domain ownership and email restrictions referenced from the product overview',async()=>{
  const html=await readFile(new URL('../public/web/index.html',import.meta.url),'utf8');
  assert.match(html, /dominio[^<]*a tu nombre|dominio[^<]*a nombre del cliente/i);
  assert.match(html, /renovación[^<]*(?:a tu cargo|a nombre y cargo del cliente)|registro y la renovación[^<]*a tu nombre y cargo/i);
  assert.match(html, /dominio[^<]*por separado|registro y la renovación[^<]*por separado/i);
  assert.doesNotMatch(html, /primer año[^<]*incluido/i);
  assert.match(html, /IMAP\/POP/);
  assert.match(html, /según disponibilidad|organizaciones elegibles/i);
});

test('current navigation compares monthly prices with optional annual billing and full implementation',async()=>{
  const home=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  assert.ok(home.includes('$ 69.900'));
  assert.match(home,/propuesta visual|componentes propios/i);
  assert.match(home,/mes a mes/i);
  assert.match(home,/implementación|puesta en marcha/i);
  assert.match(home,/anual opcional/i);
  assert.match(home,/ahorrás 25%/i);
  assert.match(home,/Pagás 9 meses de abono y usás 12/i);
  assert.match(home,/Total inicial con puesta en marcha/i);
  const form=await readFile(new URL('../public/consulta/index.html',import.meta.url),'utf8');
  assert.match(form,/href="#form-root"/);
  assert.match(form,/25% de descuento sólo en el abono/);
  assert.match(form,/Gestudio[^<]*condiciones propias/);
  const conditions=await readFile(new URL('../public/promociones/index.html',import.meta.url),'utf8');
  assert.match(conditions,/25% de descuento sólo en el abono|ahorrás 25% en el abono/);
  assert.match(conditions,/quince|15%/);
  assert.match(conditions,/1,5/);
  assert.match(conditions,/treinta días de anticipación/);
  for(const page of [home,form,conditions])assert.doesNotMatch(page,/100% bonificada|50% bonificada|alta bonificada|puesta en marcha bonificada|redondea el total|tres cuotas sin recargo|primeros cinco|5 cupos disponibles/i);
  const offer=JSON.parse(await readFile(new URL('../public/productos/offer.json',import.meta.url),'utf8'));
  const money=value=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(value).replace(/\s/g,' ');
  for(const plan of offer.fixedPlans){
    const row=conditions.match(new RegExp(`<tr><th scope="row"><strong>${plan.name}</strong>[\\s\\S]*?<\\/tr>`))?.[0];
    assert.ok(row,plan.name);
    for(const amount of [plan.monthlyPrice+plan.setupFee,plan.annualMonthlyEquivalent*12,(plan.monthlyPrice-plan.annualMonthlyEquivalent)*12,plan.annualMonthlyEquivalent*12+plan.setupFee])assert.ok(row.includes(money(amount)),`${plan.name} ${amount}`);
    assert.match(row,/mes equivalente/);
    assert.match(row,/Abono anual anticipado/);
    assert.match(row,/Total inicial anual/);
  }
});

test('the six published product references keep their own scope and only Web and Catalog expose monthly financial selections',async()=>{
  const offer=JSON.parse(await readFile(new URL('../public/productos/offer.json',import.meta.url),'utf8'));
  const page=await readFile(new URL('../public/productos/index.html',import.meta.url),'utf8');
  assert.deepEqual(offer.families.map(f=>f.id),['web','catalogo','menu','mesa','academia','crm']);
  assert.equal(offer.fixedPlans.length,5);
  assert.ok(offer.fixedPlans.every(plan=>['web','catalogo'].includes(plan.product)));
  for(const family of offer.families.filter(f=>f.pricingType==='starting_quote')){
    const card=page.match(new RegExp(`<article\\b[^>]*id="solucion-${family.id}"[^>]*>[\\s\\S]*?<\\/article>`))?.[0];
    assert.ok(card,family.id);
    const money=new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(family.monthlyFrom).replace(/\s/g,' ');
    assert.ok(card.includes(money),family.id);
    assert.match(card,/cotizar|presupuesto|piloto|implementación/i);
    assert.doesNotMatch(card,/pago anual anticipado|25%|15%|Total inicial|Bonificada/i,family.id);
  }
  assert.match(page,/id="planes-gestudio"/);
  const academy=offer.families.find(f=>f.id==='academia');
  assert.equal(academy.plans.length,4);
  assert.equal(academy.billing.annualDiscountRate,.15);
  for(const plan of academy.plans)assert.ok(page.includes(plan.name));
});
