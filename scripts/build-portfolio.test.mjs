import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import {formatOfferMoney,launchIsActive} from '../public/offer-policy.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generator = path.join(root, 'scripts/build-portfolio-offer.mjs');
const source = JSON.parse(await readFile(path.join(root, 'commercial/portfolio-offer.json'), 'utf8'));
const catalog = JSON.parse(await readFile(path.join(root, 'public/catalogo/offer.json'), 'utf8'));

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
function deferredBlocks(html) { return [...html.matchAll(/<details\b/gi)].map(match => block(html.slice(match.index), 'details')).filter(Boolean); }
function visible(html) {
  for (const details of deferredBlocks(html)) html = html.replace(details, '');
  return html.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
}
function text(html) { return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ').trim(); }
const occurrences = (value, expected) => value.split(expected).length - 1;
function assertPayments(row, plan) {
  const green = block(row, 'div', 'class="portfolio-annual-benefit"');
  assert.ok(green, plan.id + ' annual offer');
  const shown = text(visible(row)), annualShown = text(visible(green));
  for (const amount of [plan.monthlyPrice, plan.setupFee, plan.monthlyPrice + plan.setupFee]) assert.ok(shown.includes(formatOfferMoney(amount)), plan.id + ' visible monthly payment ' + amount);
  assert.ok(annualShown.includes(formatOfferMoney(plan.annualMonthlyEquivalent)), plan.id + ' annual equivalent');
  assert.equal(occurrences(annualShown, formatOfferMoney(plan.annualMonthlyEquivalent * 12)), 1, plan.id + ' one visible annual total');
  assert.equal(occurrences(annualShown, formatOfferMoney((plan.monthlyPrice - plan.annualMonthlyEquivalent) * 12 + plan.setupFee)), 1, plan.id + ' one visible first-year saving');
  assert.match(annualShown, /100% bonificada/i);
  assert.match(annualShown, /Total a pagar por 12 meses/);
  assert.match(annualShown, /Ahorro total del primer año|Ahorrás.*el primer año/);
  assert.doesNotMatch(annualShown, /Abono anual anticipado|Ahorro en el abono anual|Ahorrás además/);
  assert.doesNotMatch(green, /<details\b|\shidden(?:\s|=|>)/i);
  const details = deferredBlocks(row).find(item => /incluye|ahorro|detalle/i.test(text(block(item,'summary')||'')));
  assert.ok(details, plan.id + ' accessible optional breakdown');
  assert.ok(text(details).includes(formatOfferMoney((plan.monthlyPrice - plan.annualMonthlyEquivalent) * 12)), plan.id + ' subscription saving breakdown');
  assert.ok(text(details).includes(formatOfferMoney(plan.setupFee)), plan.id + ' implementation saving breakdown');
  for (const [marker, mode] of [['data-plan-link', 'monthly'], ['data-plan-annual-link', 'annual']]) {
    const link = block(row, 'a', marker);
    assert.ok(link, marker);
    const href = link.match(/href="([^"]+)"/)?.[1];
    const url = new URL(href.replaceAll('&amp;', '&'), 'https://scalaris.com.ar');
    assert.equal(url.searchParams.get('product'), plan.product);
    assert.equal(url.searchParams.get('plan'), plan.id);
    assert.equal(url.searchParams.get('billing'), mode);
    assert.deepEqual([...url.searchParams.keys()].sort(), ['billing', 'plan', 'product', 'service']);
    assert.ok(visible(row).includes(link), plan.id + ' CTA is not behind details');
  }
}


async function fixture(t, change = () => {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'scalaris-portfolio-test-'));
  t.after(async () => {
    const resolved = path.resolve(directory);
    assert.ok(resolved.startsWith(path.resolve(tmpdir()) + path.sep));
    assert.ok(path.basename(resolved).startsWith('scalaris-portfolio-test-'));
    await rm(resolved, { recursive: true, force: true });
  });
  const data = structuredClone(source), product = structuredClone(catalog);
  change(data, product);
  const sourcePath = path.join(directory, 'source.json'), catalogPath = path.join(directory, 'catalog.json'), output = path.join(directory, 'public');
  await mkdir(output);
  await writeFile(sourcePath, JSON.stringify(data));
  await writeFile(catalogPath, JSON.stringify(product));
  const run = () => execFileSync(process.execPath, [generator, '--source', sourcePath, '--catalog-source', catalogPath, '--public-root', output], { cwd: root, stdio: 'pipe' });
  run();
  const read = name => readFile(path.join(output, 'productos', name), 'utf8');
  return { run, read, data, product, output };
}

