// Shared commercial arithmetic. Amounts come only from the trusted published offer.
export const launchPromotion = Object.freeze({"schemaVersion":1,"id":"lanzamiento-2026-10","reviewedOn":"2026-10-28","startsOn":"2026-10-28","endsOn":"2026-11-30","timezone":"America/Buenos_Aires","maxNewCustomers":5,"sharedAcrossProducts":true,"availability":"subject_to_confirmation","annualDiscountRate":0.1,"monthlySetupInstallments":3,"domain":{"extension":".com.ar","includedMonths":12,"customerOwned":true,"subsequentRenewalPaidByCustomer":true},"contentMinutes":60,"revisionRounds":1,"catalogInitialProducts":{"catalogo":30,"pedidos":60,"gestion":100},"setupWaivers":{"web:presencia":1,"catalogo:catalogo":1,"catalogo:pedidos":0.5,"catalogo:gestion":0.5,"web:negocio":0.5},"otherSetupDiscountRate":0.5,"otherSetupDiscountCap":50000,"slotAssignment":"Presupuesto aceptado y primer pago confirmado. Cinco clientes nuevos en total; cupo sujeto a confirmación.","contentScope":"Hasta 60 minutos iniciales para redactar o mejorar textos y ordenar fotos y datos aportados por el cliente; adicionales a la configuración y capacitación del plan.","materialCondition":"Listado ordenado con precios y fotografías o enlaces utilizables; el cliente revisa y aprueba el contenido.","domainCondition":"Un dominio .com.ar disponible, registrado a nombre del cliente. Disponibilidad y vinculación a la solución se confirman antes de contratar. Primer año incluido sólo con anual anticipado; renovación posterior a cargo del cliente.","renewal":"Doce meses desde la activación acordada. Renovación a la tarifa informada con treinta días de anticipación, sin repetir la puesta en marcha del mismo alcance. El dominio se renueva a cargo del cliente.","monthlyCancellation":"Las cuotas corresponden a trabajo inicial contratado, separado del abono. Antes del primer pago se acuerdan por escrito la entrega, la baja y el tratamiento del saldo pendiente, sin recargos no informados.","exclusions":["Fotografía","Identidad de marca","Producción audiovisual","Migraciones complejas","Funciones nuevas","Gastos de terceros"],"annualRoundingStep":5000,"annualRoundingPlans":["web:presencia","catalogo:catalogo","catalogo:pedidos","catalogo:gestion","web:negocio"],"pricePresentation":"monthly_subscription_equivalent","roundingDescription":"Bonificación adicional para redondear hacia abajo el total anual de los cinco planes fijos a múltiplos de $5.000. Se muestra en el desglose previo al pago; no modifica el abono mensual de referencia ni las cuotas mensuales."});

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
  if(promotionActive&&annualMonthlyCents!==Math.round(monthlyCents/100*(1-policy.annualDiscountRate))*100)throw new Error('El descuento anual publicado no coincide con la campaña.');
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
