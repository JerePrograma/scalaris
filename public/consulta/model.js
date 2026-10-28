export const services = {
  SOFTWARE: "Web / software",
};
const productFamilies = Object.freeze({
  catalogo: {name:'Scalaris Catálogo',topic:'Sitio web',plans:{catalogo:'Catálogo para WhatsApp',pedidos:'Catálogo con seguimiento de pedidos',gestion:'Catálogo con pedidos y caja manual'}},
  web: {name:'Scalaris Web',topic:'Sitio web',plans:{presencia:'Web de una página',negocio:'Web de hasta 5 páginas'}},
  menu: {name:'Menú gastronómico',topic:'Software a medida',plans:null},
  mesa: {name:'Scalaris Mesa',topic:'Software a medida',plans:null},
  academia: {name:'Gestudio',topic:'Software a medida',plans:null},
  crm: {name:'CRM Scalaris',topic:'Software a medida',plans:null},
});
const productBilling = Object.freeze({annual:'pago anual anticipado',monthly:'mes a mes'});
/** A URL expresses interest only. Prices and contract terms never come from query values. */
export function readProductInterest(search = '') {
  const params = new URLSearchParams(search);
  const product = params.get('product')==='scalaris-catalogo'?'catalogo':params.get('product');
  if (!Object.hasOwn(productFamilies,product)) return null;
  const family=productFamilies[product];
  const requestedPlan = params.get('plan'), requestedBilling = params.get('billing');
  const plan = family.plans&&Object.hasOwn(family.plans,requestedPlan) ? requestedPlan : null;
  const billing = family.plans&&Object.hasOwn(productBilling,requestedBilling) ? requestedBilling : null;
  return {product,productName:family.name,plan,planName:plan?family.plans[plan]:null,billing,billingName:billing?productBilling[billing]:null};
}
export function productInterestAnswers(interest) {
  const safe = interest&&Object.hasOwn(productFamilies,interest.product)
    ? readProductInterest(new URLSearchParams({product:interest.product,...(interest.plan?{plan:interest.plan}:{}),...(interest.billing?{billing:interest.billing}:{})}).toString())
    : null;
  if (!safe) return {};
  const family=productFamilies[safe.product];
  return {topic:family.topic,need:`Quiero conocer ${safe.productName} para mi negocio.`,scope:family.plans
    ? `Me interesa ${safe.planName?`el plan ${safe.planName}`:'definir qué plan me conviene'}${safe.billingName?`, con modalidad ${safe.billingName}`:''}. Quiero revisar el alcance y las condiciones antes de contratar.`
    : `Quiero un relevamiento para implementar ${safe.productName}. Necesito revisar el funcionamiento, el alcance y el presupuesto antes de contratar.`};
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
