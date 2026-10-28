import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import {quoteLaunch,formatOfferMoney,launchPromotion,launchIsActive} from '../public/offer-policy.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generator = path.join(root, 'scripts/build-portfolio-offer.mjs');
const source = JSON.parse(await readFile(path.join(root, 'commercial/portfolio-offer.json'), 'utf8'));
const catalog = JSON.parse(await readFile(path.join(root, 'public/catalogo/offer.json'), 'utf8'));

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
    assert.equal((row[0].match(/<(?:th|td)(?:\s|>)/g) || []).length, 5, 'Plan, purpose, subscription, setup and consultation are the only columns.');
    assert.match(row[0], /pago anual anticipado de 12 meses/);
    assert.match(row[0], /billing=annual/);
  }
  assert.doesNotMatch(html, /data-plan-total|data-total-heading|data-plan-first-payment/);
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
  assert.ok(publicOffer.fixedPlans.every(plan => plan.setupAnnualWaived === false));
  for (const plan of publicOffer.fixedPlans) assert.equal(plan.annualMonthlyEquivalent * 10, plan.monthlyPrice * 9);
  assert.equal(publicOffer.webOffer.includedServices.email.maxAccounts, 5);
  assert.match(publicOffer.webOffer.includedServices.email.condition, /IMAP\/POP/);
  assert.deepEqual(publicOffer.fixedPlans.map(plan => [plan.product, plan.id, plan.monthlyPrice, plan.setupFee]), [
    ['web', 'presencia', 15000, 100000], ['web', 'negocio', 25000, 200000],
    ['catalogo', 'catalogo', 15000, 50000], ['catalogo', 'pedidos', 25000, 75000], ['catalogo', 'gestion', 35000, 100000],
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
    product.plans[0].annualMonthlyEquivalent = 16200;
    product.plans[0].monthlyPrice = 18000;
    product.plans[0].setupFee = 31000;
  });
  const before = await Promise.all(['index.html', 'productos.css', 'productos.js', 'offer.json'].map(read));
  const generated = JSON.parse(before[3]);
  const plan = generated.fixedPlans.find(plan => plan.product === 'catalogo' && plan.id === 'catalogo');
  assert.deepEqual([plan.annualMonthlyEquivalent, plan.monthlyPrice, plan.setupFee], [16200, 18000, 31000]);
  const card = before[0].match(/<tr data-portfolio-plan="catalogo:catalogo"[\s\S]*?<\/tr>/)?.[0];
  assert.ok(card);
  assert.match(card, /data-plan-price>\$ 16\.200/);
  assert.match(card, /data-plan-setup>Bonificada/);
  assert.match(card, /data-plan-setup-note>100% bonificada/);
  assert.match(card, /billing=annual/);
  assert.ok(before[0].includes('$ 16.200'));
  assert.match(before[2], /"annualMonthlyEquivalent":16200/);
  assert.doesNotMatch(card, /data-plan-total|data-plan-first-payment/);
  assert.match(before[0], /sujet[oa]s? a confirmación|sujeto a cupo/i);
  run();
  const after = await Promise.all(['index.html', 'productos.css', 'productos.js', 'offer.json'].map(read));
  assert.deepEqual(after, before);
});

test('Gestudio publishes a monthly reference with quoted implementation and no invented setup amount', async t => {
  const { read, output, data } = await fixture(t);
  const html = await read('index.html'), offer = JSON.parse(await read('offer.json'));
  const academy = offer.families.find(family => family.id === 'academia');
  assert.equal(academy.pricingType, 'starting_quote');
  assert.equal(academy.monthlyFrom, 30000);
  assert.equal(Object.hasOwn(academy, 'setupFrom'), false);
  const card = html.match(/<article[^>]*id="solucion-academia"[\s\S]*?<\/article>/)?.[0];
  const reference = [...html.matchAll(/<article class="implementation-card">[\s\S]*?<\/article>/g)].map(match => match[0]).find(block => block.includes('<h3>Gestudio</h3>'));
  for (const block of [card, reference]) {
    assert.ok(block);
    assert.match(block, /Desde \$ 27\.000/);
    assert.match(block, /pago anual anticipado de 12 meses/);
    assert.match(block, /mes a mes desde \$ 30\.000\/mes/);
    assert.match(block, /Implementación y migración a cotizar/);
    assert.match(block, /Puesta en marcha a cotizar/);
    assert.match(block, /una institución/);
    assert.doesNotMatch(block, /NaN|undefined|Bonificada|Instalación desde/);
  }
  assert.ok(!offer.fixedPlans.some(plan => plan.product === 'academia'));
  for (const family of data.families.filter(family => ['menu', 'mesa'].includes(family.id))) {
    assert.equal(Object.hasOwn(family, 'setupFrom'), false, family.id);
    const block = html.match(new RegExp('<article[^>]*id="solucion-' + family.id + '"[\\s\\S]*?<\\/article>'))?.[0];
    assert.ok(block, family.id);
    assert.match(block, /Puesta en marcha a cotizar/);
    assert.doesNotMatch(block, /Instalación desde|NaN|undefined|Bonificada/);
    assert.ok(!offer.fixedPlans.some(plan => plan.product === family.id));
  }
  const generatedReference = await readFile(path.join(output, 'consulta/price-references.js'), 'utf8');
  const values = await import('data:text/javascript,' + encodeURIComponent(generatedReference));
  assert.deepEqual(values.priceReferences, {academia:{currency:'ARS', monthlyFrom:30000}});
});

