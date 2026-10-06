import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { execFileSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../public");
const html = readFileSync(resolve(root, "index.html"), "utf8");
const css = readFileSync(resolve(root, "styles.css"), "utf8");
const script = readFileSync(resolve(root, "script.js"), "utf8");
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
if (!html.includes('href="tel:+5491141477227"'))
  errors.push("Teléfono incorrecto");
const links = refs.filter((ref) => ref.startsWith("https://wa.me/"));
if (
  links.length !== 3 ||
  links.some((ref) => !ref.startsWith("https://wa.me/5491141477227?text="))
)
  errors.push("Enlaces WhatsApp incorrectos");
for (const key of ["general", "equipo", "redes", "armado", "software"]) {
  if (!html.includes(`value="${key}"`) || !script.includes(`${key}:`))
    errors.push(`Motivo de contacto inexistente: ${key}`);
}
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
new vm.Script(script, { filename: "script.js" });
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
console.log(
  `OK: ${localFiles} referencias a recursos, anclas, teléfono, 3 enlaces WhatsApp, 5 motivos, 4 FAQ y fuentes/licencia Inter.`,
);
