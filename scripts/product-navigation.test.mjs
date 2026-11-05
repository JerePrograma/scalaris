import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
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

test('navigation separates monthly first payment from prepaid annual totals and setup waiver',async()=>{
  const home=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  assert.ok(home.includes('$ 69.900'));
  assert.match(home,/propuesta visual|componentes propios/i);
  assert.match(home,/mes a mes/i);assert.match(home,/anual opcional/i);
  assert.match(home,/puesta en marcha 100% bonificada/i);
  assert.match(home,/Total inicial primer mes/i);
  const form=await readFile(new URL('../public/consulta/index.html',import.meta.url),'utf8');
  assert.match(form,/href="#form-root"/);
  assert.match(form,/100% bonificada/);
  assert.match(form,/Gestudio[^<]*condiciones propias/);
  const conditions=await readFile(new URL('../public/promociones/index.html',import.meta.url),'utf8');
  assert.match(conditions,/Web conserva 25%/);
  assert.match(conditions,/Catálogo tiene importes anuales propios/);
  assert.match(conditions,/quince|15%/);assert.match(conditions,/1,5/);assert.match(conditions,/treinta días de anticipación/);
  for(const page of [home,form,conditions])assert.doesNotMatch(page,/50% bonificada|redondea el total|tres cuotas sin recargo|primeros cinco|5 cupos disponibles|Web y Catálogo[^.]*25%/i);
  const offer=JSON.parse(await readFile(new URL('../public/productos/offer.json',import.meta.url),'utf8'));
  const money=value=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(value).replace(/\s/g,' ');
  for(const plan of offer.fixedPlans){
    const row=conditions.match(new RegExp(`<tr><th scope="row"><strong>${plan.name}</strong>[\\s\\S]*?<\\/tr>`))?.[0];assert.ok(row,plan.name);
    const saving=(plan.monthlyPrice-plan.annualMonthlyEquivalent)*12;
    for(const amount of [plan.monthlyPrice+plan.setupFee,plan.annualMonthlyEquivalent*12,saving,saving+plan.setupFee])assert.ok(row.includes(money(amount)),`${plan.name} ${amount}`);
    assert.match(row,/mes equivalente/);assert.match(row,/Abono anual anticipado/);assert.match(row,/Total a pagar por 12 meses/);assert.match(row,/Puesta en marcha: \$ 0 · 100% bonificada/);
    assert.match(row,/billing=monthly/);assert.match(row,/billing=annual/);
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

test('Web and Catalog keep monthly white blocks fixed for annual URL context and expose explicit annual links',async()=>{
  const money=value=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(value).replace(/\s/g,' ');
  for(const [product,scriptName,planAttribute,priceAttribute,setupAttribute,initialAttribute,ctaAttribute,contextAttribute] of [
    ['web','web','data-web-plan','data-web-price','data-web-setup','data-web-initial','data-web-cta','data-web-context'],
    ['catalogo','catalogo','data-catalog-plan','data-plan-price','data-plan-setup','data-plan-initial','data-plan-cta','data-billing-context'],
  ]){
    const html=await readFile(new URL(`../public/${product}/index.html`,import.meta.url),'utf8');
    const script=await readFile(new URL(`../public/${product}/${scriptName}.js`,import.meta.url),'utf8');
    const offer=JSON.parse(await readFile(new URL(`../public/${product}/offer.json`,import.meta.url),'utf8'));
    assert.equal(offer.billing.setupAnnualWaived,true,product);
    assert.doesNotMatch(html,/data-web-billing=|data-billing="(?:annual|monthly)"/);
    for(const search of ['?billing=annual&amount=1&setup=0&discount=1&promotion=true','?billing=FREE&need=UNTRUSTED']){
      const anchor={value:'/consulta/?service=SOFTWARE&product='+product,getAttribute(){return this.value;},set href(value){this.value=value;},get href(){return this.value;}};
      const context=vm.createContext({URL,URLSearchParams,window:{location:{origin:'https://scalaris.com.ar',search}},document:{querySelectorAll(selector){assert.equal(selector,'['+contextAttribute+']','Only general context links can change');return [anchor];},querySelector(selector){assert.equal(selector,'[data-print]');return null;}}});
      vm.runInContext(script,context);
      const url=new URL(anchor.href,'https://scalaris.com.ar');assert.equal(url.searchParams.get('billing'),search.startsWith('?billing=annual')?'annual':'monthly');
      for(const key of ['amount','setup','discount','promotion','need'])assert.equal(url.searchParams.get(key),null);
    }
    for(const plan of offer.plans){
      const card=html.match(new RegExp(`<article[^>]*${planAttribute}="${plan.id}"[\\s\\S]*?<\\/article>`))?.[0];assert.ok(card,plan.id);
      assert.ok(card.includes(priceAttribute+'>'+money(plan.monthlyPrice)),plan.id+' monthly price');
      assert.ok(card.includes(setupAttribute+'>'+money(plan.setupFee)),plan.id+' full monthly setup');
      assert.ok(card.includes(initialAttribute+'>'+money(plan.monthlyPrice+plan.setupFee)),plan.id+' first monthly payment');
      assert.match(card,/Sin descuento · pagando mes a mes/);assert.match(card,/Total inicial primer mes/);
      const monthlyHref=card.match(new RegExp(ctaAttribute+'[^>]*href="([^"]+)"'))?.[1];assert.ok(monthlyHref);
      assert.equal(new URL(monthlyHref.replaceAll('&amp;','&'),'https://scalaris.com.ar').searchParams.get('billing'),'monthly');
      const green=card.match(new RegExp(`<div class="${product==='web'?'web':'catalog'}-annual-benefit">[\\s\\S]*?<\\/a><\\/div>`))?.[0];assert.ok(green);
      const saving=(plan.monthlyPrice-plan.annualMonthlyEquivalent)*12;
      for(const amount of [plan.annualMonthlyEquivalent,plan.annualMonthlyEquivalent*12,saving,saving+plan.setupFee])assert.ok(green.includes(money(amount)),plan.id+' annual amount '+amount);
      assert.match(green,/Puesta en marcha bonificada \(100%\)/);assert.match(green,/>\$ 0<\/dd>/);assert.match(green,/Total a pagar por 12 meses/);assert.match(green,/billing=annual/);
      if(product==='catalogo')assert.doesNotMatch(green,/25%|3 meses|9 meses/);
    }
    if(product==='catalogo'){
      assert.equal(offer.billing.annualDiscountRate,null);
      assert.deepEqual(offer.plans.map(p=>[p.monthlyPrice,p.annualMonthlyEquivalent,p.setupFee,p.limits.administrators,p.limits.onboardingMinutes]),[[70000,60000,300000,2,60],[90000,80000,450000,4,120],[115000,100000,650000,6,180]]);
      for(const time of ['1 hora','2 horas','3 horas'])assert.ok(html.includes(time),time);
    }
  }
});
