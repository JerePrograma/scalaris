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


test('monthly is the default for fixed plans while quoted products never acquire a billing commitment',()=>{
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
  assert.match(html, /renovación posterior a cargo del cliente|renovación[^<]*a tu cargo/i);
  assert.match(html, /Primer año[^<]*incluido|primer año de dominio[^<]*incluido/i);
  assert.match(html, /IMAP\/POP/);
  assert.match(html, /según disponibilidad|organizaciones elegibles/i);
});

test('launch navigation explains real benefits, shared eligibility and initial assistance',async()=>{
  const home=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  assert.match(home,/id="lanzamiento"/);
  assert.match(home,/30\/11\/2026/);
  assert.match(home,/sujet[oa]s? a confirmación/i);
  assert.ok(home.includes('$ 162.000'));
  assert.match(home,/total por 12 meses/);
  assert.match(home,/30, 60 o 100 productos/);
  assert.match(home,/60 minutos/);
  assert.doesNotMatch(home,/quedan (?:sólo )?5|5 cupos disponibles|subdominio de regalo/i);
  const form=await readFile(new URL('../public/consulta/index.html',import.meta.url),'utf8');
  assert.match(form,/href="#form-root"/);
  assert.match(form,/tres cuotas sin recargo/);
  assert.match(form,/sujeto a confirmación de cupo/i);
});
