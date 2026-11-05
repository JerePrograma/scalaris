
function showBilling(value){const mode=value==='annual'?'annual':'monthly';for(const anchor of document.querySelectorAll('[data-web-context]')){const url=new URL(anchor.getAttribute('href'),window.location.origin);url.searchParams.set('billing',mode);anchor.href=url.pathname+url.search+url.hash;}}
showBilling(new URLSearchParams(window.location.search).get('billing'));
