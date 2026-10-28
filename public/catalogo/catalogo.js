const config={"setupAnnualWaived":false,"plans":[{"id":"catalogo","annualMonthlyEquivalent":13500,"monthlyPrice":15000,"setupFee":50000},{"id":"pedidos","annualMonthlyEquivalent":22500,"monthlyPrice":25000,"setupFee":75000},{"id":"gestion","annualMonthlyEquivalent":31500,"monthlyPrice":35000,"setupFee":100000}]};
const money=value=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(value);
document.querySelector('.catalog-billing-switch')?.removeAttribute('hidden');
function showBilling(value,updateUrl=false){const mode=value==='annual'?'annual':'monthly',annual=mode==='annual';
 for(const button of document.querySelectorAll('[data-billing]'))button.setAttribute('aria-pressed',String(button.dataset.billing===mode));
 for(const plan of config.plans){const card=document.querySelector('[data-catalog-plan="'+plan.id+'"]');if(!card)continue;card.querySelector('[data-plan-price]').textContent=money(annual?plan.annualMonthlyEquivalent:plan.monthlyPrice);card.querySelector('[data-plan-caption]').textContent=annual?'Equivalente mensual · 12 meses por adelantado':'Abono mensual';card.querySelector('[data-plan-cta]').href='/consulta/?'+new URLSearchParams({service:'SOFTWARE',product:'catalogo',plan:plan.id,billing:mode});}
 const note=document.getElementById('catalog-billing-note');if(note)note.textContent=annual?'10% menos en el abono, con pago de los 12 meses por adelantado. La puesta en marcha se cobra una sola vez.':'Pagá el abono cada mes. La puesta en marcha se abona una sola vez al comenzar.';
 for(const anchor of document.querySelectorAll('[data-billing-context]')){const url=new URL(anchor.getAttribute('href'),window.location.origin);url.searchParams.set('billing',mode);anchor.href=url.pathname+url.search+url.hash;}
 if(updateUrl&&window.history?.replaceState){const url=new URL(window.location.href);url.searchParams.set('billing',mode);window.history.replaceState(null,'',url.pathname+url.search+url.hash);}
}
for(const button of document.querySelectorAll('[data-billing]'))button.addEventListener('click',()=>showBilling(button.dataset.billing,true));
showBilling(new URLSearchParams(window.location.search).get('billing'));
for(const button of document.querySelectorAll('[data-print]'))button.addEventListener('click',()=>window.print());
