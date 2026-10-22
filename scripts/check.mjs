import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../public");
const html = readFileSync(resolve(root, "index.html"), "utf8");
const css = readFileSync(resolve(root, "styles.css"), "utf8");
const errors = [];
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
const refs = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
refs.push(
  ...[...css.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)].map((m) => m[1]),
);
let localFiles = 0;
for (const ref of refs) {
  if (ref.startsWith("#")) {
    if (ref.length > 1 && !ids.has(ref.slice(1)))
      errors.push(`Ancla inexistente: ${ref}`);
  } else if (!/^[a-z][a-z0-9+.-]*:/i.test(ref)) {
    const path = resolve(root, ref.split(/[?#]/)[0]);
    if (!path.startsWith(root + sep) || !existsSync(path))
      errors.push(`Recurso inexistente: ${ref}`);
    localFiles++;
  }
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
  if (/^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith("#")) continue;
  const file = resolve(formRoot, ref.split(/[?#]/)[0]);
  if (!file.startsWith(root + sep) || !existsSync(file))
    errors.push(`Recurso del formulario inexistente: ${ref}`);
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
    if (ref.startsWith("#")) {
      if (ref.length > 1 && !pageIds.has(ref.slice(1))) errors.push(`Ancla inexistente en ${file}: ${ref}`);
      continue;
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(ref)) continue;
    const target = resolve(dirname(file), ref.split(/[?#]/)[0]);
    if (!target.startsWith(root + sep) || !existsSync(target)) errors.push(`Recurso inexistente en ${file}: ${ref}`);
  }
}
for (const file of publicFiles.filter(file => file.endsWith(".js"))) execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
for (const file of ["proyectos/index.html", "tienda/index.html"]) {
  if (!existsSync(resolve(root, file))) errors.push(`Página inexistente: ${file}`);
}
const gallery = readFileSync(resolve(root, "proyectos/index.html"), "utf8");
for (const destination of ["https://scalaris.com.ar/tu-comida/", "https://scalaris.com.ar/e-medicapp/"]) {
  if (!gallery.includes(`href="${destination}"`)) errors.push(`Proyecto sin acceso público en la galería: ${destination}`);
}
const galleryProjects = [...gallery.matchAll(/<article\b[^>]*\bdata-project="([^"]+)"[^>]*\bdata-state="([^"]+)"/g)];
const galleryProjectIds = new Set();
for (const [, project, state] of galleryProjects) {
  if (galleryProjectIds.has(project)) errors.push(`Proyecto repetido en la galería: ${project}`);
  galleryProjectIds.add(project);
  if (!["live", "demo", "preparation"].includes(state)) errors.push(`Estado de proyecto inválido: ${project}.${state}`);
}
for (const project of ["remodelaya", "shekinah", "tu-comida", "e-medicapp", "burger-house-3", "gestudio", "fourbubbles", "crm-platform", "pharmahome", "calendario-servicios", "inventarios-muebleria", "gym-academy-manager", "presupuestador-flete", "hogaria", "cjprestamos"]) {
  if (!galleryProjectIds.has(project)) errors.push(`Proyecto sin ficha en la galería: ${project}`);
}
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
  `OK: portada, consulta guiada, galería, tienda, recursos locales y ${productIds.size} productos sin costos privados.`,
);
