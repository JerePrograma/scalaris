import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { resolvePublicReference,validatePublicOffer } from "./public-references.mjs";
import {getLaunchQuote} from "./launch-promotion.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../public");
const html = readFileSync(resolve(root, "index.html"), "utf8");
const css = readFileSync(resolve(root, "styles.css"), "utf8");
const errors = [];
const routes = JSON.parse(readFileSync(resolve(root,"_routes.json"),"utf8"));
const dynamicPrefixes = routes.include.filter(route=>/^\/[a-z0-9-]+$/.test(route)).filter(route=>{
  const handler=resolve(root,"../functions",route.slice(1),"[[path]].js");
  if(!existsSync(handler)){errors.push(`Ruta dinámica sin función: ${route}`);return false;}
  return true;
});
// Existing Burger House routing is managed outside Pages. Its public URL is
// declared by that project's frontend.config.json; do not create a competing function.
const externallyManagedPrefixes=["/burger-house-3"];
function verifyReference(source,ref){
  try{return resolvePublicReference(root,source,ref,{dynamicPrefixes,externallyManagedPrefixes});}
  catch(error){errors.push(`${error.message} (desde ${relativeToPublic(source)})`);return null;}
}
const relativeToPublic=file=>file.slice(root.length+1);
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
const refs = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
refs.push(
  ...[...css.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)].map((m) => m[1]),
);
let localFiles = 0;
for (const ref of refs) {
  if(verifyReference(resolve(root,"index.html"),ref)?.kind==='static')localFiles++;
}
if (!html.includes('href="tel:+5491172789289"'))
  errors.push("Teléfono incorrecto");
const links = refs.filter((ref) => ref.startsWith("https://wa.me/"));
if (
  links.length !== 1 ||
  links.some((ref) => !ref.startsWith("https://wa.me/5491172789289?text="))
)
  errors.push("Enlace WhatsApp directo incorrecto");
for (const ref of [
  "/consulta/",
  "/consulta/?service=SOFTWARE",
])
  if (!refs.includes(ref)) errors.push(`Acceso a consulta inexistente: ${ref}`);
if ([...html.matchAll(/<details>/g)].length !== 4)
  errors.push("Se esperaban cuatro FAQ");
