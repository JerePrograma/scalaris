import {loadGestudioOffer} from './gestudio-offer.mjs';
const offer = await loadGestudioOffer({refreshSnapshot: true});
console.log(JSON.stringify({status: 'projected', source: offer.sourceReference, plans: offer.plans.length}));
