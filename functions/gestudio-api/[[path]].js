import { createDemoProxy } from '../../lib/vps-demo-proxy.js';
export const onRequest = createDemoProxy({
  prefix: '/gestudio-api/', api: true, cookieName: 'gestudio_scalaris_refresh',
  authPaths: ['/gestudio-api/api/login', '/gestudio-api/api/login/refresh', '/gestudio-api/api/login/logout', '/gestudio-api/api/login/tenant'],
  relatedPrefixes: ['/gestudio/', '/gestudio-api/'],
});
