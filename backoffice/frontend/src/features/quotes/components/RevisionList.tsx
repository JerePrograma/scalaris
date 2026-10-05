import type { Revision } from "../types";
import { money, when } from "../../../shared/format";
import { Empty } from "../../../shared/components";

export function RevisionList({
  revisions,
  onEdit,
  onSend,
  onAccept,
}: {
  revisions: Revision[];
  onEdit: (revision: Revision) => void;
  onSend: (revision: Revision) => void;
  onAccept: (revision: Revision) => void;
}) {
  return (
    <section className="panel">
      <h2>Presupuestos y revisiones</h2>
      {!revisions.length ? (
        <Empty>
          Prepará una revisión con conceptos y plazo. Enviarla congela sus
          importes.
        </Empty>
      ) : (
        revisions.map((r) => (
          <article className="revision" key={r.id}>
            <div className="row between">
              <strong>
                #{r.snapshot.quoteNumber} / R{r.revision}
              </strong>
              <span className="badge">
                {
                  {
                    DRAFT: "Borrador",
                    SENT: "Enviado",
                    ACCEPTED: "Aceptado",
                  }[r.status]
                }
              </span>
            </div>
            <p className="amount">{money(r.total)}</p>
            <p>
              Emisión {r.snapshot.issueDate} · Vence {r.snapshot.expiryDate}
              <br />
              Plazo: {r.snapshot.leadTime}
            </p>
            <details>
              <summary>Ver conceptos e importes históricos</summary>
              {r.snapshot.items.map((item, i) => (
                <p key={i}>
                  {item.description} · {item.quantity} {item.unit} ×{" "}
                  {money(item.unitPrice)}
                  <br />
                  Descuento: {item.discountType} {item.discountValue} ·
                  Neto: {money(item.total || "0")}
                </p>
              ))}
              <p>
                Subtotal {money(r.subtotal)} · Descuento {money(r.discount)}{" "}
                · Ajuste {money(r.adjustment)}
              </p>
              {r.snapshot.manualTotal && (
                <p>Motivo de ajuste: {r.snapshot.adjustmentReason}</p>
              )}
              <p>Condiciones: {r.snapshot.conditions}</p>
              <p>
                Seña sugerida {money(r.snapshot.suggestedDeposit || "0")}
              </p>
              {r.accepted_at && (
                <p>
                  Aceptación manual: {when(r.accepted_at)} ·{" "}
                  {r.acceptance?.channel} · {r.acceptance?.note}
                </p>
              )}
            </details>
            <div className="actions">
              <a
                className="button"
                href={"/api/revisions/" + r.id + "/pdf"}
              >
                Descargar PDF
              </a>
              <button
                onClick={() => onEdit(r)}
              >
                {r.status === "DRAFT"
                  ? "Editar borrador"
                  : "Nueva revisión desde ésta"}
              </button>
              {r.status === "DRAFT" && (
                <button
                  onClick={() => onSend(r)}
                >
                  Registrar envío
                </button>
              )}
              {r.status === "SENT" && (
                <button
                  className="primary"
                  onClick={() => onAccept(r)}
                >
                  Registrar aceptación
                </button>
              )}
            </div>
          </article>
        ))
      )}
    </section>

  );
}
