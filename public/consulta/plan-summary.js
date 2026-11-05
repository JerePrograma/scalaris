import {quoteLaunch,formatOfferMoney as money} from '../offer-policy.js?v=20261105-planesclaros';
const families=Object.freeze({catalogo:{endpoint:'/catalogo/offer.json',plans:{catalogo:'Vidriera',pedidos:'Flujo',gestion:'Pulso'}},web:{endpoint:'/web/offer.json',plans:{presencia:'Origen',negocio:'Web de hasta 5 páginas'}}});
const modes=new Set(['annual','monthly']);
export function hasPlanSelection(interest){return Boolean(interest&&Object.hasOwn(families,interest.product)&&Object.hasOwn(families[interest.product].plans,interest.plan)&&modes.has(interest.billing));}
function amount(value,name,{positive=false}={}){if(!Number.isSafeInteger(value)||value<(positive?1:0))throw new Error('Importe de '+name+' inválido.');return value;}
/** URL parameters select an allowlisted product only. Amounts and waivers come from the published offer. */
export function buildPlanSummary(offer,interest,options={}){
  if(!hasPlanSelection(interest))return null;
  if(offer?.currency!=='ARS'||!Array.isArray(offer.plans)||typeof offer.billing?.setupAnnualWaived!=='boolean')throw new Error('La oferta no tiene el formato esperado.');
  if(amount(offer.billing.annualMonths,'período',{positive:true})!==12)throw new Error('Período inválido.');
  const matching=offer.plans.filter(p=>p.id===interest.plan);
  if(matching.length!==1)throw new Error('El plan no está disponible en la oferta.');
  const plan=matching[0],annual=interest.billing==='annual';
  const annualDiscountRate=offer.billing.annualDiscountRate??(1-plan.annualMonthlyEquivalent/plan.monthlyPrice);
  const q=quoteLaunch(plan,{...options,product:interest.product,billing:interest.billing,eligible:false,annualDiscountRate,setupAnnualWaived:offer.billing.setupAnnualWaived});
  const annualDiscountPercent=new Intl.NumberFormat('es-AR',{style:'percent',maximumFractionDigits:2}).format(q.annualDiscountRate);
  const installationWaived=annual&&offer.billing.setupAnnualWaived;
  return Object.freeze({plan:interest.plan,name:families[interest.product].plans[interest.plan],billing:interest.billing,monthlyAmount:annual?q.annualMonthlyEquivalent:q.monthlyPrice,standardMonthlyAmount:q.monthlyPrice,annualDiscountRate:q.annualDiscountRate,annualDiscountPercent,annualSavings:q.annualSavings,firstYearSavings:q.firstYearSavings,twelveMonthlyPayments:q.twelveMonthlyPayments,
    savingsText:installationWaived?`Ahorrás ${money(q.firstYearSavings)} el primer año: ${money(q.annualSavings)} en el abono y ${money(q.setupDiscount)} de puesta en marcha bonificada. Comparación con 12 mensualidades al precio actual más la puesta en marcha.`:`Ahorrás ${money(q.annualSavings)} en el abono anual, frente a 12 mensualidades al precio actual.`,
    periodMonths:annual?12:1,subscription:annual?q.annualSubscription:q.monthlyPrice,installation:q.setupDue,standardInstallation:plan.setupFee,installationDiscount:q.setupDiscount,installationWaived,installationPayment:annual?q.setupDue:q.setupInstallments[0],installationBalance:q.setupBalanceAfterInitial,installationSchedule:q.setupInstallments,paymentSchedule:q.monthlyPayments,total:q.totalInitial,totalLabel:annual?'Total a pagar por 12 meses':'Total inicial del primer mes',roundingDiscount:q.roundingDiscount,annualTotalBeforeRounding:q.annualTotalBeforeRounding,promotionActive:q.promotionActive,domainIncluded:q.domainIncluded,
    domainText:'Dominio propio: registro y renovación a nombre y cargo del cliente, por separado. No está incluido en este total.',
    promotionNote:installationWaived?'Puesta en marcha bonificada al 100% con pago anual anticipado. La implementación y su alcance siguen incluidos. Los acuerdos ya aceptados conservan sus condiciones.':'Condiciones para nuevas propuestas. La puesta en marcha se abona completa al comenzar, por separado del abono. Los acuerdos ya aceptados conservan sus condiciones.',
    nextPayment:annual?`El abono anual se paga por adelantado y cubre 12 meses desde la activación acordada, con precio fijo durante ese período. La renovación se informa con treinta días de anticipación, sin repetir la puesta en marcha del mismo alcance.`:`Después de la instalación, el abono es ${money(q.monthlyPrice)} al mes, según las condiciones de actualización informadas.`,
  });
}
export function planSummaryRows(p){
  const annual=p.billing==='annual';
  const rows=[['Plan elegido',p.name],['Modalidad',annual?'Plan anual · pago anticipado':'Pago mes a mes']];
  if(annual)rows.push(['12 mensualidades al precio actual',money(p.twelveMonthlyPayments)]);
  rows.push([annual?'Abono por mes equivalente':'Abono mensual',money(p.monthlyAmount)],[annual?'Abono anual · 12 meses por adelantado':'Primer mes',money(p.subscription)]);
  if(annual)rows.push(['Ahorro anual en el abono',money(p.annualSavings)]);
  if(p.installationWaived){
    rows.push(['Puesta en marcha habitual',money(p.standardInstallation)],['Bonificación de puesta en marcha (100%)','−'+money(p.installationDiscount)],['Puesta en marcha a pagar',money(p.installation)],['Ahorro total del primer año',money(p.firstYearSavings)]);
  }else rows.push(['Puesta en marcha única · pago completo',money(p.installation)]);
  return rows;
}
export function planSummaryText(p){return['Resumen del plan de referencia',...planSummaryRows(p).map(([label,value])=>label+': '+value),p.totalLabel+': '+money(p.total),p.nextPayment,p.domainText,p.promotionNote,'Precios finales en ARS. El alcance y las condiciones se confirman con Scalaris antes del pago. Esta consulta no contrata ni activa el servicio.'].join('\n');}
export function planSummaryTotal(p){return money(p.total);}
export async function loadPlanSummary(interest,{fetchImpl=globalThis.fetch,signal,...options}={}){
  if(!hasPlanSelection(interest))return null;
  const response=await fetchImpl(families[interest.product].endpoint,{method:'GET',cache:'no-store',credentials:'omit',mode:'same-origin',signal});
  if(!response.ok)throw new Error('No se pudo consultar la oferta.');
  return buildPlanSummary(await response.json(),interest,options);
}
