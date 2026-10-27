import { existsSync,statSync,readFileSync } from 'node:fs';
import { resolve,relative,dirname,sep,extname } from 'node:path';

const origin='https://scalaris.com.ar';
const decodeHtml=value=>value.replace(/&amp;/g,'&');

/** Resolve a browser URL inside the published tree, never against a Windows drive root. */
export function resolvePublicReference(publicRoot,sourceFile,reference,{dynamicPrefixes=[],externallyManagedPrefixes=[]}={}) {
  if(typeof reference!=='string'||!reference)throw new Error('Referencia pública vacía.');
  const root=resolve(publicRoot),source=resolve(sourceFile),sourceRelative=relative(root,source);
  if(sourceRelative.startsWith('..')||sourceRelative.split(sep).includes('..'))throw new Error('La página de origen está fuera del directorio público.');
  const sourcePath='/'+sourceRelative.split(sep).join('/');
  let url;
  try{url=new URL(decodeHtml(reference),origin+sourcePath);}catch{throw new Error('Referencia pública inválida.');}
  if(!['https:','http:'].includes(url.protocol)){
    if(['tel:','mailto:','data:'].includes(url.protocol))return {kind:'external'};
    throw new Error('Esquema de enlace público no admitido.');
  }
  if(url.username||url.password)throw new Error('Un enlace público no puede incluir credenciales.');
  if(url.origin!==origin)return {kind:'external'};
  if(/%2f|%5c/i.test(url.pathname))throw new Error('La ruta pública contiene separadores codificados ambiguos.');
  let pathname,anchor;
  try{pathname=decodeURIComponent(url.pathname);anchor=decodeURIComponent(url.hash.slice(1));}catch{throw new Error('La ruta o el ancla pública tiene codificación inválida.');}
  if(pathname.includes('\\')||pathname.includes('\0'))throw new Error('La ruta pública no es válida.');
  if(dynamicPrefixes.some(prefix=>pathname===prefix||pathname.startsWith(prefix+'/')))return {kind:'dynamic',pathname,anchor};
  if(externallyManagedPrefixes.some(prefix=>pathname===prefix||pathname.startsWith(prefix+'/')))return {kind:'externally-managed',pathname,anchor};
  let file=resolve(root,'.'+pathname);
  if(file!==root&&!file.startsWith(root+sep))throw new Error('La referencia sale del directorio público.');
  if(existsSync(file)&&statSync(file).isDirectory())file=resolve(file,'index.html');
  else if(!existsSync(file)&&!extname(file)&&existsSync(file+'.html'))file+='.html';
  if(!existsSync(file)||!statSync(file).isFile())throw new Error(`Recurso local inexistente: ${pathname}`);
  if(anchor&&/\.html$/i.test(file)){
    const text=readFileSync(file,'utf8');
    const ids=new Set([...text.matchAll(/\bid=["']([^"']+)["']/g)].map(match=>match[1]));
    if(!ids.has(anchor))throw new Error(`Ancla inexistente: ${pathname}#${anchor}`);
  }
  return {kind:'static',file,pathname,anchor};
}

export function validatePublicOffer(offer) {
  const errors=[];
  const keys=(value,allowed,at)=>{
    if(!value||typeof value!=='object'||Array.isArray(value)){errors.push(`${at}: objeto inválido`);return false;}
    for(const key of Object.keys(value))if(!allowed.includes(key))errors.push(`${at}: campo no público ${key}`);
    return true;
  };
  if(!keys(offer,['schemaVersion','reviewedAt','currency','product','billing','plans'],'offer'))return errors;
  if(offer.schemaVersion!==1||offer.currency!=='ARS')errors.push('La oferta pública debe usar schemaVersion 1 y ARS.');
  if(keys(offer.product,['name','tagline','description'],'product'))for(const key of ['name','tagline','description'])if(typeof offer.product[key]!=='string'||!offer.product[key])errors.push(`product.${key}: texto requerido`);
  if(keys(offer.billing,['annualMonths','setupAnnualWaived','promotionEnd','renewalPolicy','support'],'billing')){
    if(offer.billing.annualMonths!==12)errors.push('La oferta debe indicar doce meses de pago anual.');
    if(typeof offer.billing.setupAnnualWaived!=='boolean')errors.push('La bonificación de alta debe ser explícita.');
    keys(offer.billing.support,['businessDays','hours','timezone','firstResponseTarget'],'billing.support');
  }
  if(!Array.isArray(offer.plans)||offer.plans.length!==3){errors.push('La oferta debe incluir sus tres planes.');return errors;}
  if(offer.plans.map(plan=>plan.id).join(',')!=='catalogo,pedidos,gestion')errors.push('Identificadores de planes inválidos o repetidos.');
  for(const plan of offer.plans){
    if(!keys(plan,['id','name','audience','featured','annualMonthlyEquivalent','monthlyPrice','setupFee','limits','features'],`plan.${plan.id||'unknown'}`))continue;
    for(const field of ['annualMonthlyEquivalent','monthlyPrice','setupFee'])if(!Number.isSafeInteger(plan[field])||plan[field]<0||(field!=='setupFee'&&plan[field]===0))errors.push(`plan.${plan.id}.${field}: importe inválido`);
    if(plan.monthlyPrice<plan.annualMonthlyEquivalent)errors.push(`plan.${plan.id}: el mensual debe cubrir su equivalente anual.`);
    if(keys(plan.limits,['products','imagesPerProduct','administrators','initialProductsLoaded','onboardingMinutes','revisionRounds'],`plan.${plan.id}.limits`))for(const [field,value]of Object.entries(plan.limits))if(!Number.isSafeInteger(value)||value<=0)errors.push(`plan.${plan.id}.limits.${field}: límite inválido`);
    if(!Array.isArray(plan.features)||plan.features.some(feature=>typeof feature!=='string'||!feature))errors.push(`plan.${plan.id}.features: lista inválida`);
  }
  return errors;
}
