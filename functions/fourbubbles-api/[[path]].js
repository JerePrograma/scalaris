import { createDemoProxy } from '../../lib/vps-demo-proxy.js';
export const onRequest = createDemoProxy({
  prefix: '/fourbubbles-api/', api: true, cookieName: 'fourbubbles_demo_refresh',
  authPaths: ['/fourbubbles-api/api/auth/login', '/fourbubbles-api/api/auth/refresh', '/fourbubbles-api/api/auth/logout'],
  relatedPrefixes: ['/fourbubbles/', '/fourbubbles-api/'],
});