test('portfolio generation keeps six families, five fixed plans and explicit public boundaries', async t => {
  const { read } = await fixture(t, data => {
    data.internal = { bankAccount: 'NEVER_PUBLISH_INTERNAL_BANK', taxId: 'NEVER_PUBLISH_TAX_ID' };
    data.webOffer.plans[0].privateMargin = 'NEVER_PUBLISH_MARGIN';
    data.families[0].credentials = 'NEVER_PUBLISH_CREDENTIALS';
  });
  const html = await read('index.html'), json = await read('offer.json');
  assert.equal((html.match(/class="solution-card"/g) || []).length, 6);
  assert.equal((html.match(/data-portfolio-plan="/g) || []).length, 5);
  for (const row of html.matchAll(/<tr data-portfolio-plan="[^"]+"[\s\S]*?<\/tr>/g)) {
    assert.equal((row[0].match(/<(?:th|td)(?:\s|>)/g) || []).length, 3, 'Compare the plan with its monthly and annual offers.');
    assert.match(row[0], /\/mes/);
    assert.match(row[0], /billing=monthly/);
  }
  assert.equal((html.match(/class="portfolio-annual-benefit"/g) || []).length, 5, 'Annual savings stay visible in the monthly default.');
  assert.equal((html.match(/data-plan-initial/g) || []).length, 5);
  assert.match(html, /100% bonificada/);
  assert.doesNotMatch(html, /data-portfolio-billing=/);
  assert.match(html, /propuesta visual personalizada/);
  assert.match(html, /dos rondas de ajustes/);
  for (const id of ['demos', 'planes', 'comparar']) assert.ok(html.includes(`id="${id}"`));
  assert.ok(html.includes('/productos/#planes') && html.includes('/productos/#demos'));
  assert.match(html, /href="\/#servicios">Desarrollo<\/a>/);
  assert.match(html, /<p>Software para tu negocio\.<br>De la idea a la puesta en marcha\.<\/p>/);
  assert.doesNotMatch(html, /href="\/tienda(?:\/|[?#"])/);
  assert.doesNotMatch(html, /Soporte y servicios|soporte informático|Equipos y repuestos/);
  assert.ok(html.includes('Configuración') || html.includes('configuración'));
  assert.ok(html.includes('No se sincroniza automáticamente con Mesa'));
  assert.ok(html.includes('Zoho Free'));
  assert.match(html, /href="\/web\/">Alcance de Web<\/a>/);
  assert.ok(!html.includes('https://crm.scalaris.com.ar'));
  for (const marker of ['NEVER_PUBLISH_INTERNAL_BANK', 'NEVER_PUBLISH_TAX_ID', 'NEVER_PUBLISH_MARGIN', 'NEVER_PUBLISH_CREDENTIALS']) assert.ok(!json.includes(marker) && !html.includes(marker));
  const publicOffer = JSON.parse(json);
  assert.deepEqual(publicOffer.fixedPlans.map(plan => plan.id), ['presencia', 'negocio', 'catalogo', 'pedidos', 'gestion']);
  assert.equal(publicOffer.webOffer.includedServices.domain.registrationAndRenewal, false);
  assert.match(publicOffer.webOffer.includedServices.domain.condition, /cargo|separado/);
  assert.ok(publicOffer.fixedPlans.every(plan => plan.setupAnnualWaived === true));
  for (const plan of publicOffer.fixedPlans) {
    assert.ok(Math.abs(plan.annualDiscountRate-(1-plan.annualMonthlyEquivalent/plan.monthlyPrice))<1e-12);
    if(plan.product==='web')assert.equal(plan.annualMonthlyEquivalent*4,plan.monthlyPrice*3);
    const row = html.match(new RegExp(`<tr data-portfolio-plan="${plan.product}:${plan.id}"[\\s\\S]*?<\\/tr>`))?.[0];
    assert.ok(row, plan.id);
    assertPayments(row,plan);
  }
  assert.equal(publicOffer.webOffer.billing.setupAnnualWaived,true);
  assert.equal(catalog.billing.setupAnnualWaived,true);
  assert.equal(catalog.billing.annualDiscountRate,null);
  assert.deepEqual(publicOffer.fixedPlans.filter(p=>p.product==='catalogo').map(p=>p.annualMonthlyEquivalent),[60000,80000,100000]);
  assert.equal(publicOffer.webOffer.includedServices.email.maxAccounts, 5);
  assert.match(publicOffer.webOffer.includedServices.email.condition, /IMAP\/POP/);
  assert.deepEqual(publicOffer.fixedPlans.map(plan => [plan.product, plan.id, plan.monthlyPrice, plan.setupFee]), [
    ['web', 'presencia', 69900, 350000], ['web', 'negocio', 99900, 650000],
    ['catalogo', 'catalogo', 70000, 300000], ['catalogo', 'pedidos', 90000, 450000], ['catalogo', 'gestion', 115000, 650000],
  ]);
});

test('regenerating an existing page removes legacy hardware markup while retaining the software routes', async t => {
  const { read, run, output } = await fixture(t);
  const original = await read('index.html');
  const trustedDemoRoutes = ['/catalogo/demos/', '/mesa/', '/gestudio/'];
  const legacy = original
    .replace('<a href="/#servicios">Desarrollo</a>', '<a href="/#servicios">Soporte y servicios</a><a href="../tienda/index.html?category=hardware">Equipos</a>')
    .replace('Software para tu negocio.<br>', 'Software y soporte informático.<br>')
    .replace('</footer>', '<a href="https://scalaris.com.ar/tienda/?q=ssd">Equipos y repuestos</a></footer>');
  assert.match(legacy, /Soporte y servicios|soporte informático/);
  assert.match(legacy, /Equipos y repuestos/);
  await writeFile(path.join(output, 'productos/index.html'), legacy);
  run();
  const regenerated = await read('index.html');
  assert.match(regenerated, /href="\/#servicios">Desarrollo<\/a>/);
  assert.match(regenerated, /<p>Software para tu negocio\.<br>De la idea a la puesta en marcha\.<\/p>/);
  for (const route of trustedDemoRoutes) {
    assert.ok(original.includes('href="' + route + '"'), route);
    assert.ok(regenerated.includes('href="' + route + '"'), route);
  }
  assert.doesNotMatch(regenerated, /Soporte y servicios|soporte informático|Equipos y repuestos/);
  for (const [, href] of regenerated.matchAll(/\bhref="([^"]+)"/g)) {
    assert.ok(!/^\/tienda(?:\/|$)/.test(new URL(href, 'https://scalaris.com.ar').pathname), href);
  }
  assert.equal(regenerated, original);
  run();
  assert.equal(await read('index.html'), regenerated);
});

