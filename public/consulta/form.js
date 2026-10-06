import {
  services,
  questions,
  conditionalQuestions,
  summary,
  whatsappMessage,
  buildInquiry,
} from "./model.js";
const root = document.querySelector("#form-root"),
  error = document.querySelector("#error"),
  requestedService = new URLSearchParams(window.location.search).get("service");
let step = Object.prototype.hasOwnProperty.call(services, requestedService)
    ? 1
    : 0,
  service = step ? requestedService : "",
  contact = { name: "", phone: "" },
  answers = {},
  inquiry = null;
const id = crypto.randomUUID(),
  createdAt = new Date().toISOString();
let renderedStep = step;
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
      ...(long ? { rows: "3" } : { type: key === "phone" ? "tel" : "text" }),
    });
  input.name = key;
  if (key === "name" || key === "phone")
    input.autocomplete = key === "name" ? "name" : "tel";
  input.value = target[key] || "";
  if (required) input.required = true;
  input.addEventListener("input", () => (target[key] = input.value));
  if (options && key === "topic")
    input.addEventListener("change", () => {
      target[key] = input.value;
      render();
      root.querySelector('[name="topic"]').focus({ preventScroll: true });
    });
  wrapper.append(caption, input);
  return wrapper;
}
function render() {
  root.replaceChildren();
  document
    .querySelectorAll(".steps li")
    .forEach((e, i) => {
      e.classList.toggle("active", i === step);
      e.classList.toggle("complete", i < step);
      if (i === step) e.setAttribute("aria-current", "step");
      else e.removeAttribute("aria-current");
    });
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
      const descriptions = {
        EQUIPMENT: "Tu equipo, su funcionamiento o la conexión.",
        PARTS: "La pieza que buscás y su compatibilidad.",
        SOFTWARE: "Tu idea, tu negocio o un proceso a mejorar.",
      };
      b.replaceChildren(
        element("strong", label),
        element("span", descriptions[key], { class: "choice-description" }),
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
    root.append(
      element("h2", "Tu consulta, lista para compartir."),
      element("p", "Revisá el resumen. Podés corregir tus respuestas antes de enviarlo.", { class: "note" }),
    );
    const pre = element("pre", summary(inquiry), { class: "summary" });
    root.append(pre);
    const feedback = element("p", null, { role: "status", class: "feedback" });
    const correction = button("← Corregir respuestas", () => {
      step = 1;
      render();
    });
    correction.classList.add("edit-response");
    root.append(correction);
    const actions = element("div", null, { class: "actions" });
    actions.append(
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
      ),
      button("Descargar ficha", () => {
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
    const wa = element("section", null, { class: "whatsapp" });
    wa.append(
      element("h3", "Compartí tu consulta por WhatsApp"),
      element(
        "p",
        "Copiamos el resumen y abrimos el chat. Pegalo, revisalo y tocá Enviar en WhatsApp.",
      ),
      element(
        "p",
        "El resumen incluye los datos que completaste. Quitá cualquier dato sensible antes de pegarlo. El saludo inicial no incluye tu nombre ni teléfono; vos elegís qué enviar.",
        { class: "note" },
      ),
    );
    const details = element("details");
    details.append(
      element("summary", "Ver el saludo inicial"),
      element("p", whatsappMessage(inquiry)),
    );
    wa.append(details);
    const link = element("a", "Copiar resumen y abrir WhatsApp", {
      class: "button primary",
      href:
        "https://wa.me/5491141477227?text=" +
        encodeURIComponent(whatsappMessage(inquiry)),
      target: "_blank",
      rel: "noopener noreferrer",
    });
    link.addEventListener("click", () => {
      try {
        navigator.clipboard.writeText(summary(inquiry)).then(
          () => (feedback.textContent = "Resumen copiado. Pegalo en el chat y revisalo antes de enviarlo."),
          () =>
            (feedback.textContent =
              "No se pudo copiar automáticamente. Usá Copiar resumen o seleccioná el texto de la ficha para pegarlo en WhatsApp."),
        );
      } catch {
        feedback.textContent =
          "No se pudo copiar automáticamente. Usá Copiar resumen o seleccioná el texto de la ficha para pegarlo en WhatsApp.";
      }
    });
    wa.append(link);
    root.append(wa, feedback);
    const alternatives = element("details", null, { class: "alternate-actions" });
    alternatives.append(
      element("summary", "Copiar o descargar la ficha"),
      actions,
      element(
        "p",
        "Copiar o descargar guarda una copia para vos. Para enviarla, compartila por WhatsApp.",
        { class: "note" },
      ),
    );
    root.append(alternatives);
  }
  if (renderedStep !== step) {
    const heading = root.querySelector("h2");
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: "start", behavior: "auto" });
  }
  renderedStep = step;
}
render();
