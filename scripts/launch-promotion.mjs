import {readFile,writeFile} from 'node:fs/promises';
import {quoteLaunch} from '../public/offer-policy.js';
export const launchPromotion=JSON.parse(await readFile(new URL('../commercial/launch-promotion.json',import.meta.url),'utf8'));
// Callers may provide the billing rate; otherwise use the trusted plan's own prices,
// rather than letting a closed campaign redefine the current subscription discount.
export const getLaunchQuote=(plan,options={})=>quoteLaunch(plan,{at:launchPromotion.reviewedOn+'T12:00:00-03:00',...options,policy:launchPromotion,annualDiscountRate:options.annualDiscountRate??(1-plan?.annualMonthlyEquivalent/plan?.monthlyPrice)});
export const launchTerms='Web y Catálogo: mensualidad y puesta en marcha al comenzar en modalidad mes a mes. Con doce meses por adelantado, tarifa anual según el plan y puesta en marcha 100% bonificada. Ahorro comparado con doce mensualidades al precio actual más la implementación. Dominio propio y renovación a nombre y cargo del cliente. Las propuestas de otros productos tienen condiciones específicas.';
export async function syncLaunchPolicy(){
  const file=new URL('../public/offer-policy.js',import.meta.url);
  const source=await readFile(file,'utf8');
  const next=source.replace(/export const launchPromotion = Object\.freeze\([^\n]*\);/, 'export const launchPromotion = Object.freeze('+JSON.stringify(launchPromotion).replace(/</g,'\\u003c')+');');
  if(source!==next)await writeFile(file,next);
}
