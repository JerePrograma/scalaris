export const services = {
  EQUIPMENT: "Reparación / mantenimiento",
  PARTS: "Repuestos",
  SOFTWARE: "Web / software",
};
export const labels = {
  topic: "Motivo",
  type: "Tipo de equipo",
  model: "Marca / modelo",
  problem: "Qué necesitás resolver",
  since: "Desde cuándo",
  need: "Necesidad",
  scope: "Alcance inicial",
  requirements: "Requisitos o herramientas actuales",
  deadline: "Plazo solicitado",
  part: "Repuesto buscado",
  compatibility: "Equipo / compatibilidad conocida",
};
export const questions = {
  EQUIPMENT: [
    {
      key: "topic",
      label: "¿Qué necesitás?",
      options: [
        "Reparar una falla",
        "Mantenimiento / limpieza",
        "Equipo lento / sistema",
        "Redes / Wi-Fi",
        "Armado / mejora",
        "No estoy seguro",
      ],
    },
    {
      key: "type",
      label: "Tipo de equipo",
      options: [
        "PC de escritorio",
        "Notebook",
        "AIO",
        "Consola",
        "Tablet / celular",
        "Router / red",
        "Otro",
      ],
    },
    { key: "model", label: "Marca / modelo (si lo sabés)" },
    {
      key: "problem",
      label: "Contanos qué pasa o qué necesitás *",
      required: true,
      long: true,
    },
    {
      key: "since",
      label: "¿Desde cuándo? ¿Hubo algún cambio previo?",
      long: true,
    },
  ],
  PARTS: [
    {
      key: "part",
      label: "¿Qué repuesto buscás? *",
      required: true,
      long: true,
    },
    {
      key: "compatibility",
      label: "¿Para qué equipo? Marca / modelo o compatibilidad conocida",
      long: true,
    },
  ],
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
    inquiry.answers.part ||
    inquiry.answers.need ||
    inquiry.answers.problem ||
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
  if (service === "EQUIPMENT") {
    if (answers.topic === "Redes / Wi-Fi")
      return [
        {
          key: "requirements",
          label:
            "¿Afecta a un dispositivo o a toda la red? ¿Qué conexión usás?",
          long: true,
        },
      ];
    if (answers.topic === "Armado / mejora")
      return [
        {
          key: "scope",
          label: "¿Para qué lo usarías? ¿Qué querés mejorar?",
          long: true,
        },
        {
          key: "requirements",
          label: "¿Qué componentes tenés actualmente? (si lo sabés)",
          long: true,
        },
      ];
    if (answers.topic === "Mantenimiento / limpieza")
      return [
        {
          key: "scope",
          label: "¿Qué uso tiene el equipo? ¿Cuándo fue su última limpieza?",
          long: true,
        },
      ];
  }
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
  if (!services[service]) throw new Error("Elegí un servicio.");
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
