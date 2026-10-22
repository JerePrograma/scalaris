import { createDemoProxy } from '../../lib/vps-demo-proxy.js';
export const onRequest = createDemoProxy({ prefix: '/fourbubbles/' });
