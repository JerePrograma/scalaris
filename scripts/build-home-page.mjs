import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {head,header,footer,escape as esc,money,inquiry,version} from './site-shell.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const portfolio=JSON.parse(await readFile(path.join(root,'public/productos/offer.json'),'utf8'));
let catalog;
try{catalog=JSON.parse(await readFile(path.resolve(root,'../scalaris-comercio/commercial/offer.json'),'utf8'));}
catch(error){if(error.code!=='ENOENT')throw error;catalog=JSON.parse(await readFile(path.join(root,'public/catalogo/offer.json'),'utf8'));}
const webBase=portfolio.webOffer.plans[0],catalogBase=catalog.plans[0];
const productPrices={web:{monthly:webBase.monthlyPrice,annual:webBase.annualMonthlyEquivalent,setup:webBase.setupFee},catalogo:{monthly:catalogBase.monthlyPrice,annual:catalogBase.annualMonthlyEquivalent,setup:catalogBase.setupFee}};
const monthlyFrom=Math.min(webBase.monthlyPrice,catalogBase.monthlyPrice);
const arrows='<span aria-hidden="true">↗</span>';
const icons={
  web:'<rect x="3" y="4" width="26" height="23" rx="3"/><path d="M3 11h26M8 7.5h1m3 0h1M9 17h14M9 22h9"/>',
  catalogo:'<path d="M4 12h24l-3-8H7zM7 14v14h18V14M13 28V18h6v10"/><path d="M12 4l-1 8m5-8v8m4-8 1 8"/>',
  menu:'<rect x="7" y="3" width="18" height="26" rx="3"/><path d="M12 9h8M12 14h8M12 19h4M13 25h6"/>',
  mesa:'<rect x="9" y="9" width="14" height="14" rx="4"/><path d="M12 4h8M12 28h8M4 12v8M28 12v8"/>',
  academia:'<path d="m3 12 13-7 13 7-13 7zM8 16v8q8 6 16 0v-8M29 13v10"/>',
  crm:'<circle cx="16" cy="9" r="5"/><path d="M7 28v-4a9 9 0 0 1 18 0v4M3 15v7M29 15v7"/>',
};
const icon=id=>`<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[id]}</svg>`;
const needs={
  web:{title:'Presentá tu negocio.',copy:'Una web para explicar lo que hacés y recibir consultas.',link:'Ver planes de Web'},
  catalogo:{title:'Mostrá lo que vendés.',copy:'Productos y precios editables, con pedidos por WhatsApp.',link:'Ver planes de Catálogo'},
  menu:{title:'Recibí pedidos con opciones.',copy:'Un menú para elegir tamaños, ingredientes y adicionales.',link:'Conocer Menú'},
  mesa:{title:'Organizá la atención del local.',copy:'Mesas, comandas y cuentas para el trabajo del salón.',link:'Conocer Mesa'},
  academia:{title:'Ordená alumnos y cuotas.',copy:'Gestión de inscripciones, asistencias y mensualidades.',link:'Conocer Gestudio'},
  crm:{title:'Seguí cada oportunidad.',copy:'Contactos, tareas y seguimiento para tu operación comercial.',link:'Conocer CRM'},
};
function priceFor(family){
  const fixed=productPrices[family.id];
  if(fixed)return `<strong>Desde ${esc(money(fixed.monthly))}<small>/mes</small></strong><span class="home-billing-label">Sin descuento, pagando mes a mes.</span><span class="home-product-offer">Puesta en marcha desde ${esc(money(fixed.setup))}, por única vez. Total inicial primer mes desde ${esc(money(fixed.monthly+fixed.setup))}.</span><span class="home-annual-card"><b>Anual · puesta en marcha 100% bonificada</b><br>${esc(money(fixed.annual))}/mes equivalente. Total a pagar por 12 meses: ${esc(money(fixed.annual*12))}, anticipado. Alta: $ 0.<br>Ahorro en el abono anual: ${esc(money((fixed.monthly-fixed.annual)*12))}; alta bonificada: ${esc(money(fixed.setup))}. Ahorro total del primer año: ${esc(money((fixed.monthly-fixed.annual)*12+fixed.setup))}.<br><a href="${esc(family.detailsUrl+'?billing=annual#planes')}">Ver anual con alta bonificada →</a></span>`;
  if(family.pricingType==='starting_quote')return `<strong>Desde ${esc(money(family.monthlyFrom))}<small>/mes</small></strong><span class="home-billing-label">${esc(family.unitLabel||'Según alcance acordado')}.</span><span>Implementación por separado.</span><span>${esc(family.statusLabel)}</span>`;
  return '<strong>A cotizar</strong><span>Según relevamiento y alcance.</span>';
}
const productCards=portfolio.families.map(family=>{
  const n=needs[family.id];
  const link=['web','catalogo'].includes(family.id)?`${family.detailsUrl}?billing=monthly#planes`:inquiry(family.id);
  return `<article class="home-product"><div class="home-product-icon">${icon(family.id)}</div><p class="home-product-name">${esc(family.name)}</p><h3>${esc(n.title)}</h3><p class="home-product-description">${esc(n.copy)}</p><div class="home-product-price">${priceFor(family)}</div><a class="text-link" href="${esc(link)}">${esc(n.link)} ${arrows}</a></article>`;
}).join('');
const steps=[
  ['Configuramos','Tu marca, accesos y reglas de uso, dentro del alcance elegido.'],
  ['Preparamos el contenido','Ordenamos tus textos, fotos y datos dentro del alcance inicial acordado. En Catálogo, la carga inicial depende del plan.'],
  ['Probamos el recorrido','Revisamos las acciones principales antes de la puesta en marcha.'],
  ['Te enseñamos a usarlo','Capacitación inicial y un canal de soporte con condiciones claras.'],
];
const delivery=steps.map(([title,copy],i)=>`<article><span class="delivery-number">0${i+1}</span><h3>${esc(title)}</h3><p>${esc(copy)}</p></article>`).join('');
const services=[
  {number:'01',title:'Software a medida',copy:'Cuando tu operación necesita un flujo propio, diseñamos una solución con vos.',list:['Procesos y permisos definidos','Desarrollo por entregables','Pruebas y puesta en marcha'],cta:'Contanos tu proyecto'},
  {number:'02',title:'Automatizaciones',copy:'Revisamos las tareas repetitivas para reducir pasos manuales y ordenar la información.',list:['Relevamiento del proceso','Reglas y excepciones acordadas','Controles antes de automatizar'],cta:'Revisemos tu proceso'},
  {number:'03',title:'Integraciones',copy:'Conectamos las herramientas que usás cuando sus interfaces y permisos lo permiten.',list:['Intercambio de datos con alcance','Validación de cada conexión','Seguimiento de errores y operación'],cta:'Contanos qué usás'},
];
const servicesHTML=services.map(s=>`<article class="home-service"><div class="home-service-number">${s.number}<span aria-hidden="true">↗</span></div><h3>${esc(s.title)}</h3><p>${esc(s.copy)}</p><ul class="check-list">${s.list.map(item=>`<li>${esc(item)}</li>`).join('')}</ul><a class="text-link" href="${esc(inquiry())}">${esc(s.cta)} ${arrows}</a></article>`).join('');
const demoCards=[
  {title:'Catálogo para tu comercio',type:'Demos interactivas',copy:'Explorá productos, pedidos y caja manual según el plan.',image:'/assets/proyectos/almacen-demo.jpg',alt:'Catálogo de demostración con productos y categorías de un almacén ficticio',width:1265,height:712,url:'/catalogo/demos/'},
  {title:'Scalaris Mesa',type:'Demo interactiva',copy:'Recorré el salón, las comandas y el detalle de una cuenta.',image:'/assets/proyectos/scalaris-mesa.png',alt:'Demostración de Scalaris Mesa con plano del salón y cuenta ficticia',width:1440,height:900,url:'/mesa/'},
  {title:'Gestudio',type:'Demo de consulta',copy:'Conocé la gestión de alumnos y cuotas de una academia ficticia.',image:'/assets/proyectos/gestudio.webp',alt:'Pantalla de alumnos de la demo de consulta de Gestudio',width:1200,height:537,url:'/gestudio/'},
].map(d=>`<article class="home-demo"><a class="home-demo-image" href="${d.url}" aria-label="${esc('Ver '+d.type.toLowerCase()+' de '+d.title)}"><img src="${d.image}" alt="${esc(d.alt)}" width="${d.width}" height="${d.height}" loading="lazy"></a><div class="home-demo-copy"><span>${esc(d.type)}</span><h3>${esc(d.title)}</h3><p>${esc(d.copy)}</p><a class="text-link" href="${d.url}">Ver demo ${arrows}</a></div></article>`).join('');
const faq=[
  ['¿El software se hace desde cero para cada negocio?','Diseñamos la propuesta visual para tu marca y desarrollamos sobre componentes propios de Scalaris. Web y Catálogo incluyen dos rondas de ajustes dentro del plan. Las funciones o flujos específicos se relevan y cotizan por separado; la entrega de código o exclusividad se acuerdan en el presupuesto correspondiente.'],
  ['¿Cómo se paga el precio mensual que veo?','La modalidad inicial es mes a mes: abono mensual más puesta en marcha por única vez. Web y Catálogo también tienen anual opcional con doce meses por adelantado y puesta en marcha 100% bonificada. Web conserva 25% de ahorro en el abono; Catálogo tiene importes anuales propios por plan. Gestudio y los otros sistemas tienen condiciones específicas en su propuesta. Antes de confirmar revisás el desglose completo.'],
  ['¿Puedo conocer el producto antes de decidir?','Sí. Podés recorrer las demos disponibles con datos ficticios. Algunas permiten interacción y otras son de consulta; cada una lo indica. En los productos que lo requieren, acordamos un piloto y su aceptación antes del uso operativo.'],
  ['¿Qué incluye la continuidad?','El abono cubre alojamiento, HTTPS, mantenimiento técnico y soporte según el producto. El alcance de los cambios de contenido depende del plan. El dominio propio y su renovación quedan a cargo del cliente. Nuevas funciones, migraciones complejas e integraciones se cotizan aparte. La renovación y las condiciones de baja se acuerdan antes de contratar.'],
].map(([question,answer])=>`<details><summary>${esc(question)}</summary><p>${esc(answer)}</p></details>`).join('');
const whatsapp='https://wa.me/5491172789289?text='+encodeURIComponent('Hola Scalaris, quiero conversar sobre software para mi negocio.');
const html=`<!doctype html>
<html lang="es-AR">
${head({title:'Scalaris | Tu negocio online, con ayuda para empezar',description:'Web, catálogos y sistemas para tu negocio. Diseño personalizado y componentes propios. Web y Catálogo con planes claros y puesta en marcha 100% bonificada con pago anual anticipado.',path:'/',css:['/home.css?v='+version]})}
<body>
${header()}
<main id="contenido">
  <section class="home-hero wrap" aria-labelledby="hero-title">
    <div class="home-hero-copy">
      <span class="eyebrow">SOFTWARE PARA COMERCIOS Y PYMES</span>
      <h1 id="hero-title">Software para tu negocio.<br>Diseño propio para tu marca<span>.</span></h1>
      <p class="home-hero-lead">Diseñamos tu web y tu catálogo sobre componentes propios de Scalaris. Acordamos la propuesta visual y el alcance con vos. Cuando tu operación necesita funciones específicas, las desarrollamos con presupuesto propio.</p>
      <div class="home-hero-offer"><span>Web y Catálogo desde</span><strong>${esc(money(monthlyFrom))}<small>/mes</small></strong><p>Abono mensual, pagando mes a mes.</p><div class="home-offer-points"><span>Implementación con el mensual; bonificada con anual</span><span>Alojamiento y HTTPS incluidos</span></div></div>
      <div class="actions home-hero-actions"><a class="button" href="/productos/?billing=monthly#planes">Elegí tu plan <span aria-hidden="true">→</span></a><a class="button secondary" href="${esc(inquiry())}">Contanos tu proyecto ${arrows}</a></div>
      <p class="home-hero-alternative">También podés pagar doce meses por adelantado: puesta en marcha 100% bonificada en Web y Catálogo, más ahorro en el abono según el plan. <a href="/productos/?billing=annual#planes">Ver modalidad anual →</a></p>
    </div>
    <div class="home-product-preview" aria-label="Vistas de productos de Scalaris">
      <div class="preview-browser preview-browser-main"><div class="preview-browser-bar"><i></i><i></i><i></i><span>Scalaris Catálogo</span></div><img src="/assets/proyectos/almacen-demo.jpg" alt="Vista real de la demo de Catálogo: productos, categorías y carrito de un negocio ficticio" width="1265" height="712" fetchpriority="high"><div class="preview-browser-label"><strong>Productos y pedidos.</strong><span>Para tu comercio.</span></div></div>
      <div class="preview-pair"><div class="preview-browser"><div class="preview-browser-bar"><span>Scalaris Mesa</span></div><img src="/assets/proyectos/scalaris-mesa.png" alt="Plano del salón y cuenta en la demo de Mesa" width="1440" height="900" loading="lazy"></div><div class="preview-browser"><div class="preview-browser-bar"><span>Gestudio</span></div><img src="/assets/proyectos/gestudio.webp" alt="Listado de alumnos en la demo de consulta de Gestudio" width="1200" height="537" loading="lazy"></div></div>
      <p class="proof-note">Capturas de nuestros productos. Negocios y datos de demostración.</p>
    </div>
  </section>

  <section class="home-launch" id="modalidades" aria-labelledby="launch-title"><div class="wrap"><div class="home-launch-top"><div><span class="eyebrow">VALOR Y ALCANCE</span><h2 id="launch-title">Cada solución tiene<br>un trabajo concreto detrás.</h2><p>Elegí por el problema que necesitás resolver. Te mostramos qué incluye el producto, cómo lo preparamos y qué continuidad vas a recibir.</p></div><div class="home-launch-price"><span>WEB Y CATÁLOGO · ANUAL OPCIONAL</span><strong>Alta 100% bonificada<small>Con pago anual anticipado</small></strong><p>Doce meses por adelantado, con ahorro en el abono según el plan. La puesta en marcha cuesta $ 0 y el precio del servicio queda fijo durante ese período.</p><a class="button light" href="/productos/?billing=annual#planes">Comparar modalidades ${arrows}</a></div></div><div class="home-launch-benefits"><article><span>01</span><h3>Diseño para tu marca</h3><p>Una propuesta visual personalizada sobre componentes propios, con dos rondas de ajustes en Web y Catálogo.</p></article><article><span>02</span><h3>Puesta en marcha acompañada</h3><p>Configuración, datos y contenido acordados, revisión y capacitación según el producto.</p></article><article><span>03</span><h3>Continuidad y soporte</h3><p>Alojamiento, conexión segura, mantenimiento y atención dentro del alcance contratado.</p></article></div><div class="home-launch-terms"><p>El presupuesto detalla implementación, abono y adicionales. El dominio propio y su renovación quedan a tu nombre y cargo. Los productos que requieren piloto conservan su aceptación antes del uso operativo.</p><a href="/promociones/">Ver modalidades y condiciones ${arrows}</a></div></div></section>

  <div class="home-routes wrap" aria-label="Elegí cómo empezar"><a href="/productos/"><span>01</span><div><strong>Elegí un producto.</strong><p>Alcances definidos, precios publicados y puesta en marcha asistida.</p></div>${arrows}</a><a href="#servicios"><span>02</span><div><strong>Construyamos tu solución.</strong><p>Software a medida, automatizaciones e integraciones según tu operación.</p></div>${arrows}</a></div>

  <section class="section wrap home-solutions" id="soluciones" aria-labelledby="solutions-title"><div class="section-head"><div><span class="eyebrow">PRODUCTOS SCALARIS</span><h2 id="solutions-title">Empezá por lo que<br>necesitás resolver.</h2></div><p>Presentar tu negocio, recibir pedidos u ordenar la gestión. Elegí una solución y revisá su alcance.</p></div><div class="home-products-grid">${productCards}</div><div class="home-products-terms"><p>Web y Catálogo: precios finales en ARS, abono mensual e implementación por separado. Anual opcional: doce meses por adelantado, ahorro en el abono según el plan y puesta en marcha 100% bonificada. Menú, Mesa, Gestudio y CRM requieren una propuesta con alcance e implementación acordados. <a href="/promociones/">Condiciones y renovación</a>.</p><a class="text-link" href="/productos/#planes">Comparar todos los planes ${arrows}</a></div></section>

  <section class="home-delivery" aria-labelledby="delivery-title"><div class="wrap"><div class="section-head"><div><span class="eyebrow">DE LA HERRAMIENTA AL USO DIARIO</span><h2 id="delivery-title">La puesta en marcha<br>también es parte del trabajo.</h2></div><p>La entrega se acuerda por producto: qué configuramos, qué material necesitás preparar y cómo revisamos que te sirva.</p></div><div class="home-delivery-grid">${delivery}</div><p class="proof-note">Contenido inicial, revisión y carga dentro del alcance de la implementación. El cliente aporta y aprueba el material. Fotografía, identidad de marca, migraciones complejas y nuevas funciones se cotizan aparte.</p></div></section>

  <section class="section wrap" id="servicios" aria-labelledby="services-title"><div class="section-head"><div><span class="eyebrow">DESARROLLO</span><h2 id="services-title">Tu operación tiene<br>su propia forma de trabajar.</h2></div><p>Si el alcance de un producto no cubre lo que necesitás, definimos una solución y un presupuesto antes de empezar.</p></div><div class="home-services-grid">${servicesHTML}</div></section>

  <section class="section home-demos" id="demos" aria-labelledby="demos-title"><div class="wrap"><div class="section-head"><div><span class="eyebrow">MIRALO EN FUNCIONAMIENTO</span><h2 id="demos-title">Conocé el software<br>antes de conversar.</h2></div><a class="text-link" href="/proyectos/">Ver proyectos y demos ${arrows}</a></div><div class="home-demos-grid">${demoCards}</div><p class="proof-note">Entornos de demostración con datos ficticios. La disponibilidad de una demo no reemplaza el relevamiento ni la aceptación de una implementación real.</p></div></section>

  <section class="section wrap home-process" aria-labelledby="process-title"><div><span class="eyebrow">CÓMO EMPEZAMOS</span><h2 id="process-title">Una buena consulta.<br>Un alcance claro.</h2><p>Primero entendemos tu necesidad. Después acordamos qué vamos a entregar y cómo ponerlo en uso.</p><a class="text-link" href="${esc(inquiry())}">Preparar mi consulta ${arrows}</a></div><ol><li><span>01</span><div><h3>Nos contás qué necesitás.</h3><p>Qué hace tu negocio, cómo trabajás hoy y qué querés resolver.</p></div></li><li><span>02</span><div><h3>Revisamos producto y alcance.</h3><p>Confirmamos funciones, material, precio, puesta en marcha y condiciones.</p></div></li><li><span>03</span><div><h3>Configuramos y acompañamos.</h3><p>Preparamos la entrega, revisamos el recorrido y acordamos la aceptación.</p></div></li></ol></section>

  <section class="section home-faq" aria-labelledby="faq-title"><div class="wrap home-faq-grid"><div><span class="eyebrow">ANTES DE ELEGIR</span><h2 id="faq-title">Preguntas habituales.</h2><p>Más claridad para decidir qué necesitás y cómo empezar.</p></div><div>${faq}</div></div></section>

  <section class="home-contact wrap" id="contacto" aria-labelledby="contact-title"><div><span class="eyebrow">HABLEMOS DE TU NEGOCIO</span><h2 id="contact-title">Contanos qué<br>necesitás resolver.</h2><p>Podés preparar una consulta con el contexto de tu proyecto o escribirnos por WhatsApp.</p></div><div class="home-contact-actions"><a class="button light" href="${esc(inquiry())}">Preparar consulta <span aria-hidden="true">→</span></a><a class="text-link" href="${esc(whatsapp)}" target="_blank" rel="noopener noreferrer">Escribir por WhatsApp ${arrows}</a><span>11 7278-9289 · Argentina</span></div></section>
</main>
${footer()}
</body></html>
`;
await writeFile(path.join(root,'public/index.html'),html);
console.log(JSON.stringify({status:'generated',file:'public/index.html',families:portfolio.families.length,webMonthly:webBase.monthlyPrice,catalogMonthly:catalogBase.monthlyPrice,billingDefault:'monthly'}));
