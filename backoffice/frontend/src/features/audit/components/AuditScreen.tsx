import type { Event } from "../types";
import { when } from "../../../shared/format";
import { JsonView } from "../../../shared/components";

export function AuditScreen({
  audit,
  auditOffset,
  setAuditOffset,
}: {
  audit: Event[];
  auditOffset: number;
  setAuditOffset: (offset: number) => void;
}) {
  return (
    <>
      <h1>Trazabilidad interna</h1>
      <p className="notice">
        Eventos anónimos de operación local. No identifican personas
        verificadas ni constituyen auditoría inviolable.
      </p>
      <section className="panel">
        {audit.map((e) => (
          <details className="audit" key={e.id}>
            <summary>
              {when(e.occurred_at)} · {e.entity} #{e.entity_id} ·{" "}
              {e.type}
            </summary>
            <p>Origen: {e.origin}</p>
            <JsonView data={e.data} />
          </details>
        ))}
        <div className="actions">
          <button
            disabled={!auditOffset}
            onClick={() =>
              setAuditOffset(Math.max(0, auditOffset - 100))
            }
          >
            Anterior
          </button>
          <button
            disabled={audit.length < 100}
            onClick={() => setAuditOffset(auditOffset + 100)}
          >
            Siguiente
          </button>
        </div>
      </section>
    </>
  );
}
