import {readFile,writeFile} from 'node:fs/promises';
import {quoteLaunch} from '../public/offer-policy.js';
export const launchPromotion=JSON.parse(await readFile(new URL('../commercial/launch-promotion.json',import.meta.url),'utf8'));
export const getLaunchQuote=(plan,options={})=>quoteLaunch(plan,{at:launchPromotion.reviewedOn+'T12:00:00-03:00',...options,policy:launchPromotion});
export const launchTerms='Mensual por defecto. Web y Catálogo: anual opcional anticipado de doce meses con 10% sólo en el abono. Implementación completa por única vez, al comenzar y por separado en ambas modalidades. Dominio propio y renovación a nombre y cargo del cliente. Las propuestas de otros productos tienen condiciones específicas.';
export async function syncLaunchPolicy(){
  const file=new URL('../public/offer-policy.js',import.meta.url);
  const source=await readFile(file,'utf8');
  const next=source.replace(/export const launchPromotion = Object\.freeze\([^\n]*\);/, 'export const launchPromotion = Object.freeze('+JSON.stringify(launchPromotion).replace(/</g,'\\u003c')+');');
  if(source!==next)await writeFile(file,next);
}
