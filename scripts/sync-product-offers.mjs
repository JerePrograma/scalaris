import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
// Refresh the shared catalog data first. The final catalog pass adopts the
// regenerated portfolio navigation without leaving any first-build stale prices.
for (const script of ['sync-catalog-product.mjs', 'build-portfolio-offer.mjs', 'build-web-offer.mjs', 'sync-catalog-product.mjs']) {
  execFileSync(process.execPath, [path.join(root, 'scripts', script)], { cwd: root, stdio: 'inherit' });
}

const pages = ['index.html', 'productos/index.html', 'web/index.html', 'proyectos/index.html',
  'consulta/index.html', 'catalogo/index.html', 'catalogo/demos/index.html', 'catalogo/propuesta.html'];
for (const page of pages) {
  const target = path.join(root, 'public', page);
  const html = await readFile(target, 'utf8');
  const updated = html.replace(/<nav\b[^>]*class="(?:site-nav|footer-links)"[^>]*>[\s\S]*?<\/nav>/g, nav => nav
    .replace(/<a\b[^>]*\bhref="([^"]+)"[^>]*>[\s\S]*?<\/a>/g, (link, href) => /^\/tienda(?:\/|$)/.test(new URL(href, `https://scalaris.com.ar/${page}`).pathname) ? '' : link)
    .replaceAll('Soporte y servicios', 'Desarrollo')
    .replace(/<a\b([^>]*?)href="[^"]*"([^>]*)>Planes<\/a>/g, '<a$1href="/productos/#planes"$2>Planes</a>')
    .replace(/<a\b([^>]*?)href="[^"]*"([^>]*)>Demos<\/a>/g, '<a$1href="/productos/#demos"$2>Demos</a>'))
    .replaceAll('Software para tu negocio. Tecnología para tu día a día.', 'Software para tu negocio.')
    .replaceAll('Software y soporte informático.', 'Software para tu negocio.')
    .replace(/^[\t ]+$/gm, '');
  if (updated !== html) await writeFile(target, updated);
}

const offer = JSON.parse(await readFile(path.join(root, 'commercial/portfolio-offer.json'), 'utf8'));
const first = offer.webOffer.plans[0];
const money = n => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n).replace(/\s/g, ' ');
const target = path.join(root, 'public/index.html');
const html = await readFile(target, 'utf8');
const updated = html.replace(/(<span data-web-price="annual-monthly">)[^<]*(<\/span>)/g, `$1${money(first.annualMonthlyEquivalent)}$2`);
if (updated !== html) await writeFile(target, updated);
console.log(JSON.stringify({ status: 'synchronized', families: offer.families.length, pages: pages.length }));
