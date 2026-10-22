const upstreamOrigin = 'https://srv2083548.hstgr.cloud';
const publicOrigin = 'https://scalaris.com.ar';
const noStore = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

// All destinations are fixed deployment routes. Browser input never selects a host.
export function createDemoProxy({ prefix, api = false, cookieName, authPaths = [], relatedPrefixes = [prefix] }) {
  return async function onRequest({ request }) {
    const url = new URL(request.url);
    if (url.pathname === prefix.slice(0, -1)) {
      url.pathname = prefix;
      return Response.redirect(url.href, 308);
    }
    if (!url.pathname.startsWith(prefix)) return new Response('Not found', { status: 404 });
    const authWrite = api && request.method === 'POST' && authPaths.includes(url.pathname);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !authWrite) {
      return new Response('Esta demo permite consultar datos ficticios.', { status: 405, headers: { ...noStore, Allow: api ? 'GET, HEAD, OPTIONS' : 'GET, HEAD' } });
    }
    if (!api && request.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (api && request.headers.has('Origin') && request.headers.get('Origin') !== publicOrigin) {
      return new Response('Origen no permitido.', { status: 403, headers: noStore });
    }
    const source = new URL(upstreamOrigin);
    source.pathname = url.pathname;
    source.search = url.search;
    const headers = new Headers();
    if (api) {
      for (const name of ['Accept', 'Content-Type', 'Authorization', 'Origin', 'X-Tenant-Slug', 'X-Request-ID', 'X-CSRF-TOKEN', 'X-XSRF-TOKEN']) {
        const value = request.headers.get(name);
        if (value) headers.set(name, value);
      }
      const cookie = (request.headers.get('Cookie') || '').split(';').map(value => value.trim()).find(value => value.startsWith(`${cookieName}=`));
      if (cookie) headers.set('Cookie', cookie);
    }
    try {
      const upstream = await fetch(source.href, {
        method: request.method, headers, redirect: 'manual', cf: { cacheTtl: 0 },
        ...(authWrite ? { body: request.body, duplex: 'half' } : {}),
      });
      if (upstream.status >= 300 && upstream.status < 400 && upstream.headers.has('Location')) {
        const target = new URL(upstream.headers.get('Location'), source);
        if (![upstreamOrigin, publicOrigin].includes(target.origin) || !relatedPrefixes.some(path => target.pathname.startsWith(path))) {
          return new Response('Demo temporalmente no disponible.', { status: 502, headers: noStore });
        }
        target.protocol = url.protocol;
        target.host = url.host;
        return new Response(null, { status: upstream.status, headers: { ...noStore, Location: target.href } });
      }
      const response = new Response(request.method === 'HEAD' ? null : upstream.body, upstream);
      const setCookies = typeof upstream.headers.getSetCookie === 'function' ? upstream.headers.getSetCookie() : [upstream.headers.get('Set-Cookie')].filter(Boolean);
      response.headers.delete('Set-Cookie');
      if (api && cookieName) {
        for (const cookie of setCookies.filter(value => value.startsWith(`${cookieName}=`))) {
          response.headers.append('Set-Cookie', cookie.replace(/;\s*Domain=[^;]+/gi, ''));
        }
      }
      response.headers.set('X-Content-Type-Options', 'nosniff');
      response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      if (api || !/\.[a-z0-9]+$/i.test(url.pathname) || /\.(?:html|json|webmanifest)$/i.test(url.pathname)) response.headers.set('Cache-Control', 'no-store');
      return response;
    } catch {
      return new Response('Demo temporalmente no disponible.', { status: 502, headers: noStore });
    }
  };
}
