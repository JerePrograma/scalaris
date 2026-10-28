import {cp,readFile,writeFile,stat,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const collection=path.resolve(root,'../contenido-redes/flyers-lanzamiento-2026-10-28');
const source=path.join(collection,'public-export'),destination=path.join(root,'public/flyers');
if(!destination.startsWith(path.join(root,'public')+path.sep))throw Error('Destino fuera de public.');
async function files(dir){const result=[];for(const e of await readdir(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())result.push(...await files(f));else result.push(f);}return result;}
for(const file of await files(source)){
  if((await stat(file)).size>=25*1024*1024)throw Error('Recurso demasiado grande.');
  if(/\.(?:html|css|js|json)$/.test(file)&&/C:\\\\|C:\/laburo|\.private|AppData|generated_images/.test(await readFile(file,'utf8')))throw Error('Ruta privada en exportación.');
}
await cp(source,destination,{recursive:true});
const bundles=[['scalaris-facebook-instagram-lanzamiento-2026-10-28.zip','Facebook / Instagram · 46 PNG'],['scalaris-whatsapp-lanzamiento-2026-10-28.zip','WhatsApp · 46 PNG']];
for(const[file]of bundles){if((await stat(path.join(collection,file))).size>=25*1024*1024)throw Error('ZIP supera límite de Pages.');await cp(path.join(collection,file),path.join(destination,file));}
const file=path.join(destination,'index.html');let html=await readFile(file,'utf8');
const links=`<div class="bulk-downloads" aria-label="Descargar colecciones completas">${bundles.map(([file,label])=>`<a href="${file}" download>Descargar ZIP ${label} ↓</a>`).join('')}</div>`;
html=html.replace('<div class="toolbar">',links+'<div class="toolbar">');await writeFile(file,html);
const css=path.join(destination,'gallery.css');await writeFile(css,(await readFile(css,'utf8'))+'\n.bulk-downloads{display:flex;gap:12px;flex-wrap:wrap;margin:24px 0}.bulk-downloads a{padding:13px 18px;border-radius:8px;background:#145cdb;color:white;font-size:13px;font-weight:700;text-decoration:none}.bulk-downloads a:hover{background:#104bb5}.bulk-downloads a:focus-visible{outline:3px solid #0b1f33;outline-offset:3px}@media(max-width:600px){.bulk-downloads{display:grid}.bulk-downloads a{text-align:center}}\n');
console.log(JSON.stringify({status:'synchronized',pieces:46,png:92,bundles:2,destination}));
