import {quoteLaunch,formatOfferMoney as money} from '../offer-policy.js?v=20261105-personalizado';
const families=Object.freeze({catalogo:{endpoint:'/catalogo/offer.json',plans:{catalogo:'Vidriera',pedidos:'Flujo',gestion:'Pulso'}},web:{endpoint:'/web/offer.json',plans:{presencia:'Origen',negocio:'Web de hasta 5 páginas'}}});
const modes=new Set(['annual','monthly']);
export function hasPlanSelection(interest){return Boolean(interest&&Object.hasOwn(families,interest.product)&&Object.hasOwn(families[interest.product].plans,interest.plan)&&modes.has(interest.billing));}
function amount(value,name,{positive=false}={}){if(!Number.isSafeInteger(value)||value<(positive?1:0))throw new Error('Importe de '+name+' inválido.');return value;}
/** URL parameters select an allowlisted product only. New proposals use the published base terms. */
export function buildPlanSummary(offer,interest,options={}){
  if(!hasPlanSelection(interest))return null;
  if(offer?.currency!=='ARS'||!Array.isArray(offer.plans)||offer.billing?.setupAnnualWaived!==false||!Number.isFinite(offer.billing?.annualDiscountRate))throw new Error('La oferta no tiene el formato esperado.');
  if(amount(offer.billing.annualMonths,'período',{positive:true})!==12)throw new Error('Período inválido.');
  const matching=offer.plans.filter(p=>p.id===interest.plan);
  if(matching.length!==1)throw new Error('El plan no está disponible en la oferta.');
  const plan=matching[0],annual=interest.billing==='annual';
  const q=quoteLaunch(plan,{...options,product:interest.product,billing:interest.billing,eligible:false,annualDiscountRate:offer.billing.annualDiscountRate});
  const annualDiscountPercent=new Intl.NumberFormat('es-AR',{style:'percent',maximumFractionDigits:2}).format(q.annualDiscountRate);
  return Object.freeze({plan:interest.plan,name:families[interest.product].plans[interest.plan],billing:interest.billing,monthlyAmount:annual?q.annualMonthlyEquivalent:q.monthlyPrice,standardMonthlyAmount:q.monthlyPrice,annualDiscountRate:q.annualDiscountRate,annualDiscountPercent,annualSavings:q.annualSavings,twelveMonthlyPayments:q.twelveMonthlyPayments,savingsText:`Ahorrás ${money(q.annualSavings)} en el abono anual (${annualDiscountPercent}), frente a 12 mensualidades al precio actual.`,periodMonths:annual?12:1,subscription:annual?q.annualSubscription:q.monthlyPrice,installation:q.setupDue,standardInstallation:plan.setupFee,installationDiscount:q.setupDiscount,installationWaived:q.setupDiscount>0&&q.setupDue===0,installationPayment:annual?q.setupDue:q.setupInstallments[0],installationBalance:q.setupBalanceAfterInitial,installationSchedule:q.setupInstallments,paymentSchedule:q.monthlyPayments,total:q.totalInitial,roundingDiscount:q.roundingDiscount,annualTotalBeforeRounding:q.annualTotalBeforeRounding,promotionActive:q.promotionActive,domainIncluded:q.domainIncluded,
    domainText:'Dominio propio: registro y renovación a nombre y cargo del cliente, por separado. No está incluido en este total.',
    promotionNote:'Condiciones para nuevas propuestas. La puesta en marcha se abona completa al comenzar, por separado del abono. Los acuerdos ya aceptados conservan sus condiciones.',
    nextPayment:annual?`El abono anual se paga por adelantado y cubre 12 meses desde la activación acordada, con precio fijo durante ese período. El descuento del ${annualDiscountPercent} se aplica sólo al abono. La renovación se informa con treinta días de anticipación, sin repetir la puesta en marcha del mismo alcance.`:`Después de la instalación, el abono es ${money(q.monthlyPrice)} al mes, según las condiciones de actualización informadas.`,
  });
}
export function planSummaryRows(p){
  const annual=p.billing==='annual';
  const rows=[['Plan elegido',p.name],['Modalidad',annual?'Plan anual · pago anticipado':'Pago mes a mes']];
  if(annual)rows.push(['12 mensualidades al precio actual',money(p.twelveMonthlyPayments)]);
  rows.push([annual?'Abono por mes equivalente':'Abono mensual',money(p.monthlyAmount)],[annual?'Abono anual · 12 meses por adelantado':'Primer mes',money(p.subscription)]);
  if(annual)rows.push([`Ahorro anual en el abono (${p.annualDiscountPercent})`,money(p.annualSavings)]);
  rows.push(['Puesta en marcha única · pago completo',money(p.installation)]);
  return rows;
}
export function planSummaryText(p){return['Resumen del plan de referencia',...planSummaryRows(p).map(([label,value])=>label+': '+value),'Total inicial: '+money(p.total),p.nextPayment,p.domainText,p.promotionNote,'Precios finales en ARS. El alcance y las condiciones se confirman con Scalaris antes del pago. Esta consulta no contrata ni activa el servicio.'].join('\n');}
export function planSummaryTotal(p){return money(p.total);}
export async function loadPlanSummary(interest,{fetchImpl=globalThis.fetch,signal,...options}={}){
  if(!hasPlanSelection(interest))return null;
  const response=await fetchImpl(families[interest.product].endpoint,{method:'GET',cache:'no-store',credentials:'omit',mode:'same-origin',signal});
  if(!response.ok)throw new Error('No se pudo consultar la oferta.');
  return buildPlanSummary(await response.json(),interest,options);
}
