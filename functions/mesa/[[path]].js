const upstreamOrigin='https://srv2083548.hstgr.cloud';
const publicOrigin='https://scalaris.com.ar';
const prefix='/mesa/';
const securityHeaders={'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'};
const deny=(message,status=403)=>new Response(message,{status,headers:{...securityHeaders,'Cache-Control':'no-store'}});

// The browser never selects an upstream host or another application's session.
export function createMesaProxy(fetchImpl=fetch){
 return async function onRequest({request}){
  const url=new URL(request.url);
  if(url.pathname==='/mesa'){url.pathname=prefix;return Response.redirect(url.href,308);}
  if(!url.pathname.startsWith(prefix))return deny('No encontrado.',404);
  const api=url.pathname.startsWith('/mesa/api/');
  const methods=api?['GET','HEAD','POST','PATCH','OPTIONS']:['GET','HEAD'];
  if(!methods.includes(request.method))return deny('Método no permitido.',405);
  const origin=request.headers.get('Origin');
  if(api&&origin&&origin!==publicOrigin)return deny('Origen no permitido.');
  if(api&&!['GET','HEAD','OPTIONS'].includes(request.method)&&origin!==publicOrigin)return deny('Origen requerido.');
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...securityHeaders,'Cache-Control':'no-store'}});
  const source=new URL(upstreamOrigin);source.pathname=url.pathname;source.search=url.search;
  const headers=new Headers();
  for(const name of api?['Accept','Content-Type','Origin','X-CSRF-Token']:['Accept']){
   const value=request.headers.get(name);if(value)headers.set(name,value);
  }
  if(api){
   const cookie=(request.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('mesa_session='));
   if(cookie)headers.set('Cookie',cookie);
  }
  try{
   const upstream=await fetchImpl(source.href,{method:request.method,headers,redirect:'manual',cf:{cacheTtl:0},
    ...(!['GET','HEAD'].includes(request.method)?{body:request.body,duplex:'half'}:{})});
   if(upstream.status>=300&&upstream.status<400&&upstream.headers.has('Location')){
    const target=new URL(upstream.headers.get('Location'),source);
    if(![upstreamOrigin,publicOrigin].includes(target.origin)||!target.pathname.startsWith(prefix))return deny('Destino de redirección rechazado.',502);
    target.protocol=url.protocol;target.host=url.host;
    return new Response(null,{status:upstream.status,headers:{...securityHeaders,'Cache-Control':'no-store',Location:target.href}});
   }
   const response=new Response(request.method==='HEAD'?null:upstream.body,upstream);
   const cookies=typeof upstream.headers.getSetCookie==='function'?upstream.headers.getSetCookie():[upstream.headers.get('Set-Cookie')].filter(Boolean);
   response.headers.delete('Set-Cookie');
   if(api)for(const cookie of cookies.filter(x=>x.startsWith('mesa_session='))){
    response.headers.append('Set-Cookie',cookie.replace(/;\s*Domain=[^;]+/gi,''));
   }
   for(const [k,v]of Object.entries(securityHeaders))response.headers.set(k,v);
   if(api||!url.pathname.startsWith('/mesa/assets/'))response.headers.set('Cache-Control','no-store');
   return response;
  }catch{return deny('Scalaris Mesa está temporalmente fuera de servicio.',503);}
 };
}
export const onRequest=createMesaProxy();
