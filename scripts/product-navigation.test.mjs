import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { version } from './site-shell.mjs';
import { readProductInterest,productInterestAnswers,buildInquiry,summary } from '../public/consulta/model.js';

function block(html, tag, attributes = '') {
  const start = new RegExp('<' + tag + '\\b[^>]*' + attributes + '[^>]*>', 'i').exec(html);
  if (!start) return null;
  const tokens = new RegExp('</?' + tag + '\\b[^>]*>', 'gi');
  tokens.lastIndex = start.index;
  let depth = 0;
  for (let token; (token = tokens.exec(html));) {
    depth += token[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return html.slice(start.index, tokens.lastIndex);
  }
  return null;
}
function detailsBlocks(html) { return [...html.matchAll(/<details\b/gi)].map(match => block(html.slice(match.index), 'details')).filter(Boolean); }
function visible(html) {
  for (const details of detailsBlocks(html)) html = html.replace(details, '');
  return html.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
}
const text = html => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ').trim();
const money = value => new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(value).replace(/\s/g,' ');
const count = (value, expected) => value.split(expected).length - 1;
function quoteLink(html, product, plan, billing) {
  for (const match of html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>[\s\S]*?<\/a>/gi)) {
    const url = new URL(match[1].replaceAll('&amp;', '&'), 'https://scalaris.com.ar');
    if (url.pathname === '/consulta/' && url.searchParams.get('product') === product && url.searchParams.get('plan') === plan && url.searchParams.get('billing') === billing) {
      assert.deepEqual([...url.searchParams.keys()].sort(), ['billing','plan','product','service']);
      assert.match(text(match[0]), billing === 'monthly' ? /mensual|mes a mes/i : /anual|12 meses/i);
      return match[0];
    }
  }
  return null;
}
function assertAnnualOffer(html, plan) {
  const shown = text(visible(html));
  const total = plan.annualMonthlyEquivalent * 12;
  const saving = (plan.monthlyPrice - plan.annualMonthlyEquivalent) * 12 + plan.setupFee;
  assert.ok(shown.includes(money(plan.annualMonthlyEquivalent)), plan.id + ' annual monthly equivalent');
  assert.equal(count(shown,money(total)),1,plan.id + ' annual total appears once in the visible offer');
  assert.equal(count(shown,money(saving)),1,plan.id + ' combined first-year saving appears once');
  assert.match(shown,/Total a pagar por 12 meses/);
  assert.match(shown,/100% bonificada/i);
  assert.match(shown,/Ahorro total del primer año|Ahorrás.*el primer año/);
  assert.doesNotMatch(shown,/Abono anual anticipado|Ahorro en el abono anual|Ahorrás además/);
  assert.doesNotMatch(html,/<details\b|\shidden(?:\s|=|>)/i);
}

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

