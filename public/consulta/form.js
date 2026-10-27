import {
  services,
  questions,
  conditionalQuestions,
  summary,
  whatsappMessage,
  buildInquiry,
  readProductInterest,
  productInterestAnswers,
} from "./model.js?v=20261027-catalogo";
import {
  hasPlanSelection,
  loadPlanSummary,
  planSummaryRows,
  planSummaryText,
  planSummaryTotal,
} from "./plan-summary.js?v=20261027-pricing";
const root = document.querySelector("#form-root"),
  error = document.querySelector("#error"),
  interest = readProductInterest(window.location.search),
  requestedService = interest ? 'SOFTWARE' : new URLSearchParams(window.location.search).get("service");
let step = Object.prototype.hasOwnProperty.call(services, requestedService)
    ? 1
    : 0,
  service = step ? requestedService : "",
  contact = { name: "", phone: "" },
  answers = productInterestAnswers(interest),
  inquiry = null;
const id = crypto.randomUUID(),
  createdAt = new Date().toISOString();
let renderedStep = step;
let cancelPlanSummary = () => {};
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
  cancelPlanSummary();
  cancelPlanSummary = () => {};
  root.replaceChildren();
  document
    .querySelectorAll(".steps li")
    .forEach((e, i) => {
      e.classList.toggle("active", i === step);
      e.classList.toggle("complete", i < step);
      if (i === step) e.setAttribute("aria-current", "step");
      else e.removeAttribute("aria-current");
    });
  if (interest && service === 'SOFTWARE') {
    const context = element('aside',null,{class:'product-context','aria-label':'Producto consultado'});
    context.append(element('strong',`${interest.productName}${interest.planName?` · Plan ${interest.planName}`:''}`),
      element('p',`${interest.billingName?`Modalidad de interés: ${interest.billingName}. `:''}Podés editar las respuestas. Esta consulta no confirma una contratación ni un pago.`),
      element('a','Volver a comparar los planes →',{href:'../catalogo/#planes'}));
    root.append(context);
  }
  if (step === 0) {
    root.append(element("h2", "¿Sobre qué querés consultar?"));
    const options = element("div", null, { class: "choices" });
    for (const [key, label] of Object.entries(services)) {
      const b = button(
        label,
        () => {
          if (service !== key) {
            answers = key === 'SOFTWARE' ? productInterestAnswers(interest) : {};
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
    const needsPlanSummary = service === 'SOFTWARE' && hasPlanSelection(interest);
    let shareText = summary(inquiry);
    let planSummaryReady = !needsPlanSummary;
    root.append(
      element("h2", "Tu consulta, lista para compartir."),
      element("p", "Revisá el resumen. Podés corregir tus respuestas antes de enviarlo.", { class: "note" }),
    );
    const planSection = needsPlanSummary
      ? element('section', null, { class: 'plan-summary', 'aria-label': 'Resumen económico del plan' })
      : null;
    if (planSection) root.append(planSection);
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
    const copy = button(
        "Copiar resumen",
        async () => {
          try {
            await navigator.clipboard.writeText(shareText);
            feedback.textContent = "Resumen copiado. No se envió nada.";
          } catch {
            feedback.textContent =
              "No se pudo copiar automáticamente. Seleccioná el texto del resumen y copialo.";
          }
        },
      );
    actions.append(
      copy,
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
        "https://wa.me/5491172789289?text=" +
        encodeURIComponent(whatsappMessage(inquiry)),
      target: "_blank",
      rel: "noopener noreferrer",
    });
    link.addEventListener("click", (event) => {
      if (!planSummaryReady) {
        event.preventDefault();
        feedback.textContent = 'Primero revisá los importes del plan. Podés volver a intentar cargarlos.';
        return;
      }
      try {
        navigator.clipboard.writeText(shareText).then(
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
    if (planSection) {
      const greetingHref = link.href;
      let requestGeneration = 0;
      const setReady = ready => {
        planSummaryReady = ready;
        copy.disabled = !ready;
        link.setAttribute('aria-disabled', String(!ready));
        if (ready) {
          link.href = greetingHref;
          link.removeAttribute('tabindex');
        } else {
          link.removeAttribute('href');
          link.tabIndex = -1;
        }
      };
      const load = () => {
        const generation = ++requestGeneration;
        cancelPlanSummary();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        cancelPlanSummary = () => {
          clearTimeout(timeout);
          controller.abort();
        };
        setReady(false);
        planSection.setAttribute('aria-busy', 'true');
        planSection.replaceChildren(
          element('h3', 'Revisá el plan elegido'),
          element('p', 'Cargando los importes vigentes…', { role: 'status', class: 'plan-summary-status' }),
        );
        loadPlanSummary(interest, { signal: controller.signal }).then(plan => {
          if (generation !== requestGeneration || !planSection.isConnected || step !== 2 || service !== 'SOFTWARE') return;
          const lines = element('dl', null, { class: 'plan-summary-lines' });
          for (const [label, value] of planSummaryRows(plan)) {
            lines.append(element('dt', label), element('dd', value));
          }
          const total = element('p', null, { class: 'plan-summary-total' });
          total.append(element('span', 'Total inicial'), element('strong', planSummaryTotal(plan)));
          planSection.replaceChildren(
            element('h3', 'Revisá el plan elegido'),
            lines,
            total,
            element('p', plan.nextPayment, { class: 'note' }),
            element('p', 'Precios finales en ARS. El alcance y las condiciones se confirman con Scalaris antes del pago. Esta consulta no contrata ni activa el servicio.', { class: 'note' }),
          );
          shareText = `${summary(inquiry)}\n\n${planSummaryText(plan)}`;
          planSection.setAttribute('aria-busy', 'false');
          setReady(true);
        }).catch(() => {
          if (generation !== requestGeneration || !planSection.isConnected || step !== 2 || service !== 'SOFTWARE') return;
          planSection.setAttribute('aria-busy', 'false');
          planSection.replaceChildren(
            element('h3', 'Revisá el plan elegido'),
            element('p', 'No pudimos cargar los precios. Tus respuestas siguen en esta página. Volvé a intentar para revisar el total antes de compartir la consulta.', { role: 'status', class: 'plan-summary-status' }),
            button('Volver a cargar los precios', load),
          );
        }).finally(() => clearTimeout(timeout));
      };
      load();
    }
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