test('catalog prices follow their own public offer and regeneration is deterministic', async t => {
  const { read, run } = await fixture(t, (_data, product) => {
    product.plans[0].annualMonthlyEquivalent = 13500;
    product.plans[0].monthlyPrice = 18000;
    product.plans[0].setupFee = 31000;
  });
  const before = await Promise.all(['index.html', 'productos.css', 'productos.js', 'offer.json'].map(read));
  const generated = JSON.parse(before[3]);
  const plan = generated.fixedPlans.find(plan => plan.product === 'catalogo' && plan.id === 'catalogo');
  assert.deepEqual([plan.annualMonthlyEquivalent, plan.monthlyPrice, plan.setupFee], [13500, 18000, 31000]);
  const card = before[0].match(/<tr data-portfolio-plan="catalogo:catalogo"[\s\S]*?<\/tr>/)?.[0];
  assert.ok(card);
  assert.match(card, /data-plan-price>\$ 18\.000/);
  assert.match(card, /data-plan-setup>\$ 31\.000/);
  assert.match(text(card), /Puesta en marcha/);
  assert.match(card, /billing=monthly/);
  assert.ok(before[0].includes('$ 18.000'));
  assert.doesNotMatch(before[2], /annualMonthlyEquivalent|monthlyPrice|setupFee/, 'Billing context script does not carry mutable pricing data.');
  assertPayments(card,plan);
  assert.match(text(visible(card)), /Total inicial primer mes[^$]*\$ 49\.000/);
  assert.doesNotMatch(before[0], /sujeto a cupo|50% bonificada|tres cuotas sin recargo/i);
  run();
  const after = await Promise.all(['index.html', 'productos.css', 'productos.js', 'offer.json'].map(read));
  assert.deepEqual(after, before);
});

