import {
  services,
  questions,
  conditionalQuestions,
  labels,
  summary,
  whatsappMessage,
  buildInquiry,
} from "./model.js";
const root = document.querySelector("#form-root"),
  error = document.querySelector("#error");
let step = 0,
  service = "",
  contact = { name: "", phone: "" },
  answers = {},
  inquiry = null;
const id = crypto.randomUUID(),
  createdAt = new Date().toISOString();
function element(tag, text, attrs = {}) {
  const e = document.createElement(tag);
  if (text) e.textContent = text;
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}
function button(text, action, primary = false) {
  const b = element("button", text, {
    type: "button",
    class: primary ? "primary" : "",
  });
  b.addEventListener("click", () => {
    try {
      error.hidden = true;
      action();
    } catch (e) {
      error.textContent = e.message;
      error.hidden = false;
    }
  });
  return b;
}
function field(
  label,
  key,
  target,
  { options, required, long, max = 2000 } = {},
) {
  const wrapper = element("label"),
    caption = element("span", label);
  let input;
  if (options) {
    input = element("select");
    for (const value of options)
      input.append(element("option", value, { value }));
    if (!target[key]) target[key] = options[0];
  } else
    input = element(long ? "textarea" : "input", null, {
      maxlength: String(max),
      ...(long ? { rows: "3" } : { type: "text" }),
    });
  input.value = target[key] || "";
  if (required) input.required = true;
  input.addEventListener("input", () => (target[key] = input.value));
  if (options && key === "topic")
    input.addEventListener("change", () => {
      target[key] = input.value;
      render();
    });
  wrapper.append(caption, input);
  return wrapper;
}
function render() {
  root.replaceChildren();
  document
    .querySelectorAll(".steps li")
    .forEach((e, i) => e.classList.toggle("active", i === step));
  if (step === 0) {
    root.append(element("h2", "¿Sobre qué querés consultar?"));
    const options = element("div", null, { class: "choices" });
    for (const [key, label] of Object.entries(services)) {
      const b = button(
        label,
        () => {
          if (service !== key) {
            answers = {};
            service = key;
          }
          step = 1;
          render();
        },
        true,
      );
      options.append(b);
    }
    root.append(
      options,
      element(
        "p",
        "Este formulario prepara una consulta. El presupuesto se acuerda después de la revisión.",
        { class: "note" },
      ),
    );
  }
  if (step === 1) {
    root.append(element("h2", services[service]));
    const form = element("form");
    for (const q of [
      ...questions[service],
      ...conditionalQuestions(service, answers),
    ])
      form.append(field(q.label, q.key, answers, q));
    if (service === "EQUIPMENT") {
      const hint = element(
        "p",
        "Si no enciende, contá qué luces o sonidos notás. Si es mantenimiento, indicá el uso habitual. No incluyas accesos al equipo.",
        { class: "note" },
      );
      form.append(hint);
    }
    if (service === "PARTS")
      form.append(
        element(
          "p",
          "Si no conocés la compatibilidad, podemos revisarla. No hace falta informar una dirección ni datos de pago.",
          { class: "note" },
        ),
      );
    // Questions change by the selected service; further hints depend on the equipment topic.
    const topic = form.querySelector("select");
    if (service === "EQUIPMENT" && topic) {
      const conditional = element("p", null, { class: "conditional" });
      const update = () => {
        conditional.textContent =
          answers.topic === "Redes / Wi-Fi"
            ? "Contá si el problema afecta a un dispositivo o a toda la red. No compartas la clave Wi-Fi."
            : answers.topic === "Armado / mejora"
              ? "Indicá para qué usarías el equipo y qué querés mejorar."
              : "Contá síntomas o necesidades sin incluir información privada.";
      };
      topic.addEventListener("change", update);
      update();
      form.append(conditional);
    }
    form.append(
      element("h3", "¿Cómo te identificamos?"),
      field("Nombre o identificación útil *", "name", contact, {
        required: true,
        max: 300,
      }),
      field("Teléfono / WhatsApp (opcional)", "phone", contact, { max: 100 }),
    );
    const actions = element("div", null, { class: "actions" });
    actions.append(
      button("← Cambiar servicio", () => {
        step = 0;
        render();
      }),
    );
    const submit = element("button", "Revisar consulta", {
      type: "submit",
      class: "primary",
    });
    actions.append(submit);
    form.append(actions);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      try {
        inquiry = buildInquiry(service, contact, answers, id, createdAt);
        step = 2;
        error.hidden = true;
        render();
      } catch (e) {
        error.textContent = e.message;
        error.hidden = false;
      }
    });
    root.append(form);
  }
  if (step === 2) {
    root.append(element("h2", "Revisá antes de compartir"));
    const pre = element("pre", summary(inquiry), { class: "summary" });
    root.append(pre);
    const feedback = element("p", null, { role: "status" });
    const actions = element("div", null, { class: "actions" });
    actions.append(
      button("← Corregir respuestas", () => {
        step = 1;
        render();
      }),
      button(
        "Copiar resumen",
        async () => {
          try {
            await navigator.clipboard.writeText(summary(inquiry));
            feedback.textContent = "Resumen copiado. No se envió nada.";
          } catch {
            feedback.textContent =
              "No se pudo copiar automáticamente. Seleccioná el texto del resumen y copialo.";
          }
        },
        true,
      ),
      button("Descargar ficha JSON", () => {
        const blob = new Blob([JSON.stringify(inquiry, null, 2)], {
            type: "application/json",
          }),
          url = URL.createObjectURL(blob),
          a = element("a", null, {
            href: url,
            download: "scalaris-consulta-" + id + ".json",
          });
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        feedback.textContent =
          "La ficha se descarga en tu dispositivo. Si querés compartirla, adjuntala manualmente.";
      }),
    );
    root.append(
      actions,
      feedback,
      element(
        "p",
        "Copiar o descargar no envía nada. No existe sincronización automática ni un inbox público.",
        { class: "note" },
      ),
    );
    const wa = element("section", null, { class: "whatsapp" });
    wa.append(
      element("h3", "Continuar por WhatsApp"),
      element(
        "p",
        "Al abrir WhatsApp compartirás con ese servicio un mensaje breve con el tipo de consulta y hasta 160 caracteres del motivo. Si decidís enviarlo, Scalaris recibirá ese mensaje y los datos que WhatsApp muestre de tu cuenta. El enlace no incluye tu nombre ni el teléfono que escribiste aquí. Revisá que el motivo no contenga datos sensibles.",
      ),
      element(
        "p",
        "Podés revisar y editar el mensaje antes de enviarlo. Abrir WhatsApp no garantiza recepción. La ficha JSON no se adjunta automáticamente.",
      ),
    );
    const details = element("details");
    details.append(
      element("summary", "Ver el mensaje que se abrirá"),
      element("p", whatsappMessage(inquiry)),
    );
    wa.append(details);
    const link = element("a", "Abrir WhatsApp con este mensaje", {
      class: "button primary",
      href:
        "https://wa.me/5491141477227?text=" +
        encodeURIComponent(whatsappMessage(inquiry)),
      target: "_blank",
      rel: "noopener noreferrer",
    });
    wa.append(link);
    root.append(wa);
  }
}
render();
