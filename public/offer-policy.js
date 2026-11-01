// Shared commercial arithmetic. Amounts come only from the trusted published offer.
export const launchPromotion = Object.freeze({"schemaVersion":1,"id":"lanzamiento-2026-10","reviewedOn":"2026-11-01","startsOn":"2026-10-28","endsOn":"2026-10-31","timezone":"America/Buenos_Aires","maxNewCustomers":0,"sharedAcrossProducts":true,"availability":"closed","annualDiscountRate":0.1,"monthlySetupInstallments":1,"domain":{"extension":".com.ar","includedMonths":0,"customerOwned":true,"subsequentRenewalPaidByCustomer":true},"contentMinutes":0,"revisionRounds":1,"catalogInitialProducts":{"catalogo":30,"pedidos":60,"gestion":100},"setupWaivers":{},"otherSetupDiscountRate":0,"otherSetupDiscountCap":0,"slotAssignment":"No hay cupo ni beneficio promocional vigente para nuevas propuestas.","contentScope":"La implementación delimita material, carga inicial, configuración, capacitación y revisión; adicionales a cotizar.","materialCondition":"Listado ordenado con precios y fotografías o enlaces utilizables; el cliente revisa y aprueba el contenido.","domainCondition":"Registro y renovación de dominio propio a nombre y cargo del cliente, separados del servicio.","renewal":"Mensual: precio inicial garantizado por tres meses; luego revisión trimestral con aviso de treinta días, sin ajustes retroactivos. Anual opcional: doce meses abonados por adelantado con 10% de descuento sólo en el abono y precio fijo durante ese período; renovación a la tarifa informada con treinta días de anticipación. La implementación se abona una sola vez al comenzar, por separado del abono, en ambas modalidades. Dominio propio y renovación a nombre y cargo del cliente.","monthlyCancellation":"La implementación corresponde a trabajo inicial contratado, separado del abono. Entrega, baja y tratamiento del saldo se acuerdan por escrito antes del primer pago.","exclusions":["Fotografía","Identidad de marca","Producción audiovisual","Migraciones complejas","Funciones nuevas","Gastos de terceros"],"annualRoundingStep":0,"annualRoundingPlans":[],"pricePresentation":"monthly_subscription_equivalent","roundingDescription":"No se aplica bonificación adicional ni redondeo promocional.","closedOn":"2026-11-01","closureReason":"Retirada para nuevas propuestas por decisión del fundador del 01/11/2026. Conservar acuerdos aceptados."});

function cents(value, name, positive=false) {
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0) || !Number.isSafeInteger(value*100)) throw new Error('Importe inválido: '+name);
  return value*100;
}
export const formatOfferMoney = (value, decimals=Number.isInteger(value)?0:2) => new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:decimals,minimumFractionDigits:decimals}).format(value).replace(/\s/g,' ');
export function launchIsActive(at=new Date(), policy=launchPromotion) {
  const time=new Date(at).getTime();
  return policy.availability!=='closed' && Number.isFinite(time) && time>=Date.parse(policy.startsOn+'T00:00:00-03:00') && time<=Date.parse(policy.endsOn+'T23:59:59.999-03:00');
}
export function quoteLaunch(plan,{product,billing='monthly',eligible=true,at=new Date(),policy=launchPromotion}={}) {
  if(!['monthly','annual'].includes(billing))throw new Error('Modalidad inválida.');
  const monthlyCents=cents(plan?.monthlyPrice,'abono',true),annualMonthlyCents=cents(plan?.annualMonthlyEquivalent,'abono anual',true),setupCents=cents(plan?.setupFee,'puesta en marcha');
  if(annualMonthlyCents>monthlyCents)throw new Error('Abono anual inconsistente.');
  const promotionActive=eligible===true&&launchIsActive(at,policy);
  if(annualMonthlyCents!==Math.round(monthlyCents/100*(1-policy.annualDiscountRate))*100)throw new Error('El descuento anual publicado no coincide con la campaña.');
  const annual=billing==='annual';
  const key=product+':'+plan.id;
  const rate=Object.hasOwn(policy.setupWaivers||{},key)?policy.setupWaivers[key]:policy.otherSetupDiscountRate;
  if(!Number.isFinite(rate)||rate<0||rate>1)throw new Error('Bonificación inválida.');
  const discountCents=promotionActive&&annual?Math.min(Math.round(setupCents*rate),Object.hasOwn(policy.setupWaivers||{},key)?setupCents:cents(policy.otherSetupDiscountCap,'tope')):0;
  const setupDueCents=setupCents-discountCents;
  const annualSubscriptionCents=annualMonthlyCents*12;
  if(!Number.isSafeInteger(annualSubscriptionCents)||!Number.isSafeInteger(annualSubscriptionCents+setupDueCents))throw new Error('Total fuera de rango.');
  const rawAnnualTotalCents=annualSubscriptionCents+setupDueCents;
  const roundingStepCents=promotionActive&&annual&&policy.annualRoundingPlans?.includes(key)?cents(policy.annualRoundingStep,'redondeo',true):0;
  const roundingDiscountCents=roundingStepCents?rawAnnualTotalCents%roundingStepCents:0;
  const annualTotalCents=rawAnnualTotalCents-roundingDiscountCents;
  const installmentCount=promotionActive&&!annual?policy.monthlySetupInstallments:1;
  if(![1,3].includes(installmentCount))throw new Error('Cuotas inválidas.');
  const part=Math.round(setupDueCents/installmentCount);
  const schedule=Array.from({length:installmentCount},(_,i)=>i===installmentCount-1?setupDueCents-part*(installmentCount-1):part);
  const firstSetupCents=schedule[0];
  return Object.freeze({billing,promotionActive,subjectToConfirmation:true,monthlyPrice:monthlyCents/100,annualMonthlyEquivalent:annualMonthlyCents/100,annualSubscription:annualSubscriptionCents/100,setupDue:setupDueCents/100,setupDiscount:discountCents/100,annualTotal:annualTotalCents/100,annualTotalBeforeRounding:rawAnnualTotalCents/100,roundingDiscount:roundingDiscountCents/100,setupInstallments:schedule.map(x=>x/100),monthlyPayments:schedule.map(x=>(x+monthlyCents)/100),totalInitial:(annual?annualTotalCents:monthlyCents+firstSetupCents)/100,setupBalanceAfterInitial:annual?0:(setupDueCents-firstSetupCents)/100,domainIncluded:promotionActive&&annual});
}
