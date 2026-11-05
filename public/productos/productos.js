
// The monthly and annual blocks are simultaneous; URL billing only carries context.
function showBilling(value){const mode=value==='annual'?'annual':'monthly';for(const product of ['web','catalogo']){const link=document.querySelector('[data-family-link="'+product+'"]');if(link)link.href=(product==='web'?'/web/':'/catalogo/')+'?billing='+mode+'#planes';}}
showBilling(new URLSearchParams(window.location.search).get('billing'));
