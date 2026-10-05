import { useState } from "react";
import { transitionCase } from "../api";
import { states } from "../labels";
import type { Detail } from "../types";
import { Form, Field, Text } from "../../../shared/components";

export function Transition({
  detail: d,
  done,
}: {
  detail: Detail;
  done: () => void;
}) {
  const [status, set] = useState(""),
    [reason, setReason] = useState(""),
    [correction, setCorrection] = useState(false);
  return (
    <Form
      label="Confirmar cambio"
      onSubmit={async () => {
        await transitionCase(d.case, status, reason, correction);
        done();
      }}
    >
      <p>
        Estado actual: {states[d.case.status]}. Aceptación y envío se registran
        desde la revisión del presupuesto.
      </p>
      <Field label="Nuevo estado">
        <select required value={status} onChange={(e) => set(e.target.value)}>
          <option value="">Seleccionar</option>
          {Object.entries(states)
            .filter(([k]) => !["QUOTED", "ACCEPTED", d.case.status].includes(k))
            .map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
        </select>
      </Field>
      <Text
        label="Motivo *"
        long
        required
        value={reason}
        onChange={setReason}
      />
      <label className="check">
        <input
          type="checkbox"
          checked={correction}
          onChange={(e) => setCorrection(e.target.checked)}
        />
        Corrección / reapertura con motivo
      </label>
      <p className="muted">
        El servidor verifica las transiciones. La entrega requiere una nota de
        entrega en la orden; el saldo no la bloquea.
      </p>
    </Form>
  );
}
