import { useState } from "react";
import { states, services } from "../labels";
import { money } from "../../../shared/format";
import type { Catalog } from "../../catalog/types";
import type { Client } from "../../clients/types";
import type { Revision } from "../../quotes/types";
import { Dialog, Form } from "../../../shared/components";
import { CaseEditor } from "./CaseEditor";
import { QuoteEditor } from "../../quotes/components/QuoteEditor";
import { RevisionList } from "../../quotes/components/RevisionList";
import { Acceptance } from "../../quotes/components/AcceptanceForm";
import { sendRevision } from "../../quotes/api";
import { Transition } from "./TransitionForm";
import { Payment, Reverse } from "./PaymentForms";
import { WorkEditor } from "./WorkEditor";
import { WorkPanel } from "./WorkPanel";
import { PaymentsPanel } from "./PaymentsPanel";
import { AttachmentsPanel } from "./AttachmentsPanel";
import { CaseTimeline } from "./CaseTimeline";
import { useCaseDetail } from "../hooks/useCaseDetail";

export function CaseView({
  id,
  clients,
  catalog,
  onBack,
  onChange,
}: {
  id: number;
  clients: Client[];
  catalog: Catalog[];
  onBack: () => void;
  onChange: () => void;
}) {
  const { detail: d, error, load } = useCaseDetail(id);
  const [modal, setModal] = useState("");
  const [selected, setSelected] = useState<Revision>();
  function done() {
    setModal("");
    void load();
    onChange();
  }
  if (!d) return <p role="status">{error || "Cargando consulta…"}</p>;
  const c = d.case,
    paidLabel = { UNPAID: "Sin pago", PARTIAL: "Parcial", PAID: "Pagado" }[
      d.balance.status
    ];
  return (
    <>
      <button onClick={onBack}>← Todas las consultas</button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="page-title">
        <div>
          <p className="eyebrow">
            CONSULTA #{c.number} · {services[c.service]}
          </p>
          <h1>{c.data.title}</h1>
          <p>
            {d.client.data.name}{" "}
            {d.client.data.phone && "· " + d.client.data.phone}
          </p>
        </div>
        <span className={"badge " + c.status.toLowerCase()}>
          {states[c.status]}
        </span>
      </div>
      <div className="actions">
        <button onClick={() => setModal("edit")}>Editar ficha</button>
        <button onClick={() => setModal("status")}>
          Cambiar estado / reabrir
        </button>
        <button
          className="primary"
          onClick={() => {
            setSelected(undefined);
            setModal("quote");
          }}
        >
          + Presupuesto
        </button>
        <button
          onClick={() => setModal("payment")}
          disabled={!c.accepted_revision_id}
        >
          Registrar pago
        </button>
      </div>
      <div className="grid three metrics">
        <article>
          <span>Total aceptado</span>
          <strong>{money(d.balance.total)}</strong>
        </article>
        <article>
          <span>Cobrado · {paidLabel}</span>
          <strong>{money(d.balance.paid)}</strong>
        </article>
        <article>
          <span>Saldo pendiente</span>
          <strong>{money(d.balance.balance)}</strong>
        </article>
      </div>
      {c.accepted_revision_id && (
        <p className="notice">
          {Number(d.balance.balance) > 0
            ? "Hay saldo pendiente. No bloquea el trabajo ni la entrega."
            : "Sin saldo pendiente."}{" "}
          La seña sugerida figura en la revisión aceptada.
        </p>
      )}
      <div className="grid two">
        <section className="panel">
          <h2>Ficha del caso</h2>
          <dl>
            {Object.entries(c.data)
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt>
                    {(
                      {
                        title: "Título",
                        type: "Tipo",
                        model: "Marca / modelo",
                        serial: "Serie",
                        accessories: "Accesorios",
                        fault: "Falla / consulta",
                        condition: "Recepción",
                        diagnosis: "Diagnóstico / relevamiento",
                        notes: "Observaciones",
                        need: "Necesidad",
                        scope: "Alcance",
                        requirements: "Requisitos",
                        deliverables: "Entregables",
                      } as Record<string, string>
                    )[k] || k}
                  </dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>
        </section>
        <RevisionList
          revisions={d.revisions}
          onEdit={(r) => {
            setSelected(r);
            setModal(r.status === "DRAFT" ? "quote-edit" : "quote");
          }}
          onSend={(r) => { setSelected(r); setModal("send"); }}
          onAccept={(r) => { setSelected(r); setModal("accept"); }}
        />
      </div>
      <WorkPanel detail={d} onEdit={() => setModal("work")} />
      <div className="grid two">
        <PaymentsPanel payments={d.payments} onReverse={(id) => setModal("reverse-" + id)} />
        <AttachmentsPanel id={id} attachments={d.attachments} load={load} />
      </div>
      <CaseTimeline id={id} events={d.events} load={load} />
      {modal && (
        <Dialog
          title={
            modal.startsWith("quote")
              ? "Presupuesto"
              : (
                {
                  edit: "Editar ficha",
                  status: "Cambiar estado",
                  payment: "Registrar pago",
                  send: "Registrar envío manual",
                  accept: "Registrar aceptación",
                  work: "Orden de trabajo",
                } as Record<string, string>
              )[modal] || "Anular pago"
          }
          onClose={() => setModal("")}
        >
          {modal === "edit" && (
            <CaseEditor entry={c} clients={clients} onSaved={done} />
          )}
          {modal.startsWith("quote") && (
            <QuoteEditor
              caseId={id}
              service={c.service}
              source={selected}
              edit={modal === "quote-edit"}
              catalog={catalog}
              onSaved={done}
            />
          )}
          {modal === "status" && <Transition detail={d} done={done} />}
          {modal === "payment" && <Payment detail={d} done={done} />}
          {modal === "work" && d.work && <WorkEditor detail={d} done={done} />}
          {modal === "send" && selected && (
            <Form
              label="Confirmar registro de envío"
              onSubmit={async () => {
                await sendRevision(id, selected);
                done();
              }}
            >
              <p>
                Revisión R{selected.revision} por {money(selected.total)}. Al
                confirmar quedará congelada. Registrá el envío que realizaste
                manualmente; esta acción no envía WhatsApp ni correo.
              </p>
            </Form>
          )}
          {modal === "accept" && selected && (
            <Acceptance
              caseId={id}
              acceptedRevisionId={c.accepted_revision_id}
              revision={selected}
              done={done}
            />
          )}
          {modal.startsWith("reverse-") && (
            <Reverse
              caseId={id}
              paymentId={Number(modal.slice(8))}
              done={done}
            />
          )}
        </Dialog>
      )}
    </>
  );
}