test('billing selector defaults to annual and preserves trusted prices and benefits without payment totals', async t => {
  const { read } = await fixture(t);
  const controls = ['annual', 'monthly'].map(mode => ({ dataset: { portfolioBilling: mode }, attributes: {}, setAttribute(key, value) { this.attributes[key] = value; }, addEventListener() {} }));
  const keys = ['[data-plan-price]', '[data-plan-period]', '[data-plan-setup]', '[data-plan-setup-note]', '[data-plan-link]'];
  const rows = new Map(['web:presencia', 'web:negocio', 'catalogo:catalogo', 'catalogo:pedidos', 'catalogo:gestion'].map(key => {
    const fields = new Map(keys.map(selector => [selector, { textContent: '', href: '' }]));
    return [key, { fields, querySelector(selector) { return fields.get(selector); } }];
  }));
  const note = { textContent: '' };
  const at = launchPromotion.reviewedOn + 'T12:00:00-03:00';
  const makeContext = search => vm.createContext({ URLSearchParams, Intl,
    quoteLaunch: (plan, options) => quoteLaunch(plan, {...options, at}),
    money: formatOfferMoney, launchPromotion, launchIsActive: () => launchIsActive(at),
    window: { location: { search } }, document: {
      querySelectorAll: () => controls,
      querySelector(selector) { const key = selector.match(/^\[data-portfolio-plan="([^"]+)"\]$/)?.[1]; return key ? rows.get(key) : selector === '[data-portfolio-billing-note]' ? note : null; },
    },
  });
  const moduleSource = await read('productos.js');
  assert.match(moduleSource, /from '\/offer-policy\.js\?v=/);
  const script = moduleSource.replace(/^import[^\n]+\n/, '');
  assert.doesNotMatch(script, /^import/m);
  assert.doesNotMatch(script, /data-plan-total|data-total-heading|data-plan-first-payment|Primer pago|Total anticipado/);
  const context = makeContext('?amount=1&setup=0&discount=1&domain=free');
  vm.runInContext(script, context);
  assert.equal(controls[0].attributes['aria-pressed'], 'true');
  const plans = source.webOffer.plans.map(p => ({...p, product:'web'})).concat(catalog.plans.map(p => ({...p, product:'catalogo'})));
  const setupDue = [0,100000,0,37500,50000];
  plans.forEach((plan, i) => {
    const fields = rows.get(plan.product + ':' + plan.id).fields;
    assert.equal(fields.get('[data-plan-price]').textContent, formatOfferMoney(plan.annualMonthlyEquivalent));
    assert.equal(fields.get('[data-plan-setup]').textContent, setupDue[i] === 0 ? 'Bonificada' : formatOfferMoney(setupDue[i]));
    assert.match(fields.get('[data-plan-period]').textContent, /pago anual anticipado de 12 meses/);
    assert.equal(fields.get('[data-plan-setup-note]').textContent, (setupDue[i] === 0 ? '100%' : '50%') + ' bonificada con anual de lanzamiento');
    const url = new URL(fields.get('[data-plan-link]').href, 'https://scalaris.com.ar');
    assert.equal(url.searchParams.get('product'), plan.product);
    assert.equal(url.searchParams.get('plan'), plan.id);
    assert.equal(url.searchParams.get('billing'), 'annual');
    for (const untrusted of ['amount', 'setup', 'discount', 'domain']) assert.equal(url.searchParams.get(untrusted), null);
  });
  // Web's agreed 50% waiver is 100k; the 50k cap belongs to other quoted systems.
  assert.equal(rows.get('web:negocio').fields.get('[data-plan-setup]').textContent, '$ 100.000');
  assert.match(note.textContent, /pago anual anticipado de 12 meses/);
  assert.match(note.textContent, /sujeto a cupo/);
  vm.runInContext('showBilling("monthly")', context);
  assert.equal(controls[1].attributes['aria-pressed'], 'true');
  plans.forEach(plan => {
    const fields = rows.get(plan.product + ':' + plan.id).fields;
    assert.equal(fields.get('[data-plan-price]').textContent, formatOfferMoney(plan.monthlyPrice));
    assert.equal(fields.get('[data-plan-setup]').textContent, formatOfferMoney(plan.setupFee));
    assert.equal(fields.get('[data-plan-period]').textContent, '/mes, pagando mes a mes');
    assert.match(fields.get('[data-plan-setup-note]').textContent, /3 cuotas sin recargo/);
    const url = new URL(fields.get('[data-plan-link]').href, 'https://scalaris.com.ar');
    assert.equal(url.searchParams.get('product'), plan.product);
    assert.equal(url.searchParams.get('plan'), plan.id);
    assert.equal(url.searchParams.get('billing'), 'monthly');
    for (const untrusted of ['amount', 'setup', 'discount', 'domain']) assert.equal(url.searchParams.get(untrusted), null);
  });
  assert.match(note.textContent, /3 cuotas sin recargo/);
  vm.runInContext(script, makeContext('?billing=monthly&amount=1&setup=0'));
  assert.equal(controls[1].attributes['aria-pressed'], 'true');
  assert.equal(rows.get('catalogo:gestion').fields.get('[data-plan-price]').textContent, '$ 35.000');
  vm.runInContext(script, makeContext('?billing=FREE&amount=1&setup=0'));
  assert.equal(controls[0].attributes['aria-pressed'], 'true');
  assert.equal(rows.get('catalogo:gestion').fields.get('[data-plan-price]').textContent, '$ 31.500');
  assert.equal(new URL(rows.get('catalogo:gestion').fields.get('[data-plan-link]').href, 'https://scalaris.com.ar').searchParams.get('billing'), 'annual');
});

test('expired launch selector charges the full setup and stops promising gifts or three installments', async t => {
  const { read } = await fixture(t);
  const at = '2026-12-01T00:00:00-03:00';
  assert.equal(launchIsActive(at), false);
  const controls = ['annual', 'monthly'].map(mode => ({dataset:{portfolioBilling:mode},attributes:{},setAttribute(key,value){this.attributes[key]=value;},addEventListener(){}}));
  const keys = ['[data-plan-price]', '[data-plan-period]', '[data-plan-setup]', '[data-plan-setup-note]', '[data-plan-link]'];
  const plans = source.webOffer.plans.map(p => ({...p,product:'web'})).concat(catalog.plans.map(p => ({...p,product:'catalogo'})));
  const rows = new Map(plans.map(p => {
    const fields = new Map(keys.map(selector => [selector,{textContent:'',href:''}]));
    return [p.product+':'+p.id,{fields,querySelector(selector){return fields.get(selector);}}];
  }));
  const note = {textContent:''};
  const context = vm.createContext({URLSearchParams,Intl,money:formatOfferMoney,launchPromotion,
    quoteLaunch:(plan,options)=>quoteLaunch(plan,{...options,at}),launchIsActive:()=>false,
    window:{location:{search:'?billing=annual&promotion=true&discount=1&domain=free&setup=0'}},
    document:{querySelectorAll:()=>controls,querySelector(selector){const key=selector.match(/^\[data-portfolio-plan="([^"]+)"\]$/)?.[1];return key?rows.get(key):selector==='[data-portfolio-billing-note]'?note:null;}},
  });
  const script = (await read('productos.js')).replace(/^import[^\n]+\n/,'');
  vm.runInContext(script, context);
  assert.equal(controls[0].attributes['aria-pressed'],'true');
  const noExpiredBenefit = /bonificad|bonificación|primer año de dominio|3 cuotas|sin recargo|cuota 1/i;
  plans.forEach(plan => {
    const fields=rows.get(plan.product+':'+plan.id).fields;
    assert.equal(fields.get('[data-plan-price]').textContent,formatOfferMoney(plan.annualMonthlyEquivalent));
    assert.equal(fields.get('[data-plan-setup]').textContent,formatOfferMoney(plan.setupFee));
    assert.equal(fields.get('[data-plan-setup-note]').textContent,'Por única vez');
    assert.match(fields.get('[data-plan-period]').textContent,/pago anual anticipado de 12 meses/);
    assert.doesNotMatch(fields.get('[data-plan-setup-note]').textContent,noExpiredBenefit);
    const link=new URL(fields.get('[data-plan-link]').href,'https://scalaris.com.ar');
    assert.equal(link.searchParams.get('billing'),'annual');
    for(const field of ['promotion','discount','domain','setup'])assert.equal(link.searchParams.get(field),null);
  });
  assert.match(note.textContent,/Puesta en marcha completa adicional/);
  assert.match(note.textContent,/Dominio propio por separado/);
  assert.doesNotMatch(note.textContent,noExpiredBenefit);
  vm.runInContext('showBilling("monthly")',context);
  assert.equal(controls[1].attributes['aria-pressed'],'true');
  plans.forEach(plan=>{
    const fields=rows.get(plan.product+':'+plan.id).fields;
    assert.equal(fields.get('[data-plan-price]').textContent,formatOfferMoney(plan.monthlyPrice));
    assert.equal(fields.get('[data-plan-setup]').textContent,formatOfferMoney(plan.setupFee));
    assert.equal(fields.get('[data-plan-setup-note]').textContent,'Por única vez');
    assert.doesNotMatch(fields.get('[data-plan-setup-note]').textContent,noExpiredBenefit);
    assert.equal(new URL(fields.get('[data-plan-link]').href,'https://scalaris.com.ar').searchParams.get('billing'),'monthly');
  });
  assert.match(note.textContent,/promoción de lanzamiento finalizó/);
  assert.doesNotMatch(note.textContent,noExpiredBenefit);
});