test('home and conditions keep concise payment choices consistent with the offer and specific Gestudio terms',async()=>{
  const home=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  assert.ok(home.includes('$ 69.900'));
  assert.match(home,/propuesta visual|componentes propios/i);
  assert.match(home,/mes a mes|mensual/i);assert.match(home,/anual/i);
  assert.match(home,/100% bonificada/i);
  assert.match(home,/Total inicial primer mes/i);
  const form=await readFile(new URL('../public/consulta/index.html',import.meta.url),'utf8');
  assert.match(form,/href="#form-root"/);
  assert.match(form,/100% bonificada/);
  assert.match(form,/Gestudio[^<]*condiciones propias/);
  assert.match(form,/no se guardan por defecto ni se envían a analítica/);
  const conditions=await readFile(new URL('../public/promociones/index.html',import.meta.url),'utf8');
  assert.match(conditions,/quince|15%/);assert.match(conditions,/1,5/);assert.match(conditions,/treinta días de anticipación/);
  for(const page of [home,form,conditions])assert.doesNotMatch(page,/El bloque blanco|El bloque verde|50% bonificada|redondea el total|tres cuotas sin recargo|primeros cinco|5 cupos disponibles|Web y Catálogo[^.]*25%/i);
  const offer=JSON.parse(await readFile(new URL('../public/productos/offer.json',import.meta.url),'utf8'));
  for(const plan of offer.fixedPlans){
    const row=conditions.match(new RegExp(`<tr><th scope="row"><strong>${plan.name}</strong>[\\s\\S]*?<\\/tr>`))?.[0];assert.ok(row,plan.name);
    const shown=text(visible(row));
    for(const amount of [plan.monthlyPrice,plan.setupFee,plan.monthlyPrice+plan.setupFee])assert.ok(shown.includes(money(amount)),plan.name+' visible monthly '+amount);
    const annual=block(row,'div','class="promo-annual-offer"');
    assert.ok(annual,plan.name+' annual choice');
    assertAnnualOffer(annual,plan);
    assert.ok(quoteLink(visible(row),plan.product,plan.id,'monthly'),plan.id+' visible monthly CTA');
    assert.ok(quoteLink(visible(row),plan.product,plan.id,'annual'),plan.id+' visible annual CTA');
    const details=detailsBlocks(row);
    assert.ok(details.length,plan.id+' optional breakdown');
    assert.ok(details.some(item=>text(item).includes(money((plan.monthlyPrice-plan.annualMonthlyEquivalent)*12))),plan.id+' subscription saving in breakdown');
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

test('Web and Catalog show both payment choices without URL-driven price changes or hidden payment totals',async()=>{
  for(const [product,scriptName,planAttribute,priceAttribute,setupAttribute,initialAttribute,contextAttribute] of [
    ['web','web','data-web-plan','data-web-price','data-web-setup','data-web-initial','data-web-context'],
    ['catalogo','catalogo','data-catalog-plan','data-plan-price','data-plan-setup','data-plan-initial','data-billing-context'],
  ]){
    const html=await readFile(new URL(`../public/${product}/index.html`,import.meta.url),'utf8');
    const script=await readFile(new URL(`../public/${product}/${scriptName}.js`,import.meta.url),'utf8');
    const offer=JSON.parse(await readFile(new URL(`../public/${product}/offer.json`,import.meta.url),'utf8'));
    assert.equal(offer.billing.setupAnnualWaived,true,product);
    assert.doesNotMatch(html,/data-web-billing=|data-billing="(?:annual|monthly)"|El bloque blanco|El bloque verde/);
    const beforePlans=html.slice(0,html.search(new RegExp('<article[^>]*'+planAttribute+'=')));
    for(const plan of offer.plans)assert.ok(!text(beforePlans).includes(money(plan.monthlyPrice)),plan.id+' no duplicate price summary before cards');
    for(const search of ['?billing=annual&amount=1&setup=0&discount=1&promotion=true','?billing=FREE&need=UNTRUSTED']){
      const anchor={value:'/consulta/?service=SOFTWARE&product='+product,getAttribute(){return this.value;},set href(value){this.value=value;},get href(){return this.value;}};
      const context=vm.createContext({URL,URLSearchParams,window:{location:{origin:'https://scalaris.com.ar',search}},document:{querySelectorAll(selector){assert.equal(selector,'['+contextAttribute+']','Only general context links can change');return [anchor];},querySelector(selector){assert.equal(selector,'[data-print]');return null;}}});
      vm.runInContext(script,context);
      const url=new URL(anchor.href,'https://scalaris.com.ar');assert.equal(url.searchParams.get('billing'),search.startsWith('?billing=annual')?'annual':'monthly');
      for(const key of ['amount','setup','discount','promotion','need'])assert.equal(url.searchParams.get(key),null);
    }
    for(const plan of offer.plans){
      const card=block(html,'article',`${planAttribute}="${plan.id}"`);assert.ok(card,plan.id);
      const shown=visible(card);
      for(const [attribute,amount]of [[priceAttribute,plan.monthlyPrice],[setupAttribute,plan.setupFee],[initialAttribute,plan.monthlyPrice+plan.setupFee]]){
        const price=shown.match(new RegExp(`<[^>]*${attribute}(?:\\s[^>]*)?>[\\s\\S]*?<\\/[^>]+>`))?.[0];
        assert.ok(price,plan.id+' visible '+attribute);
        assert.ok(text(price).includes(money(amount)),plan.id+' trusted payment '+amount);
      }
      assert.match(text(shown),/Sin descuento.*pagando mes a mes/);assert.match(text(shown),/Total inicial primer mes/);
      const green=block(card,'div',`class="${product==='web'?'web':'catalog'}-annual-benefit"`);assert.ok(green,plan.id+' annual option');
      assertAnnualOffer(green,plan);
      const monthlyLink=quoteLink(shown,product,plan.id,'monthly');
      const annualLink=quoteLink(visible(green),product,plan.id,'annual');
      assert.ok(monthlyLink,plan.id+' monthly CTA next to its offer');assert.ok(annualLink,plan.id+' annual CTA next to its offer');
      assert.ok(card.indexOf(initialAttribute)<card.indexOf(monthlyLink),plan.id+' monthly CTA follows first payment');
      assert.ok(card.indexOf(monthlyLink)<card.indexOf(green),plan.id+' monthly CTA precedes annual choice');
      const details=detailsBlocks(card).find(item=>/incluye|ahorro/i.test(text(block(item,'summary')||'')));assert.ok(details,plan.id+' native optional details');
      const breakdown=text(details);
      assert.ok(breakdown.includes(money((plan.monthlyPrice-plan.annualMonthlyEquivalent)*12)),plan.id+' subscription saving details');
      assert.ok(breakdown.includes(money(plan.setupFee)),plan.id+' implementation saving details');
      assert.match(breakdown,/contenido|textos|fotos|material/i);
      if(product==='catalogo'){
        assert.doesNotMatch(text(green),/25%|3 meses|9 meses/);
        const capacity=block(shown,'p','class="catalog-plan-capacity"');assert.ok(capacity,plan.id+' visible capacity');
        const capacityText=text(capacity);
        assert.ok(capacityText.includes(new Intl.NumberFormat('es-AR').format(plan.limits.products)),plan.id+' product limit');
        assert.ok(capacityText.includes(plan.limits.administrators+' administradores'),plan.id+' administrator limit');
        assert.ok(capacityText.includes(plan.limits.onboardingMinutes/60+' '+(plan.limits.onboardingMinutes===60?'hora':'horas')),plan.id+' training duration');
        const features=block(shown,'ul','class="catalog-plan-features"');assert.ok(features,plan.id+' visible key functions');
        const featureCount=(features.match(/<li\b/g)||[]).length;
        assert.ok(featureCount>=2&&featureCount<=3,plan.id+' two or three key functions');
        assert.match(breakdown,/carga inicial/i);
        assert.ok(breakdown.includes(String(plan.limits.initialProductsLoaded)),plan.id+' initial loading available on request');
      }
    }
    if(product==='catalogo'){
      assert.equal(offer.billing.annualDiscountRate,null);
      assert.deepEqual(offer.plans.map(p=>[p.monthlyPrice,p.annualMonthlyEquivalent,p.setupFee,p.limits.administrators,p.limits.onboardingMinutes]),[[70000,60000,300000,2,60],[90000,80000,450000,4,120],[115000,100000,650000,6,180]]);
      const comparison=block(html,'table','class="catalog-comparison"');assert.ok(comparison,'Feature comparison remains available');
      assert.doesNotMatch(text(comparison),/\$|Abono mes a mes|Total inicial|Total a pagar|Ahorro en el abono|Ahorro total/i,'The lower comparison helps choose features without repeating payments.');
      for(const label of ['Productos','Administradores','Capacitación'])assert.ok(text(comparison).includes(label),label+' comparison');
    }
  }
});
