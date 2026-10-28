import {quoteLaunch,formatOfferMoney} from '/offer-policy.js?v=20261028-mensual';
const config={"setupAnnualWaived":false,"plans":[{"id":"catalogo","annualMonthlyEquivalent":13500,"monthlyPrice":15000,"setupFee":50000},{"id":"pedidos","annualMonthlyEquivalent":22500,"monthlyPrice":25000,"setupFee":75000},{"id":"gestion","annualMonthlyEquivalent":31500,"monthlyPrice":35000,"setupFee":100000}]};
const money=value=>formatOfferMoney(value);
document.querySelector('.catalog-billing-switch')?.removeAttribute('hidden');
function showBilling(value,updateUrl=false){const mode=value==='monthly'?'monthly':'annual',annual=mode==='annual';
 for(const button of document.querySelectorAll('[data-billing]'))button.setAttribute('aria-pressed',String(button.dataset.billing===mode));
 let active=false;
 for(const plan of config.plans){const card=document.querySelector('[data-catalog-plan="'+plan.id+'"]');if(!card)continue;const quote=quoteLaunch(plan,{product:'catalogo',billing:mode});active=quote.promotionActive;
  card.querySelector('[data-plan-price]').textContent=money(annual?quote.annualMonthlyEquivalent:quote.monthlyPrice);card.querySelector('[data-plan-caption]').textContent=annual?'Con pago anual anticipado de 12 meses':'Abono mensual';
  card.querySelector('[data-plan-setup]').textContent=quote.setupDue===0?'Bonificada':money(quote.setupDue);
  card.querySelector('[data-plan-setup-caption]').textContent=annual?(quote.setupDiscount>0?Math.round(quote.setupDiscount/plan.setupFee*100)+'% bonificada con anual':'Por única vez'):(active?'En tres cuotas sin recargo':'Por única vez al comenzar');
  card.querySelector('[data-plan-schedule]').textContent=annual?(quote.domainIncluded?'Primer año de .com.ar a tu nombre incluido. Disponibilidad y vinculación se confirman antes de contratar.':'Dominio propio y renovación a cargo del cliente.'):active?'El alta se divide en tres cuotas sin recargo, adicionales al abono. Dominio propio aparte.':'La puesta en marcha se abona una sola vez, por separado del abono. Dominio propio aparte.';
  card.querySelector('[data-plan-cta]').href='/consulta/?'+new URLSearchParams({service:'SOFTWARE',product:'catalogo',plan:plan.id,billing:mode});}
 const note=document.getElementById('catalog-billing-note');if(note)note.textContent=annual?(active?'Equivalente mensual con pago anual anticipado de 12 meses. Alta bonificada según el plan y primer año de dominio .com.ar incluido; cupo a confirmar.':'Equivalente mensual con pago anual anticipado de 12 meses y 10% menos en el abono. Alta y dominio aparte.'):(active?'Abono mensual y puesta en marcha en tres cuotas sin recargo. Desde el cuarto mes pagás sólo el abono.':'Abono mensual y puesta en marcha por única vez al comenzar.');
 for(const anchor of document.querySelectorAll('[data-billing-context]')){const url=new URL(anchor.getAttribute('href'),window.location.origin);url.searchParams.set('billing',mode);anchor.href=url.pathname+url.search+url.hash;}
 if(updateUrl&&window.history?.replaceState){const url=new URL(window.location.href);url.searchParams.set('billing',mode);window.history.replaceState(null,'',url.pathname+url.search+url.hash);}
}
for(const button of document.querySelectorAll('[data-billing]'))button.addEventListener('click',()=>showBilling(button.dataset.billing,true));
showBilling(new URLSearchParams(window.location.search).get('billing'));
for(const button of document.querySelectorAll('[data-print]'))button.addEventListener('click',()=>window.print());
