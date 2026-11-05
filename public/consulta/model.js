import { priceReferences } from './price-references.js?v=20261105-planesclaros';

export const services = {
  SOFTWARE: "Web / software",
};
const productFamilies = Object.freeze({
  catalogo: {name:'Scalaris Catálogo',topic:'Sitio web',plans:{catalogo:'Vidriera',pedidos:'Flujo',gestion:'Pulso'}},
  web: {name:'Scalaris Web',topic:'Sitio web',plans:{presencia:'Origen',negocio:'Web de hasta 5 páginas'}},
  menu: {name:'Menú gastronómico',topic:'Software a medida',plans:null},
  mesa: {name:'Scalaris Mesa',topic:'Software a medida',plans:null},
  academia: {name:'Gestudio',topic:'Software a medida',plans:null},
  crm: {name:'CRM Scalaris',topic:'Software a medida',plans:null},
  fourbubbles: {name:'FourBubbles',topic:'Software a medida',plans:null},
  'e-medicapp': {name:'E-MEDICAPP',topic:'Software a medida',plans:null},
  'inventarios-muebleria': {name:'Inventarios Mueblería',topic:'Software a medida',plans:null},
  'gym-academy-manager': {name:'Gym & Academy Manager',topic:'Software a medida',plans:null},
  'presupuestador-flete': {name:'Presupuestador Flete',topic:'Software a medida',plans:null},
  hogaria: {name:'HogarIA',topic:'Software a medida',plans:null},
  cjprestamos: {name:'CJ Préstamos',topic:'Software a medida',plans:null},
});
const productBilling = Object.freeze({annual:'pago anual anticipado',monthly:'mes a mes'});
/** Informational reference from the generated offer, never a closed quote or URL amount. */
export function productPriceReference(interest) {
  const reference = interest && Object.hasOwn(priceReferences, interest.product) ? priceReferences[interest.product] : null;
  if (!reference || reference.currency !== 'ARS' || !Number.isSafeInteger(reference.monthlyFrom) || reference.monthlyFrom <= 0) return null;
  const number = value => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(value);
  const lines = [`Desde $${number(reference.monthlyFrom)} ARS por mes${reference.unitLabel ? ` · ${reference.unitLabel}` : ''}.`];
  if (reference.pricingNote) lines.push(reference.pricingNote);
  if (interest.product === 'academia' && Array.isArray(reference.plans)) {
    for (const plan of reference.plans) {
      if (!Number.isSafeInteger(plan.monthlyPrice) || plan.monthlyPrice <= 0 || !Number.isSafeInteger(plan.studentsMin) || plan.studentsMin < 1) continue;
      const openEnded = plan.studentsMax === null;
      if (!openEnded && (!Number.isSafeInteger(plan.studentsMax) || plan.studentsMax < plan.studentsMin)) continue;
      const students = openEnded ? `desde ${plan.studentsMin} alumnos activos` : `${plan.studentsMin} a ${plan.studentsMax} alumnos activos`;
      lines.push(`${plan.name}: ${openEnded ? 'desde ' : ''}$${number(plan.monthlyPrice)} por mes · ${students}.`);
    }
    const billing = reference.billing;
    if (Number.isFinite(billing?.implementationMonths) && billing.implementationMonths > 0 && !reference.pricingNote?.includes(`${number(billing.implementationMonths)} mensualidades`)) lines.push(`Implementación inicial de referencia: ${number(billing.implementationMonths)} mensualidades del plan acordado; importación y acompañamiento con alcance definido en el presupuesto.`);
    if (Number.isFinite(billing?.annualDiscountRate) && billing.annualDiscountRate > 0 && billing.annualDiscountRate < 1) lines.push(`Pago anual anticipado: ${number(billing.annualDiscountRate * 100)}% de descuento en el abono. Implementación por separado.`);
  }
  return lines.join('\n');
}
/** A URL expresses interest only. Prices and contract terms never come from query values. */
export function readProductInterest(search = '') {
  const params = new URLSearchParams(search);
  const product = params.get('product')==='scalaris-catalogo'?'catalogo':params.get('product');
  if (!Object.hasOwn(productFamilies,product)) return null;
  const family=productFamilies[product];
  const requestedPlan = params.get('plan'), requestedBilling = params.get('billing');
  const plan = family.plans&&Object.hasOwn(family.plans,requestedPlan) ? requestedPlan : null;
  const billing = family.plans
    ? !params.has('billing') ? 'monthly' : Object.hasOwn(productBilling,requestedBilling) ? requestedBilling : null
    : null;
  return {product,productName:family.name,plan,planName:plan?family.plans[plan]:null,billing,billingName:billing?productBilling[billing]:null};
}
export function productInterestAnswers(interest) {
  const safe = interest&&Object.hasOwn(productFamilies,interest.product)
    ? readProductInterest(new URLSearchParams({product:interest.product,...(interest.plan?{plan:interest.plan}:{}),...(Object.hasOwn(interest,'billing')?{billing:interest.billing??''}:{})}).toString())
    : null;
  if (!safe) return {};
  const family=productFamilies[safe.product];
  return {topic:family.topic,need:`Quiero conocer ${safe.productName} para mi negocio.`,scope:family.plans
    ? `Me interesa ${safe.planName?`el plan ${safe.planName}`:'definir qué plan me conviene'}${safe.billingName?`, con modalidad ${safe.billingName}`:''}. Quiero revisar el alcance y las condiciones antes de contratar.`
    : `Quiero un relevamiento para implementar ${safe.productName}. Necesito revisar el funcionamiento, el alcance y el presupuesto antes de contratar.${productPriceReference(safe) ? ` Referencia: ${productPriceReference(safe)}` : ''}`};
}
export const labels = {
  topic: "Motivo",
  need: "Necesidad",
  scope: "Alcance inicial",
  requirements: "Requisitos o herramientas actuales",
  deadline: "Plazo solicitado",
  compatibility: "Sistemas a integrar",
};
export const questions = {
  SOFTWARE: [
    {
      key: "topic",
      label: "Tipo de proyecto",
      options: [
        "Sitio web",
        "Software a medida",
        "Automatización / integración",
        "Quiero definirlo con ustedes",
      ],
    },
    {
      key: "need",
      label: "¿Qué necesitás resolver? *",
      required: true,
      long: true,
    },
    {
      key: "scope",
      label: "¿Qué debería permitir hacer? Alcance inicial",
      long: true,
    },
    {
      key: "requirements",
      label: "Herramientas actuales / requisitos (sin accesos ni credenciales)",
      long: true,
    },
    { key: "deadline", label: "¿Tenés un plazo deseado?" },
  ],
};
export function summary(inquiry) {
  const lines = [
    "Consulta para Scalaris",
    services[inquiry.service],
    "Nombre: " + inquiry.contact.name,
  ];
  if (inquiry.contact.phone) lines.push("Contacto: " + inquiry.contact.phone);
  for (const [key, value] of Object.entries(inquiry.answers))
    if (value) lines.push(labels[key] + ": " + value);
  lines.push("Consulta inicial, sujeta a revisión. No es un presupuesto.");
  return lines.join("\n");
}
export function whatsappMessage(inquiry) {
  const topic = (
    inquiry.answers.topic ||
    inquiry.answers.need ||
    ""
  ).slice(0, 160);
  return (
    "Hola Scalaris, quiero consultar por " +
    services[inquiry.service] +
    (topic ? ". Motivo: " + topic : ".") +
    ". Preparé una ficha; puedo compartir más detalles manualmente."
  );
}
export function conditionalQuestions(service, answers) {
  if (
    service === "SOFTWARE" &&
    answers.topic === "Automatización / integración"
  )
    return [
      {
        key: "compatibility",
        label:
          "¿Qué sistemas o herramientas necesitás conectar? Sin claves ni accesos.",
        long: true,
      },
    ];
  return [];
}
export function buildInquiry(service, contact, answers, id, createdAt) {
  if (!Object.hasOwn(services, service)) throw new Error("Elegí un servicio.");
  const clean = {};
  for (const q of [
    ...questions[service],
    ...conditionalQuestions(service, answers),
  ]) {
    let value = String(answers[q.key] || "").trim();
    if (value.length > 2000)
      throw new Error("Una respuesta supera 2000 caracteres.");
    if (q.required && !value) throw new Error("Completá: " + q.label);
    clean[q.key] = value;
  }
  const name = String(contact.name || "").trim(),
    phone = String(contact.phone || "").trim();
  if (!name || name.length > 300 || phone.length > 100)
    throw new Error("Revisá el nombre y el teléfono.");
  return {
    schema: "scalaris.inquiry",
    version: 1,
    id,
    createdAt,
    service,
    contact: { name, phone },
    answers: clean,
  };
}
