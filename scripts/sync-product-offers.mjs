import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
// Product data must be refreshed before its portfolio and home projections.
for (const script of ['sync-catalog-product.mjs', 'build-portfolio-offer.mjs', 'build-web-offer.mjs', 'build-home-page.mjs']) {
  execFileSync(process.execPath, [path.join(root, 'scripts', script)], { cwd: root, stdio: 'inherit' });
}
console.log(JSON.stringify({ status: 'synchronized', families: 6, sharedShell: true }));
