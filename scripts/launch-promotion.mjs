import {readFile,writeFile} from 'node:fs/promises';
import {quoteLaunch} from '../public/offer-policy.js';
export const launchPromotion=JSON.parse(await readFile(new URL('../commercial/launch-promotion.json',import.meta.url),'utf8'));
export const getLaunchQuote=(plan,options={})=>quoteLaunch(plan,{at:launchPromotion.reviewedOn+'T12:00:00-03:00',...options,policy:launchPromotion});
export const launchTerms='Primeros cinco clientes nuevos o hasta el 30/11/2026, lo que ocurra primero. Cupos compartidos entre productos, sujetos a confirmación. Anual: doce meses por adelantado, 10% en el abono, alta bonificada según plan y primer año de .com.ar incluido. Renovación del dominio a cargo del cliente.';
export async function syncLaunchPolicy(){
  const file=new URL('../public/offer-policy.js',import.meta.url);
  const source=await readFile(file,'utf8');
  const next=source.replace(/export const launchPromotion = Object\.freeze\([^\n]*\);/, 'export const launchPromotion = Object.freeze('+JSON.stringify(launchPromotion).replace(/</g,'\\u003c')+');');
  if(source!==next)await writeFile(file,next);
}
