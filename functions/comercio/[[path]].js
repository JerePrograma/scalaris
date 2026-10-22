const upstreamOrigin='https://srv2083548.hstgr.cloud';
const prefix='/comercio/';
const noStore={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
export async function onRequest({request}){
 const url=new URL(request.url);
 if(url.pathname===prefix.slice(0,-1)){url.pathname=prefix;return Response.redirect(url.href,308);}
 if(!url.pathname.startsWith(prefix))return new Response('Not found',{status:404});
 const api=url.pathname.startsWith(`${prefix}api/`);
 const methods=api?['GET','HEAD','POST','PUT','PATCH','OPTIONS']:['GET','HEAD'];
 if(!methods.includes(request.method))return new Response('Método no permitido.',{status:405,headers:{...noStore,Allow:methods.join(', ')}});
 const origin=request.headers.get('Origin');
 if(api&&origin&&origin!==url.origin)return new Response('Origen no permitido.',{status:403,headers:noStore});
 const source=new URL(upstreamOrigin);source.pathname=url.pathname;source.search=url.search;
 const headers=new Headers();
 for(const name of api?['Accept','Content-Type','Authorization','Origin']:['Accept']){const value=request.headers.get(name);if(value)headers.set(name,value);}
 try{
  const response=await fetch(source,{method:request.method,headers,redirect:'manual',cf:{cacheTtl:0},...(!['GET','HEAD','OPTIONS'].includes(request.method)?{body:request.body,duplex:'half'}:{})});
  if(response.status>=300&&response.status<400&&response.headers.has('Location')){
   const target=new URL(response.headers.get('Location'),source);
   if(![upstreamOrigin,url.origin].includes(target.origin)||!target.pathname.startsWith(prefix))return new Response('Destino no permitido.',{status:502,headers:noStore});
   target.protocol=url.protocol;target.host=url.host;
   return new Response(null,{status:response.status,headers:{...noStore,Location:target.href}});
  }
  const result=new Response(request.method==='HEAD'?null:response.body,response);
  result.headers.delete('Set-Cookie');
  for(const [key,value]of Object.entries(noStore))result.headers.set(key,value);
  return result;
 }catch{return new Response('Comercio temporalmente no disponible.',{status:502,headers:noStore});}
}
