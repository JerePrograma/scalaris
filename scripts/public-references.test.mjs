import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolvePublicReference,validatePublicOffer} from './public-references.mjs';

const root=fileURLToPath(new URL('../public/',import.meta.url));
const products=fileURLToPath(new URL('../public/productos/index.html',import.meta.url));
const homepage=fileURLToPath(new URL('../public/index.html',import.meta.url));

test('root-absolute, relative and inter-page anchors resolve as browser URLs within public',()=>{
  const rootLink=resolvePublicReference(root,homepage,'/productos/#products-title');
  assert.equal(rootLink.kind,'static');assert.ok(rootLink.file.endsWith('index.html'));
  assert.equal(resolvePublicReference(root,products,'../catalogo/?billing=annual&amp;plan=catalogo#planes').kind,'static');
  assert.equal(resolvePublicReference(root,products,'https://scalaris.com.ar/catalogo/#planes').kind,'static');
  assert.throws(()=>resolvePublicReference(root,products,'../catalogo/#missing-anchor'),/Ancla inexistente/);
  assert.throws(()=>resolvePublicReference(root,products,'/missing-page/'),/Recurso local inexistente/);
});

test('only registered proxy boundaries may bypass static filesystem checks and no network is used',()=>{
  const options={dynamicPrefixes:['/comercio']};
  assert.equal(resolvePublicReference(root,products,'/comercio/t/menu-demo/gestion?demoView=cash',options).kind,'dynamic');
  assert.equal(resolvePublicReference(root,products,'/comercio',options).kind,'dynamic');
  assert.throws(()=>resolvePublicReference(root,products,'/comercio-evil/t/menu-demo',options),/Recurso local inexistente/);
  assert.equal(resolvePublicReference(root,products,'https://scalaris.com.ar/burger-house-3/',{externallyManagedPrefixes:['/burger-house-3']}).kind,'externally-managed');
  assert.throws(()=>resolvePublicReference(root,products,'/burger-house-3-unregistered/',{externallyManagedPrefixes:['/burger-house-3']}),/Recurso local inexistente/);
  assert.equal(resolvePublicReference(root,products,'https://external.invalid/not-read').kind,'external');
  assert.throws(()=>resolvePublicReference(root,products,'/assets%2f..%2f.private/file'),/separadores/);
  assert.throws(()=>resolvePublicReference(root,products,'javascript:alert(1)'),/Esquema/);
  assert.throws(()=>resolvePublicReference(root,products,'https://user:secret@scalaris.com.ar/catalogo/'),/credenciales/);
});

test('public offer projection rejects bank, issuer and source fields while permitting changed approved prices',()=>{
  const offer=JSON.parse(readFileSync(new URL('../public/catalogo/offer.json',import.meta.url),'utf8'));
  assert.deepEqual(validatePublicOffer(offer),[]);
  const changed=structuredClone(offer);changed.plans[0].monthlyPrice=16000;
  assert.deepEqual(validatePublicOffer(changed),[]);
  changed.billing.bankTransfer={alias:'synthetic'};changed.issuer={taxId:'synthetic'};changed.plans[0].costARS=1;
  assert.ok(validatePublicOffer(changed).some(error=>error.includes('bankTransfer')));
  assert.ok(validatePublicOffer(changed).some(error=>error.includes('issuer')));
  assert.ok(validatePublicOffer(changed).some(error=>error.includes('costARS')));
});
