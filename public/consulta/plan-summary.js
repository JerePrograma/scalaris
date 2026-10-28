import {quoteLaunch,formatOfferMoney as money,launchPromotion} from '../offer-policy.js?v=20261028-mensual';
const families=Object.freeze({catalogo:{endpoint:'/catalogo/offer.json',plans:{catalogo:'Vidriera',pedidos:'Flujo',gestion:'Pulso'}},web:{endpoint:'/web/offer.json',plans:{presencia:'Origen',negocio:'Web de hasta 5 páginas'}}});
const modes=new Set(['annual','monthly']);
export function hasPlanSelection(interest){return Boolean(interest&&Object.hasOwn(families,interest.product)&&Object.hasOwn(families[interest.product].plans,interest.plan)&&modes.has(interest.billing));}
function amount(value,name,{positive=false}={}){if(!Number.isSafeInteger(value)||value<(positive?1:0))throw new Error('Importe de '+name+' inválido.');return value;}
/** URL parameters select an allowlisted product only. Prices and campaign rules are trusted local data. */
export function buildPlanSummary(offer,interest,options={}){
  if(!hasPlanSelection(interest))return null;
  if(offer?.currency!=='ARS'||!Array.isArray(offer.plans)||typeof offer.billing?.setupAnnualWaived!=='boolean')throw new Error('La oferta no tiene el formato esperado.');
  if(amount(offer.billing.annualMonths,'período',{positive:true})!==12)throw new Error('Período inválido.');
  const matching=offer.plans.filter(p=>p.id===interest.plan);
  if(matching.length!==1)throw new Error('El plan no está disponible en la oferta.');
  const plan=matching[0],annual=interest.billing==='annual';
  const q=quoteLaunch(plan,{product:interest.product,billing:interest.billing,...options});
  return Object.freeze({plan:interest.plan,name:families[interest.product].plans[interest.plan],billing:interest.billing,monthlyAmount:annual?q.annualMonthlyEquivalent:q.monthlyPrice,periodMonths:annual?12:1,subscription:annual?q.annualSubscription:q.monthlyPrice,installation:q.setupDue,standardInstallation:plan.setupFee,installationDiscount:q.setupDiscount,installationWaived:q.setupDiscount>0&&q.setupDue===0,installationPayment:annual?q.setupDue:q.setupInstallments[0],installationBalance:q.setupBalanceAfterInitial,installationSchedule:q.setupInstallments,paymentSchedule:q.monthlyPayments,total:q.totalInitial,roundingDiscount:q.roundingDiscount,annualTotalBeforeRounding:q.annualTotalBeforeRounding,promotionActive:q.promotionActive,domainIncluded:q.domainIncluded,
    domainText:q.domainIncluded?'Primer año de un .com.ar disponible incluido, a nombre del cliente. Disponibilidad y vinculación se confirman antes de contratar; renovación posterior a su cargo.':'Dominio propio: registro y renovación a nombre y cargo del cliente, por separado. No está incluido en este total.',
    promotionNote:q.promotionActive?'Referencia con promoción, sujeta a confirmación de cupo: primeros cinco clientes nuevos o hasta el 30/11/2026, lo que ocurra primero.':'Importes de la tarifa estándar, sin bonificaciones de lanzamiento.',
    nextPayment:annual?'El abono cubre 12 meses desde la activación acordada. La renovación se informa con treinta días de anticipación, sin repetir el alta del mismo alcance.':q.setupInstallments.length===3?`Mes 2: ${money(q.monthlyPayments[1])}. Mes 3: ${money(q.monthlyPayments[2])}. Desde el mes 4, sólo el abono de ${money(q.monthlyPrice)}, según las condiciones de actualización informadas. Queda un saldo de puesta en marcha de ${money(q.setupBalanceAfterInitial)} después del primer pago. Las condiciones de entrega, baja y saldo se acuerdan antes de cobrar.`:`Después de la instalación, el abono es ${money(q.monthlyPrice)} al mes, según las condiciones de actualización informadas.`,
  });
}
export function planSummaryRows(p){
  const rows=[['Plan elegido',p.name],['Modalidad',p.billing==='annual'?'Plan anual · pago anticipado':'Pago mes a mes'],[p.billing==='annual'?'Abono por mes equivalente':'Abono mensual',money(p.monthlyAmount)],[p.billing==='annual'?'Abono por 12 meses':'Primer mes',money(p.subscription)]];
  if(p.installationDiscount>0){rows.push(['Puesta en marcha de referencia',money(p.standardInstallation)],['Bonificación de puesta en marcha','−'+money(p.installationDiscount)]);}
  rows.push(['Puesta en marcha total',p.installationWaived?'Bonificada':money(p.installation)]);
  if(p.roundingDiscount>0)rows.push(['Bonificación adicional de redondeo','−'+money(p.roundingDiscount)]);
  if(p.billing==='monthly'&&p.installationSchedule.length===3)rows.push(['Cuota de puesta en marcha en este pago (1 de 3)',money(p.installationPayment)],['Saldo de puesta en marcha después de este pago',money(p.installationBalance)]);
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
