const publicPath = "/tu-comida/";
const publicOrigin = "https://scalaris.com.ar";
const publications = [
  { prefix: `${publicPath}backend/`, origin: "https://tu-comida-api.jeremias-j-riv.workers.dev", api: true },
  { prefix: `${publicPath}editor-api/`, origin: "https://tu-comida-catalog-editor.jeremias-j-riv.workers.dev", api: true },
  { prefix: `${publicPath}gestion/`, origin: "https://tu-comida-management.jeremias-j-riv.workers.dev", api: false },
  { prefix: publicPath, origin: "https://tu-comida-web.jeremias-j-riv.workers.dev", api: false },
];

function destination(pathname) {
  return publications.find(({ prefix }) => pathname === prefix.slice(0, -1) || pathname.startsWith(prefix));
}

function publicRedirect(location, source, requestUrl) {
  const target = new URL(location, source);
  if ((target.origin === requestUrl.origin || target.origin === publicOrigin) && target.pathname.startsWith(publicPath)) return target.href;
  const publication = publications.find(({ origin }) => target.origin === origin);
  if (!publication) return null;
  const result = new URL(requestUrl.origin);
  result.pathname = publication.prefix + target.pathname.replace(/^\//, "");
  result.search = target.search;
  result.hash = target.hash;
  return result.href;
}

// Fixed upstreams keep the new application isolated from Scalaris' static pages.
// Only the application's bearer token is forwarded to its API, never cookies or
// credentials belonging to the surrounding Scalaris website.
export async function onRequest({ request }) {
  const url = new URL(request.url);
  if (url.pathname === publicPath.slice(0, -1)) {
    url.pathname = publicPath;
    return Response.redirect(url.href, 308);
  }
  if (!url.pathname.startsWith(publicPath)) return new Response("Not found", { status: 404 });
  const publication = destination(url.pathname);
  if (!publication) return new Response("Not found", { status: 404 });
  const methods = publication.api ? ["GET", "HEAD", "POST", "OPTIONS"] : ["GET", "HEAD"];
  if (!methods.includes(request.method)) return new Response("Method not allowed", { status: 405, headers: { Allow: methods.join(", ") } });

  const source = new URL(publication.origin);
  source.pathname = "/" + (url.pathname === publication.prefix.slice(0, -1) ? "" : url.pathname.slice(publication.prefix.length));
  source.search = url.search;
  const headers = new Headers();
  if (publication.api) {
    for (const name of ["Accept", "Content-Type", "Authorization", "Origin"]) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
  }
  try {
    const upstream = await fetch(source.href, {
      method: request.method,
      headers,
      ...(request.method === "POST" ? { body: request.body, duplex: "half" } : {}),
      redirect: "manual",
      cf: { cacheTtl: 0 },
    });
    if (upstream.status >= 300 && upstream.status < 400 && upstream.headers.has("Location")) {
      const location = publicRedirect(upstream.headers.get("Location"), source, url);
      if (!location) return new Response("Tu Comida publication unavailable", { status: 502, headers: { "Cache-Control": "no-store" } });
      return new Response(null, { status: upstream.status, headers: { Location: location, "Cache-Control": "no-store" } });
    }
    const response = new Response(request.method === "HEAD" ? null : upstream.body, upstream);
    response.headers.delete("Set-Cookie");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    if (publication.api || !/\.[a-z0-9]+$/i.test(url.pathname) || /\.(?:html|json)$/i.test(url.pathname)) {
      response.headers.set("Cache-Control", "no-store");
    }
    return response;
  } catch {
    return new Response("Tu Comida publication unavailable", { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
