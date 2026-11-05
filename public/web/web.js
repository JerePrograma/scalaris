import {formatOfferMoney as money} from '/offer-policy.js?v=20261105-personalizado';
const config={"setupAnnualWaived":false,"plans":[{"id":"presencia","annualMonthlyEquivalent":52425,"monthlyPrice":69900,"setupFee":350000},{"id":"negocio","annualMonthlyEquivalent":74925,"monthlyPrice":99900,"setupFee":650000}]};
document.querySelector('.web-billing')?.removeAttribute('hidden');
function showBilling(value,updateUrl=false){
 const mode=value==='annual'?'annual':'monthly',annual=mode==='annual';
 for(const button of document.querySelectorAll('[data-web-billing]'))button.setAttribute('aria-pressed',String(button.dataset.webBilling===mode));
 for(const plan of config.plans){const card=document.querySelector('[data-web-plan="'+plan.id+'"]');if(!card)continue;
  card.querySelector('[data-web-price]').textContent=money(annual?plan.annualMonthlyEquivalent:plan.monthlyPrice);card.querySelector('[data-web-caption]').textContent=annual?'Equivalente mensual con doce meses anticipados':'Abono mensual, pagando mes a mes';
  card.querySelector('[data-web-setup]').textContent=money(plan.setupFee);card.querySelector('[data-web-setup-caption]').textContent='Por única vez, en ambas modalidades';
  card.querySelector('[data-web-initial-label]').textContent=annual?'Total inicial anual':'Total inicial mensual';card.querySelector('[data-web-initial]').textContent=money((annual?plan.annualMonthlyEquivalent*12:plan.monthlyPrice)+plan.setupFee);card.querySelector('.web-initial small').textContent=annual?'Doce meses anticipados + puesta en marcha':'Abono del primer mes + puesta en marcha';
  card.querySelector('[data-web-schedule]').textContent='Dominio propio y renovación a nombre y cargo del cliente.';
  card.querySelector('[data-web-cta]').href='/consulta/?'+new URLSearchParams({service:'SOFTWARE',product:'web',plan:plan.id,billing:mode});
 }
 for(const anchor of document.querySelectorAll('[data-web-context]')){const url=new URL(anchor.getAttribute('href'),window.location.origin);url.searchParams.set('billing',mode);anchor.href=url.pathname+url.search+url.hash;}
 const note=document.querySelector('[data-web-billing-note]');if(note)note.textContent=annual?'Equivalente mensual con doce meses anticipados y 25% de descuento sólo en el abono. Implementación y dominio propio por separado.':'Abono mensual y puesta en marcha por única vez al comenzar. El anual es opcional y descuenta 25% sólo del abono.';
 if(updateUrl&&window.history?.replaceState){const url=new URL(window.location.href);url.searchParams.set('billing',mode);window.history.replaceState(null,'',url.pathname+url.search+url.hash);}
}
for(const button of document.querySelectorAll('[data-web-billing]'))button.addEventListener('click',()=>showBilling(button.dataset.webBilling,true));
showBilling(new URLSearchParams(window.location.search).get('billing'));
