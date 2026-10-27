import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { resolvePublicReference,validatePublicOffer } from "./public-references.mjs";

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
  "consulta/index.html",
  "consulta/index.html?service=EQUIPMENT",
  "consulta/index.html?service=SOFTWARE",
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
// Validate all public pages and assets, including the gallery and shop.
function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = resolve(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}
const publicFiles = walk(root);
for (const file of publicFiles.filter(file => /\.(html|css)$/.test(file))) {
  const text = readFileSync(file, "utf8");
  const pageIds = new Set([...text.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  const pageRefs = [
    ...[...text.matchAll(/\b(?:href|src)="([^"]+)"/g)].map(match => match[1]),
    ...[...text.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)].map(match => match[1]),
  ];
  for (const ref of pageRefs) {
    verifyReference(file,ref);
  }
}
for (const file of publicFiles.filter(file => file.endsWith(".js"))) execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
for (const file of ["proyectos/index.html", "tienda/index.html"]) {
  if (!existsSync(resolve(root, file))) errors.push(`Página inexistente: ${file}`);
}
const requiredCanonical = new Map([
  ["index.html","/"],["consulta/index.html","/consulta/"],["proyectos/index.html","/proyectos/"],["tienda/index.html","/tienda/"],
  ["productos/index.html","/productos/"],["catalogo/index.html","/catalogo/"],["catalogo/demos/index.html","/catalogo/demos/"],["catalogo/propuesta.html","/catalogo/propuesta"],
]);
for(const [filename,route] of requiredCanonical){
  const file=resolve(root,filename);
  if(!existsSync(file)){errors.push(`Página de producto inexistente: ${filename}`);continue;}
  const page=readFileSync(file,"utf8"),expected=`https://scalaris.com.ar${route}`;
  const canonicals=[...page.matchAll(/<link\b[^>]*\brel="canonical"[^>]*\bhref="([^"]+)"/g)];
  if(canonicals.length!==1||canonicals[0][1]!==expected)errors.push(`Canonical incorrecto en ${filename}`);
  if(!page.includes(`property="og:url" content="${expected}"`))errors.push(`OpenGraph URL incorrecta en ${filename}`);
}
const sitemap=readFileSync(resolve(root,"sitemap.xml"),"utf8");
for(const route of ["/","/consulta/","/proyectos/","/tienda/","/productos/","/catalogo/","/catalogo/demos/"]){
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
    if(!card.includes(money(plan.annualMonthlyEquivalent))||!card.includes(money(plan.setupFee)))errors.push(`Precio mensual o instalación inconsistente en el plan ${plan.id}`);
    if(!card.includes(`plan=${plan.id}`)||!card.includes("billing=annual"))errors.push(`Consulta sin contexto del plan ${plan.id}`);
  }
  for(const file of ["index.html","productos/index.html","catalogo/index.html","catalogo/propuesta.html","catalogo/cartel-precios.svg"]){
    const content=readFileSync(resolve(root,file),"utf8");
    for(const plan of offer.plans||[])if(content.includes(money(plan.annualMonthlyEquivalent*offer.billing.annualMonths)))errors.push(`Total anual prematuro en marketing: ${file}`);
  }
  const js=readFileSync(resolve(root,"catalogo/catalogo.js"),"utf8");
  try{
    const config=JSON.parse(js.match(/^const config=(.+);$/m)?.[1]||"null");
    if(!config||config.months!==offer.billing.annualMonths||JSON.stringify(config.plans)!==JSON.stringify(offer.plans.map(({id,annualMonthlyEquivalent,monthlyPrice,setupFee})=>({id,annualMonthlyEquivalent,monthlyPrice,setupFee}))))errors.push("El selector de planes no coincide con la oferta pública.");
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
const catalog = JSON.parse(readFileSync(resolve(root, "tienda/catalog.json"), "utf8"));
if (catalog.version !== 1 || !Array.isArray(catalog.products) || !catalog.products.length) errors.push("Catálogo público inválido");
const productIds = new Set();
const allowedKeys = new Set(["id", "name", "category", "brand", "image", "description", "price", "currency", "priceValidUntil", "priceUpdatedAt", "priceBasis", "orderable", "availabilityNote"]);
for (const product of catalog.products || []) {
  if (!product.id || productIds.has(product.id)) errors.push(`Referencia de producto repetida o ausente: ${product.id}`);
  productIds.add(product.id);
  if (!product.name || !product.category || !product.description || product.currency !== "ARS") errors.push(`Producto incompleto: ${product.id}`);
  for (const key of Object.keys(product)) if (!allowedKeys.has(key)) errors.push(`Campo no público en catálogo: ${product.id}.${key}`);
  if (product.price !== null && (!Number.isFinite(product.price) || product.price <= 0 || !Number.isFinite(Date.parse(product.priceValidUntil)))) errors.push(`Precio sin vigencia explícita: ${product.id}`);
  if (product.orderable === false && product.price !== null) errors.push(`Referencia bloqueada con precio público activo: ${product.id}`);
  if (product.orderable === true && !(Number.isFinite(product.price) && product.price > 0)) errors.push(`Referencia comprable sin precio: ${product.id}`);
  if (product.image) {
    if (product.image.startsWith("https://")) continue;
    const image = resolve(root, "tienda", product.image);
    if (!image.startsWith(root + sep) || !existsSync(image) || !/\.(png|jpe?g|webp)$/i.test(image)) errors.push(`Imagen inválida: ${product.id}`);
  }
}
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
  `OK: portada, Productos, Catálogo, planes/demos, consulta guiada, galería con ${galleryProjectIds.size} proyectos, tienda, referencias locales/dinámicas y ${productIds.size} productos sin costos privados.`,
);