test('Gestudio publishes a monthly reference with quoted implementation and no invented setup amount', async t => {
  const { read, output, data } = await fixture(t);
  const html = await read('index.html'), offer = JSON.parse(await read('offer.json'));
  const academy = offer.families.find(family => family.id === 'academia');
  assert.equal(academy.pricingType, 'starting_quote');
  assert.equal(academy.monthlyFrom, 39900);
  assert.deepEqual(academy.plans.map(p=>p.monthlyPrice),[39900,59900,89900,119900]);
  assert.equal(academy.billing.annualDiscountRate,.15);
  assert.equal(academy.billing.implementationMonths,1.5);
  assert.equal(Object.hasOwn(academy, 'setupFrom'), false);
  const card = html.match(/<article[^>]*id="solucion-academia"[\s\S]*?<\/article>/)?.[0];
  const reference = [...html.matchAll(/<article class="implementation-card">[\s\S]*?<\/article>/g)].map(match => match[0]).find(block => block.includes('<h3>Gestudio</h3>'));
  for (const block of [card, reference]) {
    assert.ok(block);
    assert.match(block, /Desde \$ 39\.900/);
    assert.doesNotMatch(block, /27\.000|30\.000|10%|pago anual anticipado de 12 meses/);
    assert.match(block, /Implementación[^<]*(?:por separado|a cotizar|de 1,5)/);
    assert.match(block, /una institución|por institución/);
    assert.doesNotMatch(block, /NaN|undefined|Bonificada|Instalación desde/);
  }
  assert.ok(!offer.fixedPlans.some(plan => plan.product === 'academia'));
  for (const family of data.families.filter(family => ['menu', 'mesa'].includes(family.id))) {
    assert.equal(Object.hasOwn(family, 'setupFrom'), false, family.id);
    const block = html.match(new RegExp('<article[^>]*id="solucion-' + family.id + '"[\\s\\S]*?<\\/article>'))?.[0];
    assert.ok(block, family.id);
    assert.match(block, /Implementación[^<]*(?:por separado|a cotizar|de 1,5)/);
    assert.doesNotMatch(block, /Instalación desde|NaN|undefined|Bonificada/);
    assert.ok(!offer.fixedPlans.some(plan => plan.product === family.id));
  }
  const generatedReference = await readFile(path.join(output, 'consulta/price-references.js'), 'utf8');
  const values = await import('data:text/javascript,' + encodeURIComponent(generatedReference));
  assert.deepEqual(Object.keys(values.priceReferences),['menu','mesa','academia','crm']);
  assert.equal(values.priceReferences.academia.monthlyFrom,39900);
  assert.equal(values.priceReferences.crm.monthlyFrom,49900);
  assert.equal(values.priceReferences.academia.plans.length,4);
});

test('annual URL context cannot rewrite monthly prices or explicit billing links', async t => {
  const {read}=await fixture(t);
  const html=await read('index.html'),script=await read('productos.js'),offer=JSON.parse(await read('offer.json'));
  assert.doesNotMatch(html,/data-portfolio-billing=/);
  for(const search of ['?billing=annual&amount=1&setup=0&discount=1&domain=free','?billing=monthly&promotion=true','?billing=FREE&amount=0','?billing=%3Cscript%3E&need=UNTRUSTED']){
    const links=new Map(['web','catalogo'].map(product=>[product,{href:''}]));
    const context=vm.createContext({URLSearchParams,window:{location:{search}},document:{querySelector(selector){const id=selector.match(/^\[data-family-link="(web|catalogo)"\]$/)?.[1];assert.ok(id,'Billing context must not query or mutate monthly price fields: '+selector);return links.get(id);}}});
    vm.runInContext(script,context);
    for(const [product,link] of links){const url=new URL(link.href,'https://scalaris.com.ar');assert.equal(url.pathname,product==='web'?'/web/':'/catalogo/');assert.equal(url.searchParams.get('billing'),search.startsWith('?billing=annual')?'annual':'monthly');for(const field of ['amount','setup','discount','domain','promotion','need'])assert.equal(url.searchParams.get(field),null);}
    for(const plan of offer.fixedPlans){
      const row=html.match(new RegExp(`<tr data-portfolio-plan="${plan.product}:${plan.id}"[\\s\\S]*?<\\/tr>`))?.[0];
      assert.ok(row,plan.id);
      assert.ok(row.includes('data-plan-price>'+formatOfferMoney(plan.monthlyPrice)));
      assert.ok(row.includes('data-plan-setup>'+formatOfferMoney(plan.setupFee)));
      assertPayments(row,plan);
      for(const [marker,mode] of [['data-plan-link','monthly'],['data-plan-annual-link','annual']]){
        const href=row.match(new RegExp(marker+'[^>]*href="([^"]+)"'))?.[1];assert.ok(href,marker);
        const link=new URL(href.replaceAll('&amp;','&'),'https://scalaris.com.ar');
        assert.equal(link.searchParams.get('product'),plan.product);assert.equal(link.searchParams.get('plan'),plan.id);assert.equal(link.searchParams.get('billing'),mode);
        assert.deepEqual([...link.searchParams.keys()].sort(),['billing','plan','product','service']);
      }
    }
  }
});

test('current annual setup waiver is independent from the expired launch campaign',async t=>{
  const {read}=await fixture(t),html=await read('index.html'),offer=JSON.parse(await read('offer.json'));
  assert.equal(launchIsActive('2026-12-01T00:00:00-03:00'),false);
  assert.doesNotMatch(await read('productos.js'),/quoteLaunch|launchPromotion/);
  assert.doesNotMatch(html,/El bloque blanco|El bloque verde/i);
  for(const plan of offer.fixedPlans){
    const row=block(html,'tr',`data-portfolio-plan="${plan.product}:${plan.id}"`);
    assert.ok(row);
    assertPayments(row,plan);
    assert.doesNotMatch(row,/50% bonificada|primer año de dominio|3 cuotas|sin recargo|cuota 1/i);
    if(plan.product==='catalogo')assert.doesNotMatch(row,/25%|3 meses de abono|9 meses/);
  }
});
