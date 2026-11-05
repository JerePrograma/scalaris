import {formatOfferMoney as money} from '/offer-policy.js?v=20261105-personalizado';
const config={"setupAnnualWaived":false,"plans":[{"id":"catalogo","annualMonthlyEquivalent":67425,"monthlyPrice":89900,"setupFee":300000},{"id":"pedidos","annualMonthlyEquivalent":89925,"monthlyPrice":119900,"setupFee":450000},{"id":"gestion","annualMonthlyEquivalent":112425,"monthlyPrice":149900,"setupFee":650000}]};
document.querySelector('.catalog-billing-switch')?.removeAttribute('hidden');
function showBilling(value,updateUrl=false){const mode=value==='annual'?'annual':'monthly',annual=mode==='annual';
 for(const button of document.querySelectorAll('[data-billing]'))button.setAttribute('aria-pressed',String(button.dataset.billing===mode));
 for(const plan of config.plans){const card=document.querySelector('[data-catalog-plan="'+plan.id+'"]');if(!card)continue;
  card.querySelector('[data-plan-price]').textContent=money(annual?plan.annualMonthlyEquivalent:plan.monthlyPrice);card.querySelector('[data-plan-caption]').textContent=annual?'Equivalente mensual con doce meses anticipados':'Abono mensual, pagando mes a mes';
  card.querySelector('[data-plan-setup]').textContent=money(plan.setupFee);card.querySelector('[data-plan-setup-caption]').textContent='Por única vez, en ambas modalidades';
  card.querySelector('[data-plan-initial-label]').textContent=annual?'Total inicial anual':'Total inicial mensual';card.querySelector('[data-plan-initial]').textContent=money((annual?plan.annualMonthlyEquivalent*12:plan.monthlyPrice)+plan.setupFee);card.querySelector('.catalog-initial small').textContent=annual?'Doce meses anticipados + puesta en marcha':'Abono del primer mes + puesta en marcha';
  card.querySelector('[data-plan-schedule]').textContent='Dirección de Scalaris incluida. Dominio propio y renovación por separado.';
  card.querySelector('[data-plan-cta]').href='/consulta/?'+new URLSearchParams({service:'SOFTWARE',product:'catalogo',plan:plan.id,billing:mode});}
 const note=document.getElementById('catalog-billing-note');if(note)note.textContent=annual?'Equivalente mensual con doce meses anticipados y 25% de descuento sólo en el abono. Implementación completa y dominio propio por separado.':'Abono mensual y puesta en marcha por única vez. Anual opcional con 25% de descuento sólo en el abono.';
 for(const anchor of document.querySelectorAll('[data-billing-context]')){const url=new URL(anchor.getAttribute('href'),window.location.origin);url.searchParams.set('billing',mode);anchor.href=url.pathname+url.search+url.hash;}
 if(updateUrl&&window.history?.replaceState){const url=new URL(window.location.href);url.searchParams.set('billing',mode);window.history.replaceState(null,'',url.pathname+url.search+url.hash);}
}
for(const button of document.querySelectorAll('[data-billing]'))button.addEventListener('click',()=>showBilling(button.dataset.billing,true));
document.querySelector('[data-print]')?.addEventListener('click',()=>window.print());
showBilling(new URLSearchParams(window.location.search).get('billing'));
