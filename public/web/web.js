const config={"setupAnnualWaived":false,"plans":[{"id":"presencia","annualMonthlyEquivalent":13500,"monthlyPrice":15000,"setupFee":100000},{"id":"negocio","annualMonthlyEquivalent":22500,"monthlyPrice":25000,"setupFee":200000}]};
const money=value=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(value);
document.querySelector('.web-billing')?.removeAttribute('hidden');
function showBilling(value,updateUrl=false){
 const mode=value==='annual'?'annual':'monthly',annual=mode==='annual';
 for(const button of document.querySelectorAll('[data-web-billing]'))button.setAttribute('aria-pressed',String(button.dataset.webBilling===mode));
 for(const plan of config.plans){const card=document.querySelector('[data-web-plan="'+plan.id+'"]');if(!card)continue;const amount=annual?plan.annualMonthlyEquivalent:plan.monthlyPrice;
  card.querySelector('[data-web-price]').textContent=money(amount);card.querySelector('[data-web-caption]').textContent=annual?'Equivalente mensual · 12 meses por adelantado':'Abono mensual';
  card.querySelector('[data-web-cta]').href='/consulta/?'+new URLSearchParams({service:'SOFTWARE',product:'web',plan:plan.id,billing:mode});
 }
 const note=document.querySelector('[data-web-billing-note]');if(note)note.textContent=annual?'10% menos en el abono, con pago de los 12 meses por adelantado. La puesta en marcha se cobra una sola vez.':'Pagá el abono cada mes. La puesta en marcha se abona una sola vez al comenzar.';
 if(updateUrl&&window.history?.replaceState){const url=new URL(window.location.href);url.searchParams.set('billing',mode);window.history.replaceState(null,'',url.pathname+url.search+url.hash);}
}
for(const button of document.querySelectorAll('[data-web-billing]'))button.addEventListener('click',()=>showBilling(button.dataset.webBilling,true));
showBilling(new URLSearchParams(window.location.search).get('billing'));