for (const file of [
  "inter-400.ttf",
  "inter-500.ttf",
  "inter-600.ttf",
  "inter-700.ttf",
  "OFL-Inter.txt",
]) {
  if (!existsSync(resolve(root, "assets", file)))
    errors.push(`Fuente/licencia inexistente: ${file}`);
}
const formRoot = resolve(root, "consulta");
const formHtml = readFileSync(resolve(formRoot, "index.html"), "utf8");
const formCss = readFileSync(resolve(formRoot, "form.css"), "utf8");
const formRefs = [
  ...[...formHtml.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((m) => m[1]),
  ...[...formCss.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)].map((m) => m[1]),
];
for (const ref of formRefs) {
  verifyReference(resolve(formRoot,"index.html"),ref);
}
for (const file of ["form.js", "model.js"])
  execFileSync(process.execPath, ["--check", resolve(formRoot, file)], {
    stdio: "pipe",
  });
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
// Validate all software pages and assets, including the complete gallery.
function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = resolve(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}
const publicFiles = walk(root);
for (const removed of ["tienda", "assets/notebook.png"]) {
  if (existsSync(resolve(root, removed))) errors.push(`Contenido de hardware retirado dentro del sitio público: ${removed}`);
}
for (const file of publicFiles.filter(file => /\.(?:html|js|json|xml|txt|css)$/.test(file))) {
  const content = readFileSync(file, "utf8");
  if (/\b(?:EQUIPMENT|PARTS)\b/.test(content)) errors.push(`Servicio de hardware retirado dentro de ${relativeToPublic(file)}`);
  if (/Soporte y servicios|Software y soporte informático\.|Equipos y repuestos/.test(content)) errors.push(`Oferta de hardware retirada dentro de ${relativeToPublic(file)}`);
  if (file.endsWith("sitemap.xml") && /https:\/\/scalaris\.com\.ar\/tienda(?:\/|<)/.test(content)) errors.push("La tienda retirada no debe aparecer en el sitemap");
}
for (const file of publicFiles.filter(file => /\.(html|css)$/.test(file))) {
  const text = readFileSync(file, "utf8");
  const pageIds = new Set([...text.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  const pageRefs = [
    ...[...text.matchAll(/\b(?:href|src)="([^"]+)"/g)].map(match => match[1]),
    ...[...text.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)].map(match => match[1]),
  ];
  for (const ref of pageRefs) {
    const destination = new URL(ref, `https://scalaris.com.ar/${relativeToPublic(file).replaceAll("\\", "/")}`);
    if (destination.origin === "https://scalaris.com.ar" && /^\/tienda(?:\/|$)/.test(destination.pathname)) errors.push(`Enlace a la tienda retirada en ${relativeToPublic(file)}: ${ref}`);
    verifyReference(file,ref);
  }
}
for (const file of publicFiles.filter(file => file.endsWith(".js"))) execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
for (const file of ["proyectos/index.html"]) {
  if (!existsSync(resolve(root, file))) errors.push(`Página inexistente: ${file}`);
}
const requiredCanonical = new Map([
  ["index.html","/"],["consulta/index.html","/consulta/"],["proyectos/index.html","/proyectos/"],["promociones/index.html","/promociones/"],["flyers/index.html","/flyers/"],
  ["productos/index.html","/productos/"],["web/index.html","/web/"],["catalogo/index.html","/catalogo/"],["catalogo/demos/index.html","/catalogo/demos/"],["catalogo/propuesta.html","/catalogo/propuesta"],
]);
for(const [filename,route] of requiredCanonical){
  const file=resolve(root,filename);
  if(!existsSync(file)){errors.push(`Página de producto inexistente: ${filename}`);continue;}
  const page=readFileSync(file,"utf8"),expected=`https://scalaris.com.ar${route}`;
  const canonicals=[...page.matchAll(/<link\b[^>]*\brel="canonical"[^>]*\bhref="([^"]+)"/g)];
  if(canonicals.length!==1||canonicals[0][1]!==expected)errors.push(`Canonical incorrecto en ${filename}`);
  if(!page.includes(`property="og:url" content="${expected}"`))errors.push(`OpenGraph URL incorrecta en ${filename}`);
}
// Marketing compares recurring charges. Exact payable totals belong to the review.
const marketingFiles=[...requiredCanonical.keys()].filter(f=>f!=='consulta/index.html').concat(['flyers/manifest.json','catalogo/cartel-precios.svg','productos/productos.js','web/web.js','catalogo/catalogo.js']);
for(const filename of marketingFiles){
  const text=readFileSync(resolve(root,filename),'utf8');
  if(/\$\s?(?:160\.000|162\.000|305\.000|307\.500|425\.000|428\.000|370\.000)\b/.test(text)||/data-plan-total|data-total-heading|Total anticipado|Desembolso completo/i.test(text))errors.push(`Total anual destacado en marketing: ${filename}`);
}
const sitemap=readFileSync(resolve(root,"sitemap.xml"),"utf8");
for(const route of ["/","/consulta/","/proyectos/","/productos/","/web/","/catalogo/","/catalogo/demos/","/promociones/","/flyers/"]){
  if(!sitemap.includes(`<loc>https://scalaris.com.ar${route}</loc>`))errors.push(`Ruta ausente del sitemap: ${route}`);
}
const publicOfferPath=resolve(root,"catalogo/offer.json");
if(existsSync(publicOfferPath)){
  const offer=JSON.parse(readFileSync(publicOfferPath,"utf8"));
  errors.push(...validatePublicOffer(offer));
  const productPage=readFileSync(resolve(root,"catalogo/index.html"),"utf8");
  const money=value=>new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(value).replace(/\s/g," ");
  for(const plan of offer.plans||[]){
    const card=productPage.match(new RegExp(`<article\\b[^>]*data-catalog-plan="${plan.id}"[^>]*>[\\s\\S]*?<\\/article>`))?.[0]||"";
    const q=getLaunchQuote(plan,{product:'catalogo',billing:'annual'});
    if(!card.includes(money(plan.annualMonthlyEquivalent))||!card.includes(q.setupDue===0?'Bonificada':money(q.setupDue)))errors.push(`Precio mensual equivalente o puesta en marcha inconsistente en el plan ${plan.id}`);
    if(!/pago anual anticipado de 12 meses/i.test(card))errors.push(`Falta aclaración junto al precio anual equivalente: ${plan.id}`);
    if(!card.includes(`plan=${plan.id}`)||!card.includes("billing=annual"))errors.push(`Consulta sin contexto anual del plan ${plan.id}`);
  }
  if(!productPage.includes('/promociones/'))errors.push('Catálogo debe enlazar las condiciones de lanzamiento.');
  const js=readFileSync(resolve(root,"catalogo/catalogo.js"),"utf8");
  try{
    const config=JSON.parse(js.match(/^const config=(.+);$/m)?.[1]||"null");
    const prices=plans=>plans.map(({id,annualMonthlyEquivalent,monthlyPrice,setupFee})=>({id,annualMonthlyEquivalent,monthlyPrice,setupFee}));
    if(!config||JSON.stringify(prices(config.plans))!==JSON.stringify(prices(offer.plans)))errors.push("El selector de planes no coincide con la oferta pública.");
  }catch{errors.push("Configuración pública del selector de planes inválida.");}
  // Local releases can compare the editable source; CI remains portable without a sibling checkout.
  const editableOffer=resolve(root,"../../scalaris-comercio/commercial/offer.json");
  if(existsSync(editableOffer)){
    const source=JSON.parse(readFileSync(editableOffer,"utf8"));
    for(const plan of offer.plans||[]){
      const original=source.plans.find(candidate=>candidate.id===plan.id);
      if(!original||["annualMonthlyEquivalent","monthlyPrice","setupFee"].some(field=>plan[field]!==original[field]))errors.push(`Tarifas públicas distintas de la fuente editable: ${plan.id}`);
    }
  }
}
for(const file of publicFiles.filter(file=>file.endsWith(".json"))){
  const value=JSON.parse(readFileSync(file,"utf8"));
  const inspect=(node,at="")=>{
    if(!node||typeof node!=="object")return;
    for(const [key,child]of Object.entries(node)){
      const normalized=key.toLowerCase().replace(/[^a-z0-9]/g,"");
      if(/password|secret|credential|accesstoken|privatekey|apikey|suppliercost|unitcost|costars/.test(normalized)||["cbu","alias","cuit","taxid","legalname","holdername","issuer","paymentoptions","banktransfer","mercadopagomanual"].includes(normalized))errors.push(`Campo privado en JSON público ${relativeToPublic(file)}: ${at}${key}`);
      inspect(child,`${at}${key}.`);
    }
  };
  inspect(value);
}
const gallery = readFileSync(resolve(root, "proyectos/index.html"), "utf8");
for (const destination of ["https://scalaris.com.ar/tu-comida/", "https://scalaris.com.ar/e-medicapp/", "https://scalaris.com.ar/comercio/t/corralon-demo", "https://scalaris.com.ar/comercio/t/mayorista-demo", "https://scalaris.com.ar/comercio/t/almacen-demo", "https://scalaris.com.ar/mesa/"]) {
  if (!gallery.includes(`href="${destination}"`)) errors.push(`Proyecto sin acceso público en la galería: ${destination}`);
}
const galleryProjects = [...gallery.matchAll(/<article\b[^>]*\bdata-project="([^"]+)"[^>]*\bdata-state="([^"]+)"/g)];
const galleryProjectIds = new Set();
for (const [, project, state] of galleryProjects) {
  if (galleryProjectIds.has(project)) errors.push(`Proyecto repetido en la galería: ${project}`);
  galleryProjectIds.add(project);
  if (!["live", "demo", "preparation"].includes(state)) errors.push(`Estado de proyecto inválido: ${project}.${state}`);
}
const expectedGalleryProjects = ["corralon-demo", "mayorista-demo", "almacen-demo", "scalaris-mesa", "remodelaya", "shekinah", "tu-comida", "e-medicapp", "burger-house-3", "gestudio", "fourbubbles", "crm-platform", "pharmahome", "calendario-servicios", "inventarios-muebleria", "gym-academy-manager", "presupuestador-flete", "hogaria", "cjprestamos"];
if (galleryProjects.length !== expectedGalleryProjects.length) errors.push(`Se esperaban ${expectedGalleryProjects.length} fichas de proyectos, se encontraron ${galleryProjects.length}`);
for (const project of expectedGalleryProjects) {
  if (!galleryProjectIds.has(project)) errors.push(`Proyecto sin ficha en la galería: ${project}`);
}
const mesaProject = gallery.match(/<article\b[^>]*\bdata-project="scalaris-mesa"[^>]*>[\s\S]*?<\/article>/)?.[0] || "";
if (!mesaProject.includes('data-state="demo"') || !mesaProject.includes('class="preview-caption demo-caption">Demo interactiva</span>')) errors.push("Scalaris Mesa debe identificarse como demo interactiva");
if (!mesaProject.includes('src="../assets/proyectos/scalaris-mesa.png"')) errors.push("Falta la captura de Scalaris Mesa en su ficha");
if (!/por visitante/i.test(mesaProject) || !/datos ficticios/i.test(mesaProject)) errors.push("La ficha de Scalaris Mesa debe explicar el aislamiento por visitante y los datos ficticios");
const mesaLinks = [...mesaProject.matchAll(/<a\b[^>]*\bhref="https:\/\/scalaris\.com\.ar\/mesa\/"[^>]*>/g)];
if (mesaLinks.length !== 2 || mesaLinks.some(([link]) => !link.includes('target="_blank"') || !link.includes('rel="noopener noreferrer"'))) errors.push("La miniatura y el acceso de Scalaris Mesa deben abrir su demo en una pestaña nueva sin acceso a la ventana de origen");
for (const file of publicFiles) {
  if (/catalog-costs|cotizador|pricing|\.xlsx$|\.pdf$/i.test(file)) errors.push(`Archivo interno dentro del sitio público: ${file}`);
  if (statSync(file).size > 25 * 1024 * 1024) errors.push(`Archivo público demasiado grande: ${file}`);
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
execFileSync(process.execPath, ["--test", ...walk(resolve(root, "../scripts")).filter(file => file.endsWith(".test.mjs"))], { stdio: "inherit" });
console.log(
  `OK: portada, Productos, Catálogo, planes/demos, consulta guiada de software, galería con ${galleryProjectIds.size} proyectos y referencias locales/dinámicas sin oferta de hardware ni datos privados.`,
);
