import { useState } from "react";
import { saveClient } from "../api";
import type { Client } from "../types";
import type { Data } from "../../../shared/types";
import { Form, Text } from "../../../shared/components";

export function ClientEditor({
  client,
  onSaved,
}: {
  client?: Client;
  onSaved: (c: Client) => void;
}) {
  const [data, set] = useState<Data>(
    client?.data || { name: "", phone: "", email: "", address: "", notes: "" },
  );
  const change = (k: string, v: string) => set({ ...data, [k]: v });
  return (
    <Form
      onSubmit={async () =>
        onSaved(
          await saveClient(data, client),
        )
      }
    >
      <div className="grid two">
        <Text
          label="Nombre o identificación *"
          value={data.name}
          required
          onChange={(v) => change("name", v)}
          max={300}
        />
        <Text
          label="Teléfono / WhatsApp"
          value={data.phone}
          onChange={(v) => change("phone", v)}
          max={300}
        />
        <Text
          label="Correo"
          value={data.email}
          type="email"
          onChange={(v) => change("email", v)}
          max={300}
        />
        <Text
          label="Dirección"
          value={data.address}
          onChange={(v) => change("address", v)}
          max={300}
        />
      </div>
      <Text
        label="Observaciones (sin contraseñas)"
        value={data.notes}
        long
        onChange={(v) => change("notes", v)}
      />
    </Form>
  );
}
