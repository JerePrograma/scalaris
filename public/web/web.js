import {quoteLaunch,formatOfferMoney} from '/offer-policy.js?v=20261028-mensual';
const config={"setupAnnualWaived":false,"plans":[{"id":"presencia","annualMonthlyEquivalent":13500,"monthlyPrice":15000,"setupFee":100000},{"id":"negocio","annualMonthlyEquivalent":22500,"monthlyPrice":25000,"setupFee":200000}]};
const money=value=>formatOfferMoney(value);
document.querySelector('.web-billing')?.removeAttribute('hidden');
function showBilling(value,updateUrl=false){
 const mode=value==='monthly'?'monthly':'annual',annual=mode==='annual';
 for(const button of document.querySelectorAll('[data-web-billing]'))button.setAttribute('aria-pressed',String(button.dataset.webBilling===mode));
 let active=false;
 for(const plan of config.plans){const card=document.querySelector('[data-web-plan="'+plan.id+'"]');if(!card)continue;const quote=quoteLaunch(plan,{product:'web',billing:mode});active=quote.promotionActive;
  card.querySelector('[data-web-price]').textContent=money(annual?quote.annualMonthlyEquivalent:quote.monthlyPrice);card.querySelector('[data-web-caption]').textContent=annual?'Con pago anual anticipado de 12 meses':'Abono mensual';
  card.querySelector('[data-web-setup]').textContent=quote.setupDue===0?'Bonificada':money(quote.setupDue);
  card.querySelector('[data-web-setup-caption]').textContent=annual?(quote.setupDiscount>0?Math.round(quote.setupDiscount/plan.setupFee*100)+'% bonificada con anual':'Por única vez'):(active?'En tres cuotas sin recargo':'Por única vez al comenzar');
  card.querySelector('[data-web-schedule]').textContent=annual?(quote.domainIncluded?'Primer año de dominio .com.ar incluido a tu nombre. Disponibilidad y vinculación se confirman antes de contratar.':'Dominio propio y renovación a cargo del cliente.'):active?'El alta se divide en tres cuotas sin recargo, adicionales al abono. Dominio propio aparte.':'La puesta en marcha se abona una sola vez, por separado del abono. Dominio propio aparte.';
  card.querySelector('[data-web-cta]').href='/consulta/?'+new URLSearchParams({service:'SOFTWARE',product:'web',plan:plan.id,billing:mode});
 }
 for(const anchor of document.querySelectorAll('[data-web-context]')){const url=new URL(anchor.getAttribute('href'),window.location.origin);url.searchParams.set('billing',mode);anchor.href=url.pathname+url.search+url.hash;}
 const note=document.querySelector('[data-web-billing-note]');if(note)note.textContent=annual?(active?'Equivalente mensual con pago anual anticipado de 12 meses. Alta bonificada según el plan y primer año de dominio .com.ar incluido; cupo a confirmar.':'Equivalente mensual con pago anual anticipado de 12 meses y 10% menos en el abono. Alta y dominio aparte.'):(active?'Abono mensual y puesta en marcha en tres cuotas sin recargo. Desde el cuarto mes pagás sólo el abono.':'Abono mensual y puesta en marcha por única vez al comenzar.');
 if(updateUrl&&window.history?.replaceState){const url=new URL(window.location.href);url.searchParams.set('billing',mode);window.history.replaceState(null,'',url.pathname+url.search+url.hash);}
}
for(const button of document.querySelectorAll('[data-web-billing]'))button.addEventListener('click',()=>showBilling(button.dataset.webBilling,true));
showBilling(new URLSearchParams(window.location.search).get('billing'));
