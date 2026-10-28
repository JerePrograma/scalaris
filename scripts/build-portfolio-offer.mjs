import {renderPortfolio} from './portfolio-page.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = {};
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index], value = process.argv[index + 1];
  if (!['--source', '--catalog-source', '--public-root'].includes(key) || !value || args[key]) throw new Error('Use --source, --catalog-source or --public-root with a single path.');
  args[key] = path.resolve(value);
}
const publicRoot = args['--public-root'] || path.join(root, 'public');
const source = JSON.parse(await readFile(args['--source'] || path.join(root, 'commercial/portfolio-offer.json'), 'utf8'));
const catalog = JSON.parse(await readFile(args['--catalog-source'] || path.join(publicRoot, 'catalogo/offer.json'), 'utf8'));
assert.equal(source.currency, 'ARS');
assert.equal(catalog.currency, 'ARS');
assert.deepEqual(source.families.map(family => family.id), ['web', 'catalogo', 'menu', 'mesa', 'academia', 'crm']);
assert.deepEqual(source.webOffer.plans.map(plan => plan.id), ['presencia', 'negocio']);
assert.deepEqual(catalog.plans.map(plan => plan.id), ['catalogo', 'pedidos', 'gestion']);
const safeAmount = value => Number.isSafeInteger(value) && value >= 0;
for (const offer of [source.webOffer, catalog]) {
  assert.ok(Number.isSafeInteger(offer.billing.annualMonths) && offer.billing.annualMonths > 0);
  assert.equal(typeof offer.billing.setupAnnualWaived, 'boolean');
  for (const plan of offer.plans) {
    assert.ok(safeAmount(plan.annualMonthlyEquivalent) && plan.annualMonthlyEquivalent > 0);
    assert.ok(safeAmount(plan.monthlyPrice) && plan.monthlyPrice >= plan.annualMonthlyEquivalent);
    assert.ok(safeAmount(plan.setupFee));
  }
}
assert.equal(source.webOffer.billing.annualPayment, 'upfront');
const text = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const money = value => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value).replace(/\s/g, ' ');
const safeUrl = value => {
  const url = new URL(value, 'https://scalaris.com.ar');
  assert.equal(url.protocol, 'https:');
  assert.ok(!url.username && !url.password);
  return value;
};
for (const family of source.families) {
  assert.ok(family.image.startsWith('/assets/proyectos/'));
  safeUrl(family.detailsUrl);
  if (family.demoUrl) safeUrl(family.demoUrl);
  if (family.pricingType === 'starting_quote') {
    assert.ok(safeAmount(family.monthlyFrom) && family.monthlyFrom > 0);
    if (family.setupFrom !== undefined) assert.ok(safeAmount(family.setupFrom));
  }
}

// Explicit public projection: never copy unknown source fields or internal research.
const web = source.webOffer;
const publicWeb = {
  schemaVersion: web.schemaVersion, currency: 'ARS',
  product: { id: web.product.id, name: web.product.name, description: web.product.description },
  billing: {
    annualMonths: web.billing.annualMonths, annualPayment: web.billing.annualPayment,
    setupAnnualWaived: web.billing.setupAnnualWaived, renewalPolicy: web.billing.renewalPolicy,
    support: { businessDays: web.billing.support.businessDays, hours: web.billing.support.hours, timezone: web.billing.support.timezone, firstResponseTarget: web.billing.support.firstResponseTarget },
  },
  plans: web.plans.map(plan => ({ id: plan.id, name: plan.name, annualMonthlyEquivalent: plan.annualMonthlyEquivalent, monthlyPrice: plan.monthlyPrice, setupFee: plan.setupFee, audience: plan.audience,
    limits: { pages: plan.limits.pages, ...(plan.limits.sections ? { sections: plan.limits.sections } : {}), revisionRounds: plan.limits.revisionRounds, contentMinutesPerMonth: plan.limits.contentMinutesPerMonth, ...(plan.limits.contentBatchesPerMonth ? { contentBatchesPerMonth: plan.limits.contentBatchesPerMonth } : {}) },
    features: [...plan.features], contentService: plan.contentService })),
  ...(web.includedServices ? { includedServices: {
    hosting: web.includedServices.hosting === true, https: web.includedServices.https === true,
    domain: { extension: web.includedServices.domain.extension, quantity: web.includedServices.domain.quantity, registrationAndRenewal: web.includedServices.domain.registrationAndRenewal === true, condition: web.includedServices.domain.condition },
    email: { provider: web.includedServices.email.provider, maxAccounts: web.includedServices.email.maxAccounts, storageGbPerAccount: web.includedServices.email.storageGbPerAccount, condition: web.includedServices.email.condition },
  } } : {}),
};
const fixedPlans = [
  ...publicWeb.plans.map(plan => ({ product: 'web', productName: publicWeb.product.name, id: plan.id, name: plan.name, audience: plan.audience, annualMonthlyEquivalent: plan.annualMonthlyEquivalent, monthlyPrice: plan.monthlyPrice, setupFee: plan.setupFee, setupAnnualWaived: publicWeb.billing.setupAnnualWaived, annualMonths: publicWeb.billing.annualMonths })),
  ...catalog.plans.map(plan => ({ product: 'catalogo', productName: catalog.product.name, id: plan.id, name: plan.name, audience: plan.audience, annualMonthlyEquivalent: plan.annualMonthlyEquivalent, monthlyPrice: plan.monthlyPrice, setupFee: plan.setupFee, setupAnnualWaived: catalog.billing.setupAnnualWaived, annualMonths: catalog.billing.annualMonths })),
];
const families = source.families.map(family => ({ id: family.id, name: family.name, need: family.need, category: family.category, description: family.description, status: family.status, statusLabel: family.statusLabel, pricingType: family.pricingType,
  ...(family.pricingType === 'starting_quote' ? { monthlyFrom: family.monthlyFrom, ...(family.setupFrom !== undefined ? { setupFrom: family.setupFrom } : {}) } : {}), image: family.image, imageAlt: family.imageAlt, features: [...family.features], detailsUrl: family.detailsUrl, demoUrl: family.demoUrl, boundary: family.boundary }));
const addons = source.addons.map(addon => ({ id: addon.id, name: addon.name, pricingType: addon.pricingType, ...(addon.pricingType === 'fixed_batch' ? { price: addon.price, minutes: addon.minutes } : {}), description: addon.description }));
const offer = { schemaVersion: 1, reviewedAt: source.reviewedAt, currency: 'ARS', validUntil: source.validUntil, webOffer: publicWeb, fixedPlans, families, addons, integrationNote: source.integrationNote, generalTerms: source.generalTerms };
const result = await renderPortfolio({offer,publicRoot});
console.log(JSON.stringify(result));
