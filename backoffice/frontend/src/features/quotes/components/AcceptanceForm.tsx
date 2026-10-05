import { useState } from "react";
import { acceptRevision } from "../api";
import type { Revision } from "../types";
import { Form, Text } from "../../../shared/components";
import { money } from "../../../shared/format";

export function Acceptance({
  caseId,
  acceptedRevisionId,
  revision: r,
  done,
}: {
  caseId: number;
  acceptedRevisionId: number | null;
  revision: Revision;
  done: () => void;
}) {
  const [channel, setChannel] = useState("WhatsApp"),
    [note, setNote] = useState(""),
    [date, setDate] = useState(
      new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, -1),
    );
  return (
    <Form
      label={`Confirmar aceptación de R${r.revision}`}
      onSubmit={async () => {
        await acceptRevision(caseId, r, channel, note, date);
        done();
      }}
    >
      <p>
        Registrás manualmente la aceptación de{" "}
        <strong>
          R{r.revision}, {money(r.total)}
        </strong>
        . No representa firma digital ni aprobación automática del cliente.
      </p>
      {acceptedRevisionId && (
        <p className="notice">
          Esta aceptación reemplazará la revisión vigente de la orden. Los pagos
          e historial se conservan.
        </p>
      )}
      <Text
        label="Fecha y hora de aceptación (Buenos Aires) *"
        type="datetime-local"
        required
        value={date}
        onChange={setDate}
      />
      <Text
        label="Canal *"
        required
        max={100}
        value={channel}
        onChange={setChannel}
      />
      <Text
        label="Nota / constancia manual"
        long
        value={note}
        onChange={setNote}
      />
    </Form>
  );
}
