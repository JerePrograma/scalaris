import { useState } from "react";
import { addCaseNote } from "../api";
import type { Event } from "../../audit/types";
import { Form, Text, JsonView } from "../../../shared/components";
import { when } from "../../../shared/format";

export function CaseTimeline({
  id,
  events,
  load,
}: {
  id: number;
  events: Event[];
  load: () => Promise<void>;
}) {
  const [note, setNote] = useState("");
  return (
    <section className="panel">
      <h2>Cronología</h2>
      <Form
        label="Agregar nota"
        onSubmit={async () => {
          await addCaseNote(id, note);
          setNote("");
          await load();
        }}
      >
        <Text
          label="Nota de seguimiento"
          long
          max={6000}
          value={note}
          required
          onChange={setNote}
        />
      </Form>
      <ol className="timeline">
        {events.map((e) => (
          <li key={e.id}>
            <div>
              <strong>
                {(
                  {
                    CREATED: "Creación",
                    EDITED: "Edición",
                    STATUS: "Cambio de estado",
                    REOPENED: "Corrección / reapertura",
                    NOTE: "Nota",
                    SENT: "Envío manual",
                    ACCEPTED: "Aceptación manual",
                    PAYMENT: "Pago",
                    REVERSAL: "Anulación de pago",
                    ATTACHED: "Adjunto",
                    IMPORTED: "Importación",
                  } as Record<string, string>
                )[e.type] || e.type}
              </strong>
              <span>{when(e.occurred_at)}</span>
            </div>
            {e.type === "NOTE" ? (
              <p>{(e.data as { text: string }).text}</p>
            ) : (
              <details>
                <summary>Detalle registrado</summary>
                <JsonView data={e.data} />
              </details>
            )}
          </li>
        ))}
      </ol>
      <p className="muted">
        Origen operativo anónimo/local. La cronología no demuestra identidad
        ni es una auditoría inviolable.
      </p>
    </section>

  );
}
