import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../public");
const port = Number(process.env.SCALARIS_PREVIEW_PORT || 8080);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("SCALARIS_PREVIEW_PORT debe ser un puerto entre 1024 y 65535.");
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".ttf": "font/ttf", ".txt": "text/plain; charset=utf-8" };
const server = createServer((request, response) => {
  if (!["GET", "HEAD"].includes(request.method)) { response.writeHead(405).end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    let file = resolve(root, "." + pathname);
    if (file !== root && !file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    if (statSync(file).isDirectory()) file = resolve(file, "index.html");
    const stat = statSync(file);
    if (!stat.isFile()) { response.writeHead(404).end(); return; }
    response.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream", "Content-Length": stat.size, "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff" });
    if (request.method === "HEAD") response.end();
    else createReadStream(file).on("error", () => response.destroy()).pipe(response);
  } catch { response.writeHead(404).end("No encontrado"); }
});
server.on("error", error => { console.error(error.code === "EADDRINUSE" ? `El puerto ${port} ya está en uso. Cerrá la otra vista previa o elegí SCALARIS_PREVIEW_PORT.` : error.message); process.exitCode = 1; });
server.listen(port, "127.0.0.1", () => {
  const url = `http://127.0.0.1:${port}`;
  console.log(`Scalaris: ${url}\nPara cerrar la vista previa, cerrá esta ventana o presioná Ctrl+C.`);
  if (process.argv.includes("--open") && process.platform === "win32") {
    spawn("cmd.exe", ["/c", "start", "", url], { windowsHide: true, stdio: "ignore" }).on("error", () => console.log(`Abrí ${url} en tu navegador.`));
  }
});
