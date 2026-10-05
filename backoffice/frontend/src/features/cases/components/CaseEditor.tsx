import { useState } from "react";
import { saveCase } from "../api";
import { services } from "../labels";
import type { Case } from "../types";
import type { Client } from "../../clients/types";
import type { Data } from "../../../shared/types";
import { Form, Text, Field } from "../../../shared/components";

export function CaseEditor({
  entry,
  clients,
  onSaved,
}: {
  entry?: Case;
  clients: Client[];
  onSaved: (c: Case) => void;
}) {
  const [clientId, setClient] = useState(
    String(entry?.client_id || clients[0]?.id || ""),
  );
  const [service, setService] = useState(entry?.service || "EQUIPMENT");
  const [data, set] = useState<Data>(entry?.data || { title: "" });
  const keys =
    service === "SOFTWARE"
      ? {
        need: "Necesidad",
        scope: "Alcance",
        requirements: "Requisitos",
        deliverables: "Entregables",
        diagnosis: "Relevamiento",
        notes: "Observaciones",
      }
      : {
        type: "Tipo de equipo",
        model: "Marca / modelo",
        serial: "Número de serie",
        accessories: "Accesorios recibidos",
        fault: "Falla declarada / repuesto solicitado",
        condition: "Condición de recepción",
        diagnosis: "Diagnóstico",
        notes: "Notas",
      };
  return (
    <Form
      onSubmit={async () =>
        onSaved(
          await saveCase(clientId, service, data, entry),
        )
      }
    >
      <div className="grid two">
        <Field label="Cliente *">
          <select
            required
            value={clientId}
            onChange={(e) => setClient(e.target.value)}
          >
            <option value="">Seleccionar cliente</option>
            {clients.map((c) => (
              <option value={c.id} key={c.id}>
                {c.data.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Servicio">
          <select
            value={service}
            disabled={!!entry}
            onChange={(e) => {
              setService(e.target.value);
              set({ title: data.title });
            }}
          >
            {Object.entries(services).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Text
        label="Título de consulta / trabajo *"
        value={data.title}
        required
        onChange={(v) => set({ ...data, title: v })}
        max={300}
      />
      <div className="grid two">
        {Object.entries(keys).map(([key, label]) => (
          <Text
            key={key}
            label={label}
            max={key === "notes" ? 9000 : 3000}
            value={data[key] || ""}
            long={!["type", "model", "serial"].includes(key)}
            onChange={(v) => set({ ...data, [key]: v })}
          />
        ))}
      </div>
      <p className="notice">
        No registres contraseñas ni credenciales de clientes.
      </p>
    </Form>
  );
}
