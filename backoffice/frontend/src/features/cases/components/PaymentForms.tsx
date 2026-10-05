import { useState } from "react";
import { recordPayment, reversePayment } from "../api";
import type { Detail } from "../types";
import { Form, Text } from "../../../shared/components";
import { today, money } from "../../../shared/format";
import { newOperationKey } from "../../../shared/operationKey";

export function Payment({
  detail: d,
  done,
}: {
  detail: Detail;
  done: () => void;
}) {
  const [data, set] = useState({
    amount: "",
    date: today(),
    method: "Transferencia",
    reference: "",
    note: "",
    operationKey: newOperationKey(),
  });
  return (
    <Form
      label="Confirmar pago"
      onSubmit={async () => {
        await recordPayment(d.case.id, data);
        done();
      }}
    >
      <p>
        Saldo pendiente: <strong>{money(d.balance.balance)}</strong>
      </p>
      <div className="grid two">
        <Text
          label="Importe ARS *"
          required
          value={data.amount}
          onChange={(v) => set({ ...data, amount: v })}
        />
        <Text
          label="Fecha *"
          type="date"
          required
          value={data.date}
          onChange={(v) => set({ ...data, date: v })}
        />
        <Text
          label="Medio *"
          required
          max={100}
          value={data.method}
          onChange={(v) => set({ ...data, method: v })}
        />
        <Text
          label="Referencia (distingue pagos iguales)"
          max={300}
          value={data.reference}
          onChange={(v) => set({ ...data, reference: v })}
        />
      </div>
      <Text
        label="Nota"
        long
        value={data.note}
        onChange={(v) => set({ ...data, note: v })}
      />
      <p className="muted">
        Solo registro manual. Un error se corrige mediante anulación con motivo,
        conservando el pago original.
      </p>
    </Form>
  );
}
export function Reverse({
  caseId,
  paymentId,
  done,
}: {
  caseId: number;
  paymentId: number;
  done: () => void;
}) {
  const [reason, set] = useState("");
  return (
    <Form
      label="Confirmar anulación"
      onSubmit={async () => {
        await reversePayment(caseId, paymentId, reason);
        done();
      }}
    >
      <p>
        Se conservará el pago #{paymentId} y se creará una contrapartida por el
        mismo importe.
      </p>
      <Text label="Motivo *" required long value={reason} onChange={set} />
    </Form>
  );
}
