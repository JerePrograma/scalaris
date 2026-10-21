const publicPath = "/e-medicapp/";
const sourcePath = "/E-MEDICAPP/";

// Serve only the public static build. Browser cookies and API credentials must
// never be forwarded from the Scalaris origin to GitHub Pages.
export async function onRequest({ request }) {
  const url = new URL(request.url);
  if (url.pathname === publicPath.slice(0, -1)) {
    url.pathname = publicPath;
    return Response.redirect(url.href, 308);
  }
  if (!url.pathname.startsWith(publicPath)) return new Response("Not found", { status: 404 });
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const source = new URL("https://jereprograma.github.io");
  source.pathname = sourcePath + url.pathname.slice(publicPath.length);
  source.search = url.search;
  try {
    const upstream = await fetch(source.href, {
      method: request.method,
      redirect: "manual",
      // Always revalidate the build and deployment marker after a publication.
      cf: { cacheTtl: 0 },
    });
    if (upstream.status >= 300 && upstream.status < 400) {
      const location = new URL(upstream.headers.get("Location"), source);
      if (location.origin !== source.origin || !location.pathname.startsWith(sourcePath)) {
        return new Response("Static publication unavailable", { status: 502 });
      }
      url.pathname = publicPath + location.pathname.slice(sourcePath.length);
      url.search = location.search;
      return Response.redirect(url.href, upstream.status);
    }
    const response = new Response(upstream.body, upstream);
    response.headers.delete("Set-Cookie");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    if (url.pathname === publicPath || url.pathname.endsWith("/index.html") || url.pathname.endsWith("/deployment.json")) {
      response.headers.set("Cache-Control", "no-store");
    }
    return response;
  } catch {
    return new Response("Static publication unavailable", { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
